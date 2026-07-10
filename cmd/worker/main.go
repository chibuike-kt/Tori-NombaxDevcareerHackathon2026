package main

import (
	"context"
	"encoding/json"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/billing"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/dunning"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/email"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/ledger"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/payment"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/payout"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/postgres"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/reconciliation"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/scheduler"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/webhook"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := postgres.NewPool(ctx)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer pool.Close()
	log.Info().Msg("database connection established")

	subsRepo := postgres.NewSubscriptionRepo(pool)
	tenantRepo := postgres.NewTenantRepo(pool)
	customerRepo := postgres.NewCustomerRepo(pool)
	planRepo := postgres.NewPlanRepo(pool)
	ledgerRepo := postgres.NewLedgerRepo(pool)
	jobRepo := postgres.NewJobRepo(pool)
	webhookRepo := postgres.NewWebhookRepo(pool)
	invoicesRepo := postgres.NewInvoiceRepo(pool)
	emailTemplateRepo := postgres.NewEmailTemplateRepo(pool)
	emailClient := email.NewResendClient()

	ledgerSvc := ledger.NewService(ledgerRepo)

// Nomba payment client — real if credentials present, mock otherwise
	// Uses the mandate client so the recovery ladder can escalate card → mandate
	var paymentClient payment.NombaClient
	nombaClientID := os.Getenv("NOMBA_CLIENT_ID")
	if nombaClientID != "" {
		paymentClient = payment.NewNombaMandateClient(
			nombaClientID,
			os.Getenv("NOMBA_CLIENT_SECRET"),
			os.Getenv("NOMBA_ACCOUNT_ID"),
			os.Getenv("NOMBA_SUB_ACCOUNT_ID"),
		)
		log.Info().Msg("Nomba mandate client initialised — recovery ladder enabled")
	} else {
		paymentClient = payment.NewMockNombaClient()
		log.Warn().Msg("NOMBA_CLIENT_ID not set — using mock payment client")
	}

	classifier, err := payment.LoadClassifier("config/failure_codes.yaml")
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load failure codes")
	}
	dunningEngine := dunning.NewEngine(classifier)

handlers := billing.NewHandlers(
	subsRepo, tenantRepo, customerRepo, planRepo,
	ledgerSvc, dunningEngine, paymentClient, webhookRepo, invoicesRepo, jobRepo,
).WithEmailTemplates(emailTemplateRepo, emailClient)
	// Register all job handlers on a single worker instance
	// RunPool will clone it into 5 concurrent goroutines
	worker := scheduler.NewWorker(jobRepo, 10*time.Second)
	worker.Register(domain.JobExpireTrial, handlers.ExpireTrial)
	worker.Register(domain.JobRetryFailedPayment, handlers.RetryFailedPayment)
	worker.Register(domain.JobSuspendSubscription, handlers.SuspendSubscription)
	worker.Register(domain.JobTypeGraceRetry, handlers.GraceRetry)
	worker.Register(domain.JobCheckoutAbandoned, handlers.CheckAbandonedCheckouts)
	worker.Register(domain.JobTrialEndingSoon, handlers.TrialEndingSoon)
	webhookDispatcher := webhook.NewDispatcher(webhookRepo, jobRepo).
		WithMerchantEmail(customerRepo, subsRepo, planRepo, tenantRepo, emailTemplateRepo, emailClient)
	worker.Register(domain.JobWebhookDeliver, webhookDispatcher.HandleWebhookDeliver)
	worker.Register(domain.JobCancelAtPeriodEnd, handlers.CancelAtPeriodEnd)
	worker.Register(domain.JobSimulateWebhook, handlers.SimulateWebhook)

	payoutRepo := postgres.NewPayoutRepo(pool)
	payoutHandlers := payout.NewHandlers(payoutRepo, paymentClient, webhookDispatcher, tenantRepo, ledgerSvc)
	worker.Register(domain.JobProcessPayout, payoutHandlers.ProcessPayout)

	idempotencyKeyRepo := postgres.NewIdempotencyKeyRepo(pool)
	worker.Register(domain.JobCleanupIdempotencyKeys, func(ctx context.Context, _ json.RawMessage) error {
		return idempotencyKeyRepo.DeleteExpired(ctx)
	})

	// Reconciliation service
reconSvc := reconciliation.NewService(pool, paymentClient, ledgerRepo)
worker.Register(domain.JobReconciliation, reconSvc.HandleReconciliation)

	runCtx, runCancel := context.WithCancel(context.Background())
	defer runCancel()

	// Launch 5 concurrent worker goroutines
	// PostgreSQL SKIP LOCKED ensures each goroutine claims a different job
	// At 1000 subscribers with monthly billing, up to ~100 jobs fire on the same day
	// 5 goroutines processes these in parallel rather than sequentially
	worker.RunPool(runCtx, 5)
	log.Info().Msg("worker process started — handlers registered")

	// Schedule nightly reconciliation on startup
	go func() {
		if err := reconSvc.ScheduleNightly(runCtx, tenantRepo, jobRepo); err != nil {
			log.Error().Err(err).Msg("failed to schedule nightly reconciliation")
		}
	}()

	// Schedule idempotency key cleanup alongside reconciliation — a single
	// global job, not per-tenant, since expired keys are just deleted by
	// expires_at regardless of which tenant they belong to.
	go func() {
		payload, _ := json.Marshal(map[string]string{})
		if _, err := jobRepo.Enqueue(runCtx, nil, domain.JobCleanupIdempotencyKeys, payload, time.Now(), 3, "live"); err != nil {
			log.Error().Err(err).Msg("failed to schedule idempotency key cleanup")
		}
	}()

	// Schedule abandoned checkout check on startup
	go func() {
		if err := handlers.ScheduleAbandonedCheckoutCheck(runCtx, tenantRepo, jobRepo); err != nil {
			log.Error().Err(err).Msg("failed to schedule abandoned checkout check")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info().Msg("worker shutting down")
	runCancel()
}

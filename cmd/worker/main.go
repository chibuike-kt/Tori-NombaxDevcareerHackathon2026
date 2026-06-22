package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/billing"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/dunning"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/ledger"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/payment"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/postgres"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/scheduler"
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

	ledgerSvc := ledger.NewService(ledgerRepo)
	paymentClient := payment.NewMockNombaClient()

	classifier, err := payment.LoadClassifier("config/failure_codes.yaml")
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load failure codes")
	}
	dunningEngine := dunning.NewEngine(classifier)

	handlers := billing.NewHandlers(
		subsRepo, tenantRepo, customerRepo, planRepo,
		ledgerSvc, dunningEngine, paymentClient, webhookRepo,
	)

	worker := scheduler.NewWorker(jobRepo, 10*time.Second)
	worker.Register(domain.JobExpireTrial, handlers.ExpireTrial)
	worker.Register(domain.JobRetryFailedPayment, handlers.RetryFailedPayment)
	worker.Register(domain.JobSuspendSubscription, handlers.SuspendSubscription)
	worker.Register(domain.JobTypeGraceRetry, handlers.GraceRetry)

	runCtx, runCancel := context.WithCancel(context.Background())
	defer runCancel()

	go worker.Run(runCtx)

	log.Info().Msg("worker process started — handlers registered")

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("worker shutting down")
	runCancel()
}

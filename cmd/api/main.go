package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	api "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/cache"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/payment"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/postgres"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/email"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	jwtSecret := os.Getenv("JWT_SECRET")
	if len(jwtSecret) < 32 {
		log.Fatal().Msg("JWT_SECRET must be set and at least 32 characters — refusing to start")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := postgres.NewPool(ctx)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer pool.Close()
	log.Info().Msg("database connection established")

	tokenStore, err := cache.NewTokenStore()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to Redis")
	}
	log.Info().Msg("Redis connection established")

	// Live Nomba payment client — real if credentials present, mock otherwise
	var liveClient payment.NombaClient
	nombaClientID := os.Getenv("NOMBA_CLIENT_ID")
	if nombaClientID != "" {
		liveClient = payment.NewNombaHTTPClient(
			nombaClientID,
			os.Getenv("NOMBA_CLIENT_SECRET"),
			os.Getenv("NOMBA_ACCOUNT_ID"),
			os.Getenv("NOMBA_SUB_ACCOUNT_ID"),
		)
		log.Info().Msg("Nomba HTTP client initialised (live)")
	} else {
		liveClient = payment.NewMockNombaClient()
		log.Warn().Msg("NOMBA_CLIENT_ID not set — using mock payment client for live mode")
	}

	// Test Nomba payment client — always targets sandbox when credentials present
	var testClient payment.NombaClient
	nombaTestClientID := os.Getenv("NOMBA_TEST_CLIENT_ID")
	if nombaTestClientID != "" {
		testClient = payment.NewNombaHTTPClientForSandbox(
			nombaTestClientID,
			os.Getenv("NOMBA_TEST_CLIENT_SECRET"),
			os.Getenv("NOMBA_ACCOUNT_ID"),
			os.Getenv("NOMBA_SUB_ACCOUNT_ID"),
		)
		log.Info().Msg("Nomba HTTP client initialised (test/sandbox)")
	} else {
		testClient = payment.NewMockNombaClient()
		log.Warn().Msg("NOMBA_TEST_CLIENT_ID not set — using mock payment client for test mode")
	}

	// Requests authenticated with a test API key route to the sandbox client;
	// live keys and JWT-authenticated dashboard requests route to the live client.
	paymentClient := payment.NewModeAwareClient(liveClient, testClient, middleware.GetAPIKeyMode)

deps := api.Deps{
    Tenants:            postgres.NewTenantRepo(pool),
    Customers:          postgres.NewCustomerRepo(pool),
    Plans:              postgres.NewPlanRepo(pool),
    Subscriptions:      postgres.NewSubscriptionRepo(pool),
    Invoices:           postgres.NewInvoiceRepo(pool),
    Ledger:             postgres.NewLedgerRepo(pool),
    Jobs:               postgres.NewJobRepo(pool),
    Webhooks:           postgres.NewWebhookRepo(pool),
    Tokens:             tokenStore,
    Payment:            paymentClient,
    EmailVerifications: postgres.NewEmailVerificationRepo(pool),
		Members:     postgres.NewMemberRepo(pool),
		Invitations: postgres.NewInvitationRepo(pool),
		Audit:       postgres.NewAuditRepo(pool),
		APIKeys:     postgres.NewAPIKeyRepo(pool),
    EmailClient:        email.NewResendClient(),
		Pool: pool,
}

	router := api.NewRouter(deps)

	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("API_PORT")
	}
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info().Str("port", port).Msg("API server starting")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("API server failed")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("API server shutting down")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatal().Err(err).Msg("forced shutdown")
	}
	log.Info().Msg("API server stopped")
}

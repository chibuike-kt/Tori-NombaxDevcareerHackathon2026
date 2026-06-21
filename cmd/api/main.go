package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	api "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/cache"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/postgres"
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

	deps := api.Deps{
		Tenants:       postgres.NewTenantRepo(pool),
		Customers:     postgres.NewCustomerRepo(pool),
		Plans:         postgres.NewPlanRepo(pool),
		Subscriptions: postgres.NewSubscriptionRepo(pool),
		Invoices:      postgres.NewInvoiceRepo(pool),
		Ledger:        postgres.NewLedgerRepo(pool),
		Jobs:          postgres.NewJobRepo(pool),
		Webhooks:      postgres.NewWebhookRepo(pool),
		Tokens:        tokenStore,
	}

	router := api.NewRouter(deps)

	port := os.Getenv("API_PORT")
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

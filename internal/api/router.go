package api

import (
	"net/http"
	"os"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/handlers"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/finops"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/ledger"
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/httprate"
)

type Deps struct {
	Tenants       domain.TenantRepository
	Customers     domain.CustomerRepository
	Plans         domain.PlanRepository
	Subscriptions domain.SubscriptionRepository
	Invoices      domain.InvoiceRepository
	Ledger        domain.LedgerRepository
	Jobs          domain.JobRepository
	Webhooks      domain.WebhookRepository
}

func NewRouter(deps Deps) http.Handler {
	r := chi.NewRouter()

	jwtSecret := os.Getenv("JWT_SECRET")

	// Global middleware
	r.Use(chimiddleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(httprate.LimitByIP(100, 60))

	// Health
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})
	r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Handlers
	authH := handlers.NewAuthHandler(deps.Tenants)
	planH := handlers.NewPlanHandler(deps.Plans)
	customerH := handlers.NewCustomerHandler(deps.Customers)
	subH := handlers.NewSubscriptionHandler(deps.Subscriptions, deps.Plans, deps.Customers)
	ledgerSvc := ledger.NewService(deps.Ledger)
	ledgerH := handlers.NewLedgerHandler(ledgerSvc)
	finopsSvc := finops.NewService(deps.Ledger, deps.Subscriptions)
	finopsH := handlers.NewFinOpsHandler(finopsSvc)
	webhookH := handlers.NewWebhookHandler(deps.Webhooks)

	// Auth (public)
	r.Post("/v1/auth/login", authH.Login)
	r.Post("/v1/auth/refresh", authH.Refresh)

	// Dashboard API — JWT auth
	r.Group(func(r chi.Router) {
		r.Use(middleware.JWTAuth(jwtSecret, deps.Tenants))

		// Plans
		r.Post("/v1/plans", planH.Create)
		r.Get("/v1/plans", planH.List)
		r.Get("/v1/plans/{id}", planH.Get)
		r.Patch("/v1/plans/{id}", planH.Update)
		r.Delete("/v1/plans/{id}", planH.Deactivate)

		// Customers
		r.Post("/v1/customers", customerH.Create)
		r.Get("/v1/customers", customerH.List)
		r.Get("/v1/customers/{id}", customerH.Get)
		r.Patch("/v1/customers/{id}", customerH.Update)
		r.Post("/v1/customers/{id}/archive", customerH.Archive)
		r.Get("/v1/customers/{id}/portal-token", customerH.GeneratePortalToken)

		// Subscriptions
		r.Post("/v1/subscriptions", subH.Create)
		r.Get("/v1/subscriptions", subH.List)
		r.Get("/v1/subscriptions/{id}", subH.Get)
		r.Post("/v1/subscriptions/{id}/cancel", subH.Cancel)
		r.Post("/v1/subscriptions/{id}/pause", subH.Pause)
		r.Post("/v1/subscriptions/{id}/resume", subH.Resume)

		// Ledger
		r.Get("/v1/ledger", ledgerH.List)
		r.Get("/v1/ledger/summary", ledgerH.Summary)
		r.Get("/v1/ledger/{id}", ledgerH.Get)

		// Finance
		r.Get("/v1/finance/mrr", finopsH.MRR)
		r.Get("/v1/finance/arr", finopsH.ARR)
		r.Get("/v1/finance/churn", finopsH.Churn)
		r.Get("/v1/finance/dunning-recovery", finopsH.DunningRecovery)
		r.Get("/v1/finance/revenue-report", finopsH.RevenueReport)

		// Webhooks
		r.Post("/v1/webhooks/endpoints", webhookH.CreateEndpoint)
		r.Get("/v1/webhooks/endpoints", webhookH.ListEndpoints)
		r.Patch("/v1/webhooks/endpoints/{id}", webhookH.UpdateEndpoint)
		r.Delete("/v1/webhooks/endpoints/{id}", webhookH.DeleteEndpoint)
		r.Get("/v1/webhooks/logs", webhookH.ListDeliveries)
		r.Post("/v1/webhooks/logs/{id}/retry", webhookH.RetryDelivery)
	})

	// Platform API — API key auth
	r.Group(func(r chi.Router) {
		r.Use(middleware.APIKeyAuth(deps.Tenants))

		r.Post("/v1/platform/customers", customerH.Create)
		r.Get("/v1/platform/customers/{id}", customerH.Get)
		r.Get("/v1/platform/customers/{id}/portal-token", customerH.GeneratePortalToken)
		r.Post("/v1/platform/plans", planH.Create)
		r.Get("/v1/platform/plans/{id}", planH.Get)
		r.Post("/v1/platform/subscriptions", subH.Create)
		r.Get("/v1/platform/subscriptions/{id}", subH.Get)
		r.Post("/v1/platform/subscriptions/{id}/cancel", subH.Cancel)
		r.Post("/v1/platform/subscriptions/{id}/pause", subH.Pause)
		r.Post("/v1/platform/subscriptions/{id}/resume", subH.Resume)
		r.Get("/v1/ledger", ledgerH.List)
		r.Get("/v1/ledger/summary", ledgerH.Summary)
		r.Get("/v1/finance/mrr", finopsH.MRR)
		r.Get("/v1/finance/arr", finopsH.ARR)
		r.Get("/v1/finance/churn", finopsH.Churn)
		r.Get("/v1/finance/revenue-report", finopsH.RevenueReport)
	})

	return r
}

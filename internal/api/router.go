package api

import (
	"net/http"
	"os"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/handlers"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/finops"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/ledger"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/webhook"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/payment"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/email"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/httprate"
)

type Deps struct {
	Tenants            domain.TenantRepository
	Customers          domain.CustomerRepository
	Plans              domain.PlanRepository
	Subscriptions      domain.SubscriptionRepository
	Invoices           domain.InvoiceRepository
	Ledger             domain.LedgerRepository
	Jobs               domain.JobRepository
	Webhooks           domain.WebhookRepository
	Tokens             domain.TokenRevoker
	Payment            payment.NombaClient
	EmailVerifications domain.EmailVerificationRepository
	EmailClient        *email.ResendClient
	Pool *pgxpool.Pool
}

// maxBodySize limits request bodies to 1MB to prevent OOM attacks.
func maxBodySize(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1MB
		next.ServeHTTP(w, r)
	})
}

// tenantRateLimiter returns a per-tenant rate limiter.
// Falls back to IP if no tenant is in context (should not happen in auth groups).
func tenantRateLimiter(limit int) func(http.Handler) http.Handler {
	return httprate.Limit(
		limit,
		60,
		httprate.WithKeyFuncs(func(r *http.Request) (string, error) {
			tenant := middleware.GetTenant(r.Context())
			if tenant == nil {
				return r.RemoteAddr, nil
			}
			return "tenant:" + tenant.ID.String(), nil
		}),
	)
}

func NewRouter(deps Deps) http.Handler {
	r := chi.NewRouter()

	jwtSecret := os.Getenv("JWT_SECRET")

	// Global middleware
	r.Use(chimiddleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.RequestLogger)
	r.Use(corsMiddleware)
	r.Use(maxBodySize)
	r.Use(httprate.LimitByIP(100, 60)) // global IP-based limit

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
systemHealthH := handlers.NewSystemHealthHandler(deps.Pool, deps.Jobs)
r.Get("/health", systemHealthH.Check)
r.Get("/v1/status", systemHealthH.Check)

	// Handlers
	authH := handlers.NewAuthHandler(deps.Tenants, deps.Tokens, deps.EmailVerifications, deps.EmailClient)
	planH := handlers.NewPlanHandler(deps.Plans)
	customerH := handlers.NewCustomerHandler(deps.Customers)
	dispatcher := webhook.NewDispatcher(deps.Webhooks, deps.Jobs)
	subH := handlers.NewSubscriptionHandler(deps.Subscriptions, deps.Plans, deps.Customers, dispatcher, deps.Jobs)
	ledgerSvc := ledger.NewService(deps.Ledger)
	ledgerH := handlers.NewLedgerHandler(ledgerSvc)
	finopsSvc := finops.NewService(deps.Ledger, deps.Subscriptions)
	finopsH := handlers.NewFinOpsHandler(finopsSvc)
	webhookH := handlers.NewWebhookHandler(deps.Webhooks)
	healthH := handlers.NewHealthHandler(deps.Subscriptions, deps.Plans)
	checkoutH := handlers.NewCheckoutHandler(deps.Customers, deps.Plans, deps.Subscriptions, deps.Jobs, deps.Payment)
	apiKeyH := handlers.NewAPIKeyHandler(deps.Tenants)

	// Public routes — no auth
	r.Post("/v1/auth/register", authH.Register)
	r.Post("/v1/auth/login", authH.Login)
	r.Post("/v1/auth/refresh", authH.Refresh)
	portalH := handlers.NewPortalHandler(deps.Customers, deps.Subscriptions, deps.Plans)
r.Group(func(r chi.Router) {
    r.Get("/v1/portal", portalH.GetPortalData)
    r.Post("/v1/portal/subscriptions/{id}/cancel", portalH.PortalCancel)
    r.Post("/v1/portal/subscriptions/{id}/pause", portalH.PortalPause)
    r.Post("/v1/portal/subscriptions/{id}/resume", portalH.PortalResume)
})

	// Dashboard API — JWT auth + per-tenant rate limiting
	r.Group(func(r chi.Router) {
		r.Use(middleware.JWTAuth(jwtSecret, deps.Tenants, deps.Tokens))
		r.Use(tenantRateLimiter(300)) // 300 req/min per tenant

		r.Get("/v1/me", authH.Me)
		r.Patch("/v1/me", authH.UpdateMe)
		r.Post("/v1/auth/logout", authH.Logout)
		r.Patch("/v1/dunning-config", authH.UpdateDunningConfig)

		r.Post("/v1/auth/verify-email", authH.VerifyEmail)
		r.Post("/v1/auth/resend-verification", authH.ResendVerification)

		r.Post("/v1/checkout", checkoutH.CreateCheckout)

		r.Get("/v1/health", healthH.GetPortfolioHealth)
		metricsH := handlers.NewMetricsHandler(deps.Subscriptions, deps.Jobs, ledgerSvc, finopsSvc)
		r.Get("/v1/metrics", metricsH.GetMetrics)
		r.Get("/v1/health/forecast", healthH.GetRevenueForecast)
		r.Get("/v1/ledger/monthly", ledgerH.MonthlyRevenue)

		r.Get("/v1/api-keys", apiKeyH.GetAPIKeyHint)
		r.Post("/v1/api-keys", apiKeyH.CreateAPIKey)
		r.Post("/v1/api-keys/rotate", apiKeyH.RotateAPIKey)

		r.Post("/v1/plans", planH.Create)
		r.Get("/v1/plans", planH.List)
		r.Get("/v1/plans/{id}", planH.Get)
		r.Patch("/v1/plans/{id}", planH.Update)
		r.Delete("/v1/plans/{id}", planH.Deactivate)

		invoiceH := handlers.NewInvoiceHandler(deps.Invoices)
		r.Get("/v1/invoices", invoiceH.List)
		r.Get("/v1/invoices/{id}", invoiceH.Get)
		r.Get("/v1/subscriptions/{id}/invoices", invoiceH.ListBySubscription)

		r.Post("/v1/customers", customerH.Create)
		r.Get("/v1/customers", customerH.List)
		r.Get("/v1/customers/{id}", customerH.Get)
		r.Patch("/v1/customers/{id}", customerH.Update)
		r.Post("/v1/customers/{id}/archive", customerH.Archive)
		r.Get("/v1/customers/{id}/portal-token", customerH.GeneratePortalToken)

		r.Post("/v1/subscriptions", subH.Create)
		r.Get("/v1/subscriptions", subH.List)
		r.Get("/v1/subscriptions/{id}", subH.Get)
		r.Post("/v1/subscriptions/{id}/cancel", subH.Cancel)
		r.Post("/v1/subscriptions/{id}/pause", subH.Pause)
		r.Post("/v1/subscriptions/{id}/resume", subH.Resume)
		ledgerSvcForPlanChange := ledger.NewService(deps.Ledger)
		planChangeH := handlers.NewPlanChangeHandler(deps.Subscriptions, deps.Plans, ledgerSvcForPlanChange)
		r.Patch("/v1/subscriptions/{id}/plan", planChangeH.ChangePlan)
		r.Post("/v1/subscriptions/{id}/checkout", checkoutH.RegenerateCheckout)
		refundH := handlers.NewRefundHandler(deps.Subscriptions, deps.Invoices, ledgerSvc, deps.Payment)
		r.Post("/v1/subscriptions/{id}/refund", refundH.IssueRefund)

		// In Platform API group — add after platform subscription routes
		r.Patch("/v1/platform/subscriptions/{id}/plan", planChangeH.ChangePlan)
		r.Post("/v1/platform/subscriptions/{id}/checkout", checkoutH.RegenerateCheckout)
		r.Post("/v1/platform/subscriptions/{id}/refund", refundH.IssueRefund)

		r.Get("/v1/ledger", ledgerH.List)
		r.Get("/v1/ledger/summary", ledgerH.Summary)
		r.Get("/v1/ledger/{id}", ledgerH.Get)

		r.Get("/v1/finance/mrr", finopsH.MRR)
		r.Get("/v1/finance/arr", finopsH.ARR)
		r.Get("/v1/finance/churn", finopsH.Churn)
		r.Get("/v1/finance/dunning-recovery", finopsH.DunningRecovery)
		r.Get("/v1/finance/revenue-report", finopsH.RevenueReport)

		r.Post("/v1/webhooks/endpoints", webhookH.CreateEndpoint)
		r.Get("/v1/webhooks/endpoints", webhookH.ListEndpoints)
		r.Patch("/v1/webhooks/endpoints/{id}", webhookH.UpdateEndpoint)
		r.Delete("/v1/webhooks/endpoints/{id}", webhookH.DeleteEndpoint)
		r.Get("/v1/webhooks/logs", webhookH.ListDeliveries)
		r.Post("/v1/webhooks/logs/{id}/retry", webhookH.RetryDelivery)
	})

	// Platform API — API key auth + per-tenant rate limiting
	r.Group(func(r chi.Router) {
		r.Use(middleware.APIKeyAuth(deps.Tenants))
		r.Use(tenantRateLimiter(600)) // 600 req/min per tenant for server-to-server

		r.Post("/v1/platform/checkout", checkoutH.CreateCheckout)
		r.Get("/v1/platform/customers", customerH.List)

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
	})
		nombaWebhookH := handlers.NewNombaWebhookHandler(
    deps.Subscriptions, deps.Tokens, deps.Plans, deps.Invoices,
    ledger.NewService(deps.Ledger), deps.Payment, dispatcher,
)
		r.Post("/v1/nomba/webhook", nombaWebhookH.Handle)
		r.Get("/v1/nomba/webhook", func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(`{"status":"ok"}`))
		})


	return r
}

func corsMiddleware(next http.Handler) http.Handler {
	allowed := map[string]bool{
		"http://localhost:3000":                            true,
		"http://localhost:3001":                            true,
		"https://frontend-production-e3be.up.railway.app": true,
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// Security headers on every response
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")

		// CORS — only allow known origins
		if allowed[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, X-Request-ID")
			w.Header().Set("Access-Control-Max-Age", "86400")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

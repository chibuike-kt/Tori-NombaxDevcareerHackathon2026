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
	Pool               *pgxpool.Pool
	Members            domain.MemberRepository
	Invitations        domain.InvitationRepository
	Audit              domain.AuditRepository
	APIKeys            domain.APIKeyRepository
	Sessions           domain.SessionRepository
	PromoCodes         domain.PromoCodeRepository
	EmailTemplates     domain.EmailTemplateRepository
	OAuth              domain.OAuthRepository
	Payouts            domain.PayoutRepository
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
	authH := handlers.NewAuthHandler(deps.Tenants, deps.Tokens, deps.Sessions, deps.EmailVerifications, deps.EmailClient, deps.Members, deps.APIKeys)
	planH := handlers.NewPlanHandler(deps.Plans)
	customerH := handlers.NewCustomerHandler(deps.Customers)
	dispatcher := webhook.NewDispatcher(deps.Webhooks, deps.Jobs).
		WithMerchantEmail(deps.Customers, deps.Subscriptions, deps.Plans, deps.Tenants, deps.EmailTemplates, deps.EmailClient)
	subH := handlers.NewSubscriptionHandler(deps.Subscriptions, deps.Plans, deps.Customers, dispatcher, deps.Jobs)
	ledgerSvc := ledger.NewService(deps.Ledger)
	ledgerH := handlers.NewLedgerHandler(ledgerSvc)
	finopsSvc := finops.NewService(deps.Ledger, deps.Subscriptions, deps.Plans)
	finopsH := handlers.NewFinOpsHandler(finopsSvc, deps.Subscriptions, deps.Customers, deps.Plans)
	webhookH := handlers.NewWebhookHandler(deps.Webhooks, dispatcher)
	healthH := handlers.NewHealthHandler(deps.Subscriptions, deps.Plans)
	checkoutH := handlers.NewCheckoutHandler(deps.Customers, deps.Plans, deps.Subscriptions, deps.Jobs, deps.Payment, deps.PromoCodes)
	teamH := handlers.NewTeamHandler(deps.Members, deps.Invitations, deps.Audit, deps.Tenants, deps.EmailClient)
	apiKeyH := handlers.NewAPIKeyHandler(deps.Tenants, deps.APIKeys)
	promoCodeH := handlers.NewPromoCodeHandler(deps.PromoCodes, deps.Plans)
	emailTemplateH := handlers.NewEmailTemplateHandler(deps.EmailTemplates, deps.Tenants, deps.EmailClient)
	planChangeH := handlers.NewPlanChangeHandler(deps.Subscriptions, deps.Plans, ledgerSvc)
	refundH := handlers.NewRefundHandler(deps.Subscriptions, deps.Invoices, ledgerSvc, deps.Payment)
	oauthH := handlers.NewOAuthHandler(deps.OAuth)
	payoutH := handlers.NewPayoutHandler(deps.Payouts, deps.Payment, deps.Jobs, finopsSvc)

	// Public routes — no auth
	r.Post("/v1/auth/register", authH.Register)
	r.Post("/v1/auth/login", authH.Login)
	r.Post("/v1/auth/refresh", authH.Refresh)
	r.Post("/v1/team/invitations/accept", teamH.AcceptInvite)
	r.Post("/v1/oauth/token", oauthH.IssueToken)
	portalH := handlers.NewPortalHandler(deps.Customers, deps.Subscriptions, deps.Plans)
r.Group(func(r chi.Router) {
    r.Get("/v1/portal", portalH.GetPortalData)
    r.Post("/v1/portal/subscriptions/{id}/cancel", portalH.PortalCancel)
    r.Post("/v1/portal/subscriptions/{id}/pause", portalH.PortalPause)
    r.Post("/v1/portal/subscriptions/{id}/resume", portalH.PortalResume)
})

	// Dashboard API — JWT auth + per-tenant rate limiting
	r.Group(func(r chi.Router) {
		r.Use(middleware.JWTAuth(jwtSecret, deps.Tenants, deps.Tokens, deps.Sessions))
		r.Use(tenantRateLimiter(300)) // 300 req/min per tenant

		r.Get("/v1/me", authH.Me)
		r.Patch("/v1/me", authH.UpdateMe)
		r.Post("/v1/auth/logout", authH.Logout)
		r.Patch("/v1/dunning-config", authH.UpdateDunningConfig)

		r.Post("/v1/auth/verify-email", authH.VerifyEmail)
		r.Post("/v1/auth/resend-verification", authH.ResendVerification)
		r.Get("/v1/auth/sessions", authH.ListSessions)
		r.With(middleware.RequireRole("owner", "admin")).Delete("/v1/auth/sessions/{id}", authH.RevokeSession)

		r.Post("/v1/checkout", checkoutH.CreateCheckout)

		r.Get("/v1/health", healthH.GetPortfolioHealth)
		metricsH := handlers.NewMetricsHandler(deps.Subscriptions, deps.Jobs, ledgerSvc, finopsSvc)
		r.Get("/v1/metrics", metricsH.GetMetrics)
		r.Get("/v1/health/forecast", healthH.GetRevenueForecast)
		r.Get("/v1/ledger/monthly", ledgerH.MonthlyRevenue)

		r.With(middleware.RequireRole("owner", "admin", "developer")).Get("/v1/api-keys", apiKeyH.GetAPIKeyHints)
		r.With(middleware.RequireRole("owner", "admin", "developer")).Post("/v1/api-keys", apiKeyH.CreateAPIKey)
		r.With(middleware.RequireRole("owner", "admin", "developer")).Post("/v1/api-keys/rotate", apiKeyH.RotateAPIKey)
		r.With(middleware.RequireRole("owner", "admin", "developer")).Post("/v1/api-keys/test", apiKeyH.CreateTestAPIKey)
		r.With(middleware.RequireRole("owner", "admin", "developer")).Delete("/v1/api-keys/{mode}", apiKeyH.RevokeAPIKey)

		r.With(middleware.RequireRole("owner", "admin", "developer")).Post("/v1/oauth/clients", oauthH.CreateClient)
		r.With(middleware.RequireRole("owner", "admin", "developer")).Get("/v1/oauth/clients", oauthH.ListClients)
		r.With(middleware.RequireRole("owner", "admin", "developer")).Delete("/v1/oauth/clients/{id}", oauthH.RevokeClient)

		r.With(middleware.RequireRole("owner", "admin")).Post("/v1/plans", planH.Create)
		r.Get("/v1/plans", planH.List)
		r.Get("/v1/plans/{id}", planH.Get)
		r.With(middleware.RequireRole("owner", "admin")).Patch("/v1/plans/{id}", planH.Update)
		r.With(middleware.RequireRole("owner", "admin")).Delete("/v1/plans/{id}", planH.Deactivate)

		r.With(middleware.RequireRole("owner", "admin")).Post("/v1/promo-codes", promoCodeH.Create)
		r.Get("/v1/promo-codes", promoCodeH.List)
		r.With(middleware.RequireRole("owner", "admin")).Delete("/v1/promo-codes/{id}", promoCodeH.Deactivate)

		r.Get("/v1/email-templates", emailTemplateH.List)
		r.With(middleware.RequireRole("owner", "admin")).Put("/v1/email-templates/{event_type}", emailTemplateH.Update)
		r.With(middleware.RequireRole("owner", "admin")).Post("/v1/email-templates/{event_type}/test", emailTemplateH.SendTest)

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
		r.With(middleware.RequireRole("owner", "admin")).Post("/v1/subscriptions/{id}/cancel", subH.Cancel)
		r.With(middleware.RequireRole("owner", "admin")).Post("/v1/subscriptions/{id}/pause", subH.Pause)
		r.With(middleware.RequireRole("owner", "admin")).Post("/v1/subscriptions/{id}/resume", subH.Resume)
		r.With(middleware.RequireRole("owner", "admin")).Post("/v1/subscriptions/{id}/recover", subH.Recover)
		r.Get("/v1/subscriptions/{id}/transitions", subH.ListTransitions)
		r.Patch("/v1/subscriptions/{id}/plan", planChangeH.ChangePlan)
		r.Post("/v1/subscriptions/{id}/checkout", checkoutH.RegenerateCheckout)
		r.With(middleware.RequireRole("owner", "admin")).Post("/v1/subscriptions/{id}/refund", refundH.IssueRefund)
		r.With(middleware.RequireRole("owner", "admin")).Post("/v1/subscriptions/{id}/retry-now", subH.RetryNow)
		r.With(middleware.RequireRole("owner", "admin")).Post("/v1/subscriptions/{id}/send-pay-link", subH.SendPayLink)

		r.Get("/v1/ledger", ledgerH.List)
		r.Get("/v1/ledger/summary", ledgerH.Summary)
		r.Get("/v1/ledger/{id}", ledgerH.Get)

		r.Get("/v1/finance/balance", finopsH.Balance)
		r.Get("/v1/finance/mrr", finopsH.MRR)
		r.Get("/v1/finance/arr", finopsH.ARR)
		r.Get("/v1/finance/churn", finopsH.Churn)
		r.Get("/v1/finance/dunning-recovery", finopsH.DunningRecovery)
		r.Get("/v1/finance/revenue-report", finopsH.RevenueReport)
		r.Get("/v1/finance/recovery-center", finopsH.RecoveryCenter)

		r.With(middleware.RequireRole("owner", "admin")).Post("/v1/payouts", payoutH.Create)
		r.Get("/v1/payouts", payoutH.List)
		r.Get("/v1/payouts/banks", payoutH.ListBanks)
		r.Get("/v1/payouts/resolve-account", payoutH.ResolveAccount)
		r.Get("/v1/payouts/{id}", payoutH.Get)

		r.With(middleware.RequireRole("owner", "admin", "developer")).Post("/v1/webhooks/endpoints", webhookH.CreateEndpoint)
		r.With(middleware.RequireRole("owner", "admin", "developer")).Get("/v1/webhooks/endpoints", webhookH.ListEndpoints)
		r.With(middleware.RequireRole("owner", "admin", "developer")).Patch("/v1/webhooks/endpoints/{id}", webhookH.UpdateEndpoint)
		r.With(middleware.RequireRole("owner", "admin", "developer")).Delete("/v1/webhooks/endpoints/{id}", webhookH.DeleteEndpoint)
		r.With(middleware.RequireRole("owner", "admin", "developer")).Get("/v1/webhooks/logs", webhookH.ListDeliveries)
		r.With(middleware.RequireRole("owner", "admin", "developer")).Post("/v1/webhooks/logs/{id}/retry", webhookH.RetryDelivery)
		// Team management
		r.Get("/v1/team/members", teamH.ListMembers)
		r.With(middleware.RequireRole("owner")).Post("/v1/team/members/invite", teamH.InviteMember)
		r.With(middleware.RequireRole("owner")).Patch("/v1/team/members/{id}/role", teamH.UpdateMemberRole)
		r.With(middleware.RequireRole("owner")).Delete("/v1/team/members/{id}", teamH.RemoveMember)
		r.With(middleware.RequireRole("owner")).Delete("/v1/team/invitations/{id}", teamH.RevokeInvitation)
		r.Get("/v1/team/audit-log", teamH.ListAuditLog)
	})

	// Platform API — API key auth + per-tenant rate limiting
	r.Group(func(r chi.Router) {
		r.Use(middleware.PlatformAuth(deps.Tenants, deps.APIKeys, deps.OAuth))
		r.Use(tenantRateLimiter(600)) // 600 req/min per tenant for server-to-server

		r.Post("/v1/platform/checkout", checkoutH.CreateCheckout)
		r.Get("/v1/platform/customers", customerH.List)

		r.Post("/v1/platform/customers", customerH.Create)
		r.Get("/v1/platform/customers/{id}", customerH.Get)
		r.Get("/v1/platform/customers/{id}/portal-token", customerH.GeneratePortalToken)

		r.Post("/v1/platform/plans", planH.Create)
		r.Get("/v1/platform/plans", planH.List)
		r.Get("/v1/platform/plans/{id}", planH.Get)

		r.Post("/v1/platform/subscriptions", subH.Create)
		r.Get("/v1/platform/subscriptions", subH.List)
		r.Get("/v1/platform/subscriptions/{id}", subH.Get)
		r.Post("/v1/platform/subscriptions/{id}/cancel", subH.Cancel)
		r.Post("/v1/platform/subscriptions/{id}/pause", subH.Pause)
		r.Post("/v1/platform/subscriptions/{id}/resume", subH.Resume)
		r.Post("/v1/platform/subscriptions/{id}/recover", subH.Recover)
		r.Patch("/v1/platform/subscriptions/{id}/plan", planChangeH.ChangePlan)
		r.Post("/v1/platform/subscriptions/{id}/checkout", checkoutH.RegenerateCheckout)
		r.Post("/v1/platform/subscriptions/{id}/refund", refundH.IssueRefund)
	})
		nombaWebhookH := handlers.NewNombaWebhookHandler(
    deps.Subscriptions, deps.Tokens, deps.Plans, deps.Invoices,
    ledger.NewService(deps.Ledger), deps.Payment, dispatcher, deps.Jobs, deps.Customers,
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
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, X-Request-ID, X-Tori-Mode")
			w.Header().Set("Access-Control-Max-Age", "86400")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

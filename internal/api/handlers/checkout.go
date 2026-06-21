package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	apicontext "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/context"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/billing"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type CheckoutHandler struct {
	customers domain.CustomerRepository
	plans     domain.PlanRepository
	subs      domain.SubscriptionRepository
	jobs      domain.JobRepository
}

func NewCheckoutHandler(
	customers domain.CustomerRepository,
	plans domain.PlanRepository,
	subs domain.SubscriptionRepository,
	jobs domain.JobRepository,
) *CheckoutHandler {
	return &CheckoutHandler{
		customers: customers,
		plans:     plans,
		subs:      subs,
		jobs:      jobs,
	}
}

type checkoutRequest struct {
	Email          string  `json:"email"`
	PlanID         string  `json:"plan_id"`
	Name           *string `json:"name"`
	ExternalID     *string `json:"external_id"`
	IdempotencyKey *string `json:"idempotency_key"`
}

type checkoutResponse struct {
	Customer        *domain.Customer     `json:"customer"`
	Subscription    *domain.Subscription `json:"subscription"`
	CustomerCreated bool                 `json:"customer_created"`
}

// CreateCheckout is the one-call path to start a subscription.
// Pass an email and plan_id. Tori finds or creates the customer automatically.
// No separate customer creation call needed from the integrator.
func (h *CheckoutHandler) CreateCheckout(w http.ResponseWriter, r *http.Request) {
	tenantID := apicontext.GetTenantID(r.Context())
	if tenantID == uuid.Nil {
		respond.Unauthorised(w, r, "missing tenant")
		return
	}

	var req checkoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}

	if req.Email == "" {
		respond.BadRequest(w, r, "missing_field", "email is required")
		return
	}
	if req.PlanID == "" {
		respond.BadRequest(w, r, "missing_field", "plan_id is required")
		return
	}

	planID, err := uuid.Parse(req.PlanID)
	if err != nil {
		respond.BadRequest(w, r, "invalid_field", "plan_id is not a valid UUID")
		return
	}

	plan, err := h.plans.GetByID(r.Context(), planID, tenantID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			respond.NotFound(w, r)
			return
		}
		respond.InternalError(w, r, err)
		return
	}
	if !plan.IsActive {
		respond.UnprocessableEntity(w, r, "plan_inactive", "this plan is no longer accepting new subscriptions")
		return
	}

	// Find or create customer — the whole point of this endpoint.
	// Integrator passes email. Tori handles the rest.
	customerCreated := false
	customer, err := h.customers.GetByEmail(r.Context(), tenantID, req.Email)
	if err != nil {
		if !errors.Is(err, domain.ErrNotFound) {
			respond.InternalError(w, r, err)
			return
		}
		customer, err = h.customers.Create(
			r.Context(),
			tenantID,
			req.ExternalID,
			req.Email,
			req.Name,
			nil,
			nil,
		)
		if err != nil {
			respond.InternalError(w, r, err)
			return
		}
		customerCreated = true
		log.Info().
			Str("tenant_id", tenantID.String()).
			Str("customer_id", customer.ID.String()).
			Str("email", req.Email).
			Msg("customer auto-created via checkout")
	}

	// Idempotency check — return existing sub if key already used
	if req.IdempotencyKey != nil {
		existing, err := h.subs.GetByIdempotencyKey(r.Context(), *req.IdempotencyKey, tenantID)
		if err == nil && existing != nil {
			respond.JSON(w, r, http.StatusOK, checkoutResponse{
				Customer:        customer,
				Subscription:    existing,
				CustomerCreated: false,
			})
			return
		}
	}

	// Compute billing period
	now := time.Now().UTC()
	var periodEnd time.Time
	var trialEnd *time.Time

	if plan.TrialPeriodDays > 0 {
		te := now.AddDate(0, 0, plan.TrialPeriodDays)
		trialEnd = &te
		periodEnd = te
	} else {
		_, periodEnd, err = billing.NextPeriod(now, plan)
		if err != nil {
			respond.InternalError(w, r, err)
			return
		}
	}

	initialStatus := domain.StatusActive
	if plan.TrialPeriodDays > 0 {
		initialStatus = domain.StatusTrialing
	}

	sub, err := h.subs.Create(
		r.Context(),
		tenantID,
		customer.ID,
		plan.ID,
		initialStatus,
		now,
		periodEnd,
		trialEnd,
		req.IdempotencyKey,
		nil,
	)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	// Enqueue trial expiry job so the worker activates it automatically
	if plan.TrialPeriodDays > 0 && trialEnd != nil {
		payload, _ := json.Marshal(map[string]string{
			"subscription_id": sub.ID.String(),
			"tenant_id":       tenantID.String(),
		})
		_, _ = h.jobs.Enqueue(
			r.Context(),
			&tenantID,
			domain.JobExpireTrial,
			payload,
			*trialEnd,
			3,
		)
	}

	log.Info().
		Str("tenant_id", tenantID.String()).
		Str("subscription_id", sub.ID.String()).
		Str("customer_id", customer.ID.String()).
		Bool("customer_created", customerCreated).
		Msg("checkout completed")

	respond.JSON(w, r, http.StatusCreated, checkoutResponse{
		Customer:        customer,
		Subscription:    sub,
		CustomerCreated: customerCreated,
	})
}

package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/billing"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/payment"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/go-chi/chi/v5"
)

type CheckoutHandler struct {
	customers domain.CustomerRepository
	plans     domain.PlanRepository
	subs      domain.SubscriptionRepository
	jobs      domain.JobRepository
	payment   payment.NombaClient
}

func NewCheckoutHandler(
	customers domain.CustomerRepository,
	plans domain.PlanRepository,
	subs domain.SubscriptionRepository,
	jobs domain.JobRepository,
	paymentClient payment.NombaClient,
) *CheckoutHandler {
	return &CheckoutHandler{
		customers: customers,
		plans:     plans,
		subs:      subs,
		jobs:      jobs,
		payment:   paymentClient,
	}
}

type checkoutRequest struct {
	Email          string  `json:"email"`
	PlanID         string  `json:"plan_id"`
	Name           *string `json:"name"`
	ExternalID     *string `json:"external_id"`
	IdempotencyKey *string `json:"idempotency_key"`
	CallbackURL    *string `json:"callback_url"`
}

type checkoutResponse struct {
	Customer              *domain.Customer     `json:"customer"`
	Subscription          *domain.Subscription `json:"subscription"`
	CustomerCreated       bool                 `json:"customer_created"`
	CheckoutURL           string               `json:"checkout_url,omitempty"`
	RequiresPaymentMethod bool                 `json:"requires_payment_method"`
}

func (h *CheckoutHandler) CreateCheckout(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
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

	// Find or create customer
	customerCreated := false
	customer, err := h.customers.GetByEmail(r.Context(), tenantID, req.Email)
	if err != nil {
		if !errors.Is(err, domain.ErrNotFound) {
			respond.InternalError(w, r, err)
			return
		}
		customer, err = h.customers.Create(
			r.Context(), tenantID, req.ExternalID,
			req.Email, req.Name, nil, nil,
		)
		if err != nil {
			respond.InternalError(w, r, err)
			return
		}
		customerCreated = true
		log.Info().
			Str("tenant_id", tenantID.String()).
			Str("customer_id", customer.ID.String()).
			Str("email", middleware.MaskEmail(req.Email)).
			Msg("customer auto-created via checkout")
	}

	// Idempotency check — return existing subscription if key already used
	if req.IdempotencyKey != nil {
		existing, err := h.subs.GetByIdempotencyKey(r.Context(), *req.IdempotencyKey, tenantID)
		if err == nil && existing != nil {
			respond.JSON(w, r, http.StatusOK, checkoutResponse{
				Customer:              customer,
				Subscription:          existing,
				CustomerCreated:       false,
				RequiresPaymentMethod: existing.TokenKey == "",
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

initialStatus := domain.StatusPendingPayment // always start pending
if plan.TrialPeriodDays > 0 {
    initialStatus = domain.StatusTrialing
}

	sub, err := h.subs.Create(
		r.Context(), tenantID, customer.ID, plan.ID,
		initialStatus, now, periodEnd, trialEnd,
		req.IdempotencyKey, nil,
	)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	// Enqueue trial expiry job so the worker charges the card when trial ends
	if plan.TrialPeriodDays > 0 && trialEnd != nil {
		payload, _ := json.Marshal(map[string]string{
			"subscription_id": sub.ID.String(),
			"tenant_id":       tenantID.String(),
		})
		_, _ = h.jobs.Enqueue(r.Context(), &tenantID, domain.JobExpireTrial,
			payload, *trialEnd, 3)
	}

	// Build callback URL — use developer's URL if provided, else Tori success page
	frontendBase := os.Getenv("NEXT_PUBLIC_API_URL")
	if frontendBase == "" {
		frontendBase = "http://localhost:3001"
	}
	callbackURL := fmt.Sprintf("%s/payment/success?sub=%s", frontendBase, sub.ID)
	if req.CallbackURL != nil && *req.CallbackURL != "" {
		callbackURL = fmt.Sprintf("%s?sub=%s&orderReference=%s", *req.CallbackURL, sub.ID, sub.ID)
	}

	// During a trial, charge ₦1 (100 kobo) to verify the card only.
	// The card is tokenised but the customer is not really charged the plan amount yet.
	// The real first charge fires automatically via ExpireTrial when the trial ends.
	// For no-trial plans, charge the full plan amount immediately — this IS the first payment.
	checkoutAmount := plan.Amount
	if plan.TrialPeriodDays > 0 {
			checkoutAmount = 100 // ₦1 card verification charge during trial — tokenises the card for recurring billing
	}

	// Create Nomba checkout session
	// subscription ID is the orderReference so we can match payment_success webhook back
	checkoutURL := ""
	nombaResp, err := h.payment.InitiateCheckout(r.Context(), payment.CheckoutRequest{
		CustomerEmail: customer.Email,
		CustomerID:    customer.ID.String(),
		Amount:        checkoutAmount,
		Currency:      plan.Currency,
		Reference:     sub.ID.String(),
		CallbackURL:   callbackURL,
		Metadata: map[string]string{
			"subscription_id":   sub.ID.String(),
			"plan_name":         plan.Name,
			"tenant_id":         tenantID.String(),
			"is_trial":          fmt.Sprintf("%v", plan.TrialPeriodDays > 0),
			"trial_period_days": fmt.Sprintf("%d", plan.TrialPeriodDays),
		},
	})
	if err != nil {
		// Don't fail the checkout if Nomba call fails — subscription is created
		// The developer can retry the payment separately
		log.Error().Err(err).
			Str("sub_id", sub.ID.String()).
			Msg("checkout: failed to create Nomba checkout session")
	} else {
		checkoutURL = nombaResp.CheckoutURL
		log.Info().
				Str("sub_id", sub.ID.String()).
				Str("checkout_url", checkoutURL).
				Bool("is_trial", plan.TrialPeriodDays > 0).
				Int("trial_days", plan.TrialPeriodDays).
				Int64("checkout_amount_kobo", checkoutAmount).
				Str("checkout_note", func() string {
						if plan.TrialPeriodDays > 0 {
								return "₦1 verification charge — tokenises card for recurring billing"
						}
						return "full plan amount charged immediately"
				}()).
				Msg("checkout: Nomba checkout session created")
	}

	log.Info().
		Str("tenant_id", tenantID.String()).
		Str("subscription_id", sub.ID.String()).
		Str("customer_id", customer.ID.String()).
		Bool("customer_created", customerCreated).
		Bool("requires_payment_method", checkoutURL != "").
		Msg("checkout completed")

	respond.JSON(w, r, http.StatusCreated, checkoutResponse{
		Customer:              customer,
		Subscription:          sub,
		CustomerCreated:       customerCreated,
		CheckoutURL:           checkoutURL,
		RequiresPaymentMethod: checkoutURL != "",
	})
}

func (h *CheckoutHandler) RegenerateCheckout(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == uuid.Nil {
		respond.Unauthorised(w, r, "missing tenant")
		return
	}

	subIDStr := chi.URLParam(r, "id")
	subID, err := uuid.Parse(subIDStr)
	if err != nil {
		respond.BadRequest(w, r, "invalid_field", "subscription id is not a valid UUID")
		return
	}

	sub, err := h.subs.GetByID(r.Context(), subID, tenantID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			respond.NotFound(w, r)
			return
		}
		respond.InternalError(w, r, err)
		return
	}

	// Only allow regeneration if tokenKey is not yet stored
	if sub.TokenKey != "" {
		respond.UnprocessableEntity(w, r, "already_has_payment_method",
			"this subscription already has a payment method on file")
		return
	}

	// Only allow on active billing states
	if sub.Status == domain.StatusCancelled || sub.Status == domain.StatusSuspended {
		respond.UnprocessableEntity(w, r, "invalid_status",
			"cannot regenerate checkout for a cancelled or suspended subscription")
		return
	}

	plan, err := h.plans.GetByID(r.Context(), sub.PlanID, tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	customer, err := h.customers.GetByID(r.Context(), tenantID, sub.CustomerID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	// Parse optional callback URL from request body
	var req struct {
		CallbackURL *string `json:"callback_url"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	frontendBase := os.Getenv("NEXT_PUBLIC_API_URL")
	if frontendBase == "" {
		frontendBase = "http://localhost:3001"
	}
	callbackURL := fmt.Sprintf("%s/payment/success?sub=%s", frontendBase, sub.ID)
	if req.CallbackURL != nil && *req.CallbackURL != "" {
		callbackURL = fmt.Sprintf("%s?sub=%s&orderReference=%s", *req.CallbackURL, sub.ID, sub.ID)
	}

	checkoutAmount := plan.Amount
	if plan.TrialPeriodDays > 0 && sub.Status == domain.StatusTrialing {
		checkoutAmount = 100 // ₦1 verification for trial
	}

	nombaResp, err := h.payment.InitiateCheckout(r.Context(), payment.CheckoutRequest{
		CustomerEmail: customer.Email,
		CustomerID:    customer.ID.String(),
		Amount:        checkoutAmount,
		Currency:      plan.Currency,
		Reference:     sub.ID.String(),
		CallbackURL:   callbackURL,
		Metadata: map[string]string{
			"subscription_id": sub.ID.String(),
			"plan_name":       plan.Name,
			"tenant_id":       tenantID.String(),
		},
	})
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	log.Info().
		Str("sub_id", sub.ID.String()).
		Str("checkout_url", nombaResp.CheckoutURL).
		Msg("checkout: regenerated checkout URL for subscription with no payment method")

	respond.JSON(w, r, http.StatusOK, map[string]interface{}{
		"checkout_url":            nombaResp.CheckoutURL,
		"requires_payment_method": true,
		"subscription_id":         sub.ID,
	})
}

package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"os"
	"strings"
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
	customers  domain.CustomerRepository
	plans      domain.PlanRepository
	subs       domain.SubscriptionRepository
	jobs       domain.JobRepository
	payment    payment.NombaClient
	promoCodes domain.PromoCodeRepository
}

func NewCheckoutHandler(
	customers domain.CustomerRepository,
	plans domain.PlanRepository,
	subs domain.SubscriptionRepository,
	jobs domain.JobRepository,
	paymentClient payment.NombaClient,
	promoCodes domain.PromoCodeRepository,
) *CheckoutHandler {
	return &CheckoutHandler{
		customers:  customers,
		plans:      plans,
		subs:       subs,
		jobs:       jobs,
		payment:    paymentClient,
		promoCodes: promoCodes,
	}
}

type checkoutRequest struct {
	Email          string  `json:"email"`
	PlanID         string  `json:"plan_id"`
	Name           *string `json:"name"`
	ExternalID     *string `json:"external_id"`
	IdempotencyKey *string `json:"idempotency_key"`
	CallbackURL    *string `json:"callback_url"`
	PromoCode      string  `json:"promo_code,omitempty"`
}

type checkoutResponse struct {
	Customer              *domain.Customer     `json:"customer"`
	Subscription          *domain.Subscription `json:"subscription"`
	CustomerCreated       bool                 `json:"customer_created"`
	CheckoutURL           string               `json:"checkout_url,omitempty"`
	ToriCheckoutURL       string               `json:"tori_checkout_url,omitempty"`
	RequiresPaymentMethod bool                 `json:"requires_payment_method"`
	PromoApplied          bool                 `json:"promo_applied,omitempty"`
	DiscountKobo          int64                `json:"discount_kobo,omitempty"`
	OriginalAmountKobo    int64                `json:"original_amount_kobo,omitempty"`
	FinalAmountKobo       int64                `json:"final_amount_kobo,omitempty"`
}

// extractCheckoutToken pulls the last path segment off a Nomba checkout URL
// — the token the Tori-branded checkout shell embeds in an iframe.
func extractCheckoutToken(checkoutURL string) string {
	u, err := url.Parse(checkoutURL)
	if err != nil {
		return ""
	}
	parts := strings.Split(strings.Trim(u.Path, "/"), "/")
	if len(parts) == 0 {
		return ""
	}
	return parts[len(parts)-1]
}

// buildToriCheckoutURL wraps a raw Nomba checkout link in Tori's branded
// checkout shell — a page showing the merchant/plan/amount before embedding
// the real Nomba checkout in an iframe. Returns "" if the checkout URL has
// no extractable token (e.g. checkout creation failed upstream).
func buildToriCheckoutURL(nombaCheckoutURL, merchantName, planName string, amountKobo int64) string {
	token := extractCheckoutToken(nombaCheckoutURL)
	if token == "" {
		return ""
	}
	base := os.Getenv("FRONTEND_URL")
	if base == "" {
		base = "https://frontend-production-e3be.up.railway.app"
	}
	amountNaira := fmt.Sprintf("%.2f", float64(amountKobo)/100)
	q := url.Values{}
	q.Set("merchant", merchantName)
	q.Set("plan", planName)
	q.Set("amount", amountNaira)
	// The real Nomba checkout link's base path varies by environment
	// (production vs. sandbox) — pass it through in full so the shell embeds
	// the exact URL Nomba issued rather than guessing a fixed base from the token.
	q.Set("nomba_url", nombaCheckoutURL)
	return fmt.Sprintf("%s/checkout/%s?%s", base, url.PathEscape(token), q.Encode())
}

// minChargeKobo is the floor a discounted checkout amount can never drop
// below — matches the ₦1 trial verification floor used elsewhere.
const minChargeKobo = 100

// validatePromoCode looks up and validates a promo code against a plan,
// returning the promo and the discount in kobo it grants against the plan's
// full price. A nil promo with no error means no code was provided.
func (h *CheckoutHandler) validatePromoCode(w http.ResponseWriter, r *http.Request, tenantID uuid.UUID, plan *domain.Plan, rawCode string) (promo *domain.PromoCode, discountKobo int64, ok bool) {
	if rawCode == "" {
		return nil, 0, true
	}

	code := strings.ToUpper(strings.TrimSpace(rawCode))
	p, err := h.promoCodes.GetByCode(r.Context(), tenantID, code)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			respond.BadRequest(w, r, "invalid_promo_code", "promo code does not exist")
			return nil, 0, false
		}
		respond.InternalError(w, r, err)
		return nil, 0, false
	}

	if !p.IsActive {
		respond.BadRequest(w, r, "promo_code_inactive", "this promo code is no longer active")
		return nil, 0, false
	}
	if p.ExpiresAt != nil && time.Now().UTC().After(*p.ExpiresAt) {
		respond.BadRequest(w, r, "promo_code_expired", "this promo code has expired")
		return nil, 0, false
	}
	if p.MaxUses != nil && p.UseCount >= *p.MaxUses {
		respond.BadRequest(w, r, "promo_code_depleted", "this promo code has reached its usage limit")
		return nil, 0, false
	}
	if p.PlanID != nil && *p.PlanID != plan.ID {
		respond.BadRequest(w, r, "promo_code_plan_mismatch", "this promo code does not apply to the selected plan")
		return nil, 0, false
	}

	if p.DiscountType == domain.DiscountTypePercentage {
		discountKobo = int64(math.Round(float64(plan.Amount) * float64(p.DiscountValue) / 100))
	} else {
		discountKobo = p.DiscountValue
	}
	if discountKobo > plan.Amount-minChargeKobo {
		discountKobo = plan.Amount - minChargeKobo
	}
	if discountKobo < 0 {
		discountKobo = 0
	}

	return p, discountKobo, true
}

func (h *CheckoutHandler) CreateCheckout(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == uuid.Nil {
		respond.Unauthorised(w, r, "missing tenant")
		return
	}
	// API-key requests get mode from the key prefix; JWT dashboard requests
	// get it from the X-Tori-Mode header set by the Live/Test toggle.
	mode := middleware.GetMode(r.Context())

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
	// A test-mode checkout must subscribe to a test-mode plan, and a
	// live-mode checkout to a live-mode plan. GetByID deliberately skips
	// mode filtering (workers need to look up resources with no mode
	// context), so this check is the only thing stopping a request from one
	// mode silently reusing a plan_id that belongs to the other — which
	// would create a subscription whose mode disagrees with its own plan.
	if plan.Mode != mode {
		respond.UnprocessableEntity(w, r, "plan_mode_mismatch",
			fmt.Sprintf("this plan belongs to %s mode — checkout is running in %s mode", plan.Mode, mode))
		return
	}

	promo, discountKobo, ok := h.validatePromoCode(w, r, tenantID, plan, req.PromoCode)
	if !ok {
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
			req.Email, req.Name, nil, nil, mode,
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
		req.IdempotencyKey, nil, discountKobo, mode,
	)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	if promo != nil {
		if err := h.promoCodes.IncrementUseCount(r.Context(), promo.ID); err != nil {
			log.Error().Err(err).Str("promo_code", promo.Code).Msg("checkout: failed to increment promo code use count")
		}
	}

	// Enqueue trial expiry job so the worker charges the card when trial ends
	if plan.TrialPeriodDays > 0 && trialEnd != nil {
		payload, _ := json.Marshal(map[string]string{
			"subscription_id": sub.ID.String(),
			"tenant_id":       tenantID.String(),
		})
		_, _ = h.jobs.Enqueue(r.Context(), &tenantID, domain.JobExpireTrial,
			payload, *trialEnd, 3, mode)

		// Warn the customer 3 days before the trial ends and a real charge fires.
		// If the trial is shorter than 3 days, this fires on the worker's next
		// poll instead of in the past.
		warnAt := trialEnd.AddDate(0, 0, -3)
		_, _ = h.jobs.Enqueue(r.Context(), &tenantID, domain.JobTrialEndingSoon,
			payload, warnAt, 3, mode)
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
	// A promo code discounts this immediate charge; it is not (yet) threaded into the
	// later ExpireTrial charge, since a trial's checkout amount is a flat verification
	// fee rather than the plan price.
	checkoutAmount := plan.Amount
	if plan.TrialPeriodDays > 0 {
			checkoutAmount = 100 // ₦1 card verification charge during trial — tokenises the card for recurring billing
	} else if promo != nil {
		checkoutAmount = plan.Amount - discountKobo
	}

	// Create Nomba checkout session
	// subscription ID is the orderReference so we can match payment_success webhook back
	checkoutURL := ""
	toriCheckoutURL := ""
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
		merchantName := ""
		if tenant := middleware.GetTenant(r.Context()); tenant != nil {
			merchantName = tenant.Name
		}
		toriCheckoutURL = buildToriCheckoutURL(checkoutURL, merchantName, plan.Name, checkoutAmount)
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

		// Test mode (test API key, or dashboard Live/Test toggle set to Test):
		// simulate the payment_success webhook after a short delay, since
		// Nomba's sandbox does not reliably fire one back to us.
		if mode == "test" {
			simPayload, _ := json.Marshal(map[string]interface{}{
				"subscription_id": sub.ID.String(),
				"tenant_id":       tenantID.String(),
				"amount_kobo":     checkoutAmount,
				"plan_name":       plan.Name,
				"customer_email":  customer.Email,
			})
			if _, err := h.jobs.Enqueue(r.Context(), &tenantID, domain.JobSimulateWebhook, simPayload, time.Now().Add(3*time.Second), 3, mode); err != nil {
				log.Error().Err(err).Str("sub_id", sub.ID.String()).Msg("checkout: failed to enqueue simulated webhook for test mode")
			} else {
				log.Info().Str("sub_id", sub.ID.String()).Msg("billing: simulating payment_success webhook for test mode checkout")
			}
		}
	}

	log.Info().
		Str("tenant_id", tenantID.String()).
		Str("subscription_id", sub.ID.String()).
		Str("customer_id", customer.ID.String()).
		Bool("customer_created", customerCreated).
		Bool("requires_payment_method", checkoutURL != "").
		Msg("checkout completed")

	resp := checkoutResponse{
		Customer:              customer,
		Subscription:          sub,
		CustomerCreated:       customerCreated,
		CheckoutURL:           checkoutURL,
		ToriCheckoutURL:       toriCheckoutURL,
		RequiresPaymentMethod: checkoutURL != "",
	}
	if promo != nil {
		resp.PromoApplied = true
		resp.DiscountKobo = discountKobo
		resp.OriginalAmountKobo = plan.Amount
		resp.FinalAmountKobo = plan.Amount - discountKobo
	}

	respond.JSON(w, r, http.StatusCreated, resp)
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

	customer, err := h.customers.GetByID(r.Context(), sub.CustomerID, tenantID)
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

	// Re-apply whatever discount (if any) was applied on the original checkout
	// that created this subscription — otherwise a regenerated link silently
	// charges the customer full price after their card failed on a discount.
	checkoutAmount := plan.Amount - sub.DiscountKobo
	if plan.TrialPeriodDays > 0 && sub.Status == domain.StatusTrialing {
		checkoutAmount = 100 // ₦1 verification for trial — discount never applied to this charge
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

package handlers

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"sort"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/ledger"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/payment"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/subscription"
	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type PortalHandler struct {
	customers domain.CustomerRepository
	subs      domain.SubscriptionRepository
	plans     domain.PlanRepository
	invoices  domain.InvoiceRepository
	tenants   domain.TenantRepository
	ledgerSvc *ledger.Service
	payment   payment.NombaClient
}

func NewPortalHandler(
	customers domain.CustomerRepository,
	subs domain.SubscriptionRepository,
	plans domain.PlanRepository,
	invoices domain.InvoiceRepository,
	tenants domain.TenantRepository,
	ledgerSvc *ledger.Service,
	paymentClient payment.NombaClient,
) *PortalHandler {
	return &PortalHandler{
		customers: customers, subs: subs, plans: plans,
		invoices: invoices, tenants: tenants,
		ledgerSvc: ledgerSvc, payment: paymentClient,
	}
}

// extractPortalCustomerID validates the portal token and returns the customer ID.
func extractPortalCustomerID(r *http.Request) (uuid.UUID, error) {
	tokenStr := portalTokenFromRequest(r)

	secret := os.Getenv("JWT_SECRET")
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return uuid.Nil, domain.ErrUnauthorised
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return uuid.Nil, domain.ErrUnauthorised
	}

	tokenType, _ := claims["type"].(string)
	if tokenType != "portal" {
		return uuid.Nil, domain.ErrUnauthorised
	}

	customerIDStr, _ := claims["customer_id"].(string)
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		return uuid.Nil, domain.ErrUnauthorised
	}

	return customerID, nil
}

func portalTokenFromRequest(r *http.Request) string {
	if t := r.URL.Query().Get("token"); t != "" {
		return t
	}
	header := r.Header.Get("Authorization")
	if len(header) > 7 && header[:7] == "Bearer " {
		return header[7:]
	}
	return ""
}

// portalFrontendBase returns the deployed portal's own origin, used to build
// callback URLs (e.g. after an update-payment-method checkout).
func portalFrontendBase() string {
	base := os.Getenv("FRONTEND_URL")
	if base == "" {
		base = "https://frontend-production-e3be.up.railway.app"
	}
	return base
}

type subWithPlan struct {
	*domain.Subscription
	Plan *domain.Plan `json:"plan"`
}

// GetPortalData returns the customer and their subscriptions for the portal.
func (h *PortalHandler) GetPortalData(w http.ResponseWriter, r *http.Request) {
	customerID, err := extractPortalCustomerID(r)
	if err != nil {
		respond.Unauthorised(w, r, "invalid or expired portal token")
		return
	}

	customer, err := h.customers.GetByIDNoTenant(r.Context(), customerID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	subs, err := h.subs.ListByCustomerNoTenant(r.Context(), customerID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	enriched := make([]subWithPlan, 0, len(subs))
	for _, sub := range subs {
		if sub.Status == domain.StatusCancelled {
			continue
		}
		plan, _ := h.plans.GetByID(r.Context(), sub.PlanID, sub.TenantID)
		enriched = append(enriched, subWithPlan{Subscription: sub, Plan: plan})
	}

	// Recent invoices across every subscription, newest first, capped to 3
	// for the overview page.
	var recentInvoices []*domain.Invoice
	for _, sub := range subs {
		invs, err := h.invoices.ListBySubscription(r.Context(), sub.ID)
		if err != nil {
			continue
		}
		recentInvoices = append(recentInvoices, invs...)
	}
	sort.Slice(recentInvoices, func(i, j int) bool {
		return recentInvoices[i].CreatedAt.After(recentInvoices[j].CreatedAt)
	})
	if len(recentInvoices) > 3 {
		recentInvoices = recentInvoices[:3]
	}

	merchantName := ""
	if len(subs) > 0 {
		if tenant, err := h.tenants.GetByID(r.Context(), subs[0].TenantID); err == nil {
			merchantName = tenant.Name
		}
	}

	respond.JSON(w, r, http.StatusOK, map[string]interface{}{
		"customer":        customer,
		"subscriptions":   enriched,
		"recent_invoices": recentInvoices,
		"merchant_name":   merchantName,
	})
}

// ListSubscriptions returns every non-cancelled subscription for the
// customer, each enriched with its plan.
func (h *PortalHandler) ListSubscriptions(w http.ResponseWriter, r *http.Request) {
	customerID, err := extractPortalCustomerID(r)
	if err != nil {
		respond.Unauthorised(w, r, "invalid or expired portal token")
		return
	}

	subs, err := h.subs.ListByCustomerNoTenant(r.Context(), customerID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	enriched := make([]subWithPlan, 0, len(subs))
	for _, sub := range subs {
		plan, _ := h.plans.GetByID(r.Context(), sub.PlanID, sub.TenantID)
		enriched = append(enriched, subWithPlan{Subscription: sub, Plan: plan})
	}

	respond.JSON(w, r, http.StatusOK, enriched)
}

// GetSubscription returns a single subscription (with plan) owned by the customer.
func (h *PortalHandler) GetSubscription(w http.ResponseWriter, r *http.Request) {
	customerID, err := extractPortalCustomerID(r)
	if err != nil {
		respond.Unauthorised(w, r, "invalid or expired portal token")
		return
	}

	subID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "subscription ID is not a valid UUID")
		return
	}

	sub, err := h.subs.GetByIDNoTenant(r.Context(), subID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}
	if sub.CustomerID != customerID {
		respond.Unauthorised(w, r, "subscription does not belong to this customer")
		return
	}

	plan, _ := h.plans.GetByID(r.Context(), sub.PlanID, sub.TenantID)
	respond.JSON(w, r, http.StatusOK, subWithPlan{Subscription: sub, Plan: plan})
}

// friendlyTransition translates an internal status pair into customer-facing
// language. Falls back to a generic "status changed" sentence for any pair
// not explicitly covered.
func friendlyTransition(from, to domain.SubscriptionStatus) string {
	descriptions := map[string]string{
		"PENDING_PAYMENT->ACTIVE":  "Your subscription was activated",
		"PENDING_PAYMENT->PAST_DUE": "Your first payment didn't go through",
		"TRIALING->ACTIVE":         "Your trial ended and your subscription is now active",
		"TRIALING->GRACE_PERIOD":   "Your trial ended but the first payment failed — we're retrying",
		"GRACE_PERIOD->ACTIVE":     "Your payment went through — your subscription is active",
		"GRACE_PERIOD->PAST_DUE":   "We couldn't collect payment after your trial",
		"ACTIVE->PAST_DUE":         "Your last payment didn't go through",
		"ACTIVE->DUNNING":          "Payment failed — we're retrying",
		"PAST_DUE->DUNNING":        "We're now actively retrying your payment",
		"DUNNING->ACTIVE":          "Payment recovered successfully",
		"PAST_DUE->ACTIVE":         "Payment recovered successfully",
		"DUNNING->SUSPENDED":       "Your subscription was suspended after repeated payment failures",
		"PAST_DUE->SUSPENDED":      "Your subscription was suspended after repeated payment failures",
		"SUSPENDED->ACTIVE":        "Your subscription was recovered and reactivated",
		"ACTIVE->PAUSED":           "You paused your subscription",
		"PAUSED->ACTIVE":           "You resumed your subscription",
		"ACTIVE->CANCELLED":        "Your subscription was cancelled",
		"PAUSED->CANCELLED":        "Your subscription was cancelled",
		"SUSPENDED->CANCELLED":     "Your subscription was cancelled",
		"TRIALING->CANCELLED":      "Your trial was cancelled",
		"PENDING_PAYMENT->CANCELLED": "Your subscription was cancelled before payment completed",
	}
	if d, ok := descriptions[string(from)+"->"+string(to)]; ok {
		return d
	}
	return fmt.Sprintf("Status changed from %s to %s", humaniseStatus(from), humaniseStatus(to))
}

func humaniseStatus(s domain.SubscriptionStatus) string {
	labels := map[domain.SubscriptionStatus]string{
		domain.StatusPendingPayment: "pending payment",
		domain.StatusTrialing:       "trial",
		domain.StatusActive:         "active",
		domain.StatusGracePeriod:    "grace period",
		domain.StatusPastDue:        "past due",
		domain.StatusDunning:        "payment retrying",
		domain.StatusPaused:         "paused",
		domain.StatusSuspended:      "suspended",
		domain.StatusCancelled:      "cancelled",
	}
	if l, ok := labels[s]; ok {
		return l
	}
	return string(s)
}

type historyEntry struct {
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

// SubscriptionHistory returns the transition audit trail translated into
// customer-friendly language.
func (h *PortalHandler) SubscriptionHistory(w http.ResponseWriter, r *http.Request) {
	customerID, err := extractPortalCustomerID(r)
	if err != nil {
		respond.Unauthorised(w, r, "invalid or expired portal token")
		return
	}

	subID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "subscription ID is not a valid UUID")
		return
	}

	sub, err := h.subs.GetByIDNoTenant(r.Context(), subID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}
	if sub.CustomerID != customerID {
		respond.Unauthorised(w, r, "subscription does not belong to this customer")
		return
	}

	transitions, err := h.subs.ListTransitions(r.Context(), subID, sub.TenantID, 100, 0)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	history := make([]historyEntry, 0, len(transitions))
	for _, t := range transitions {
		history = append(history, historyEntry{
			Description: friendlyTransition(domain.SubscriptionStatus(t.FromStatus), domain.SubscriptionStatus(t.ToStatus)),
			CreatedAt:   t.CreatedAt,
		})
	}

	respond.JSON(w, r, http.StatusOK, history)
}

// UpdatePaymentMethod generates a fresh Nomba checkout for the customer to
// re-enter their card. It's a ₦1 verification charge — the same convention
// used to tokenise a card during a trial — not a real charge. The
// payment_success webhook (already wired for every checkout) replaces the
// subscription's stored token_key once the customer completes it.
func (h *PortalHandler) UpdatePaymentMethod(w http.ResponseWriter, r *http.Request) {
	customerID, err := extractPortalCustomerID(r)
	if err != nil {
		respond.Unauthorised(w, r, "invalid or expired portal token")
		return
	}

	subID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "subscription ID is not a valid UUID")
		return
	}

	sub, err := h.subs.GetByIDNoTenant(r.Context(), subID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}
	if sub.CustomerID != customerID {
		respond.Unauthorised(w, r, "subscription does not belong to this customer")
		return
	}
	if sub.Status == domain.StatusCancelled {
		respond.UnprocessableEntity(w, r, "invalid_status", "cannot update payment method for a cancelled subscription")
		return
	}

	customer, err := h.customers.GetByIDNoTenant(r.Context(), customerID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	plan, err := h.plans.GetByID(r.Context(), sub.PlanID, sub.TenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	token := portalTokenFromRequest(r)
	callbackURL := fmt.Sprintf("%s/portal/subscriptions/%s?token=%s&payment_method_updated=1", portalFrontendBase(), subID, token)

	resp, err := h.payment.InitiateCheckout(r.Context(), payment.CheckoutRequest{
		CustomerEmail: customer.Email,
		CustomerID:    customer.ID.String(),
		Amount:        100, // ₦1 verification — tokenises the card, does not charge the plan amount
		Currency:      plan.Currency,
		Reference:     sub.ID.String(),
		CallbackURL:   callbackURL,
		Metadata: map[string]string{
			"subscription_id": sub.ID.String(),
			"purpose":         "update_payment_method",
		},
	})
	if err != nil {
		log.Error().Err(err).Str("sub_id", subID.String()).Msg("portal: failed to create update-payment-method checkout")
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, map[string]string{"checkout_url": resp.CheckoutURL})
}

// ListInvoices returns every invoice across every subscription the customer has.
func (h *PortalHandler) ListInvoices(w http.ResponseWriter, r *http.Request) {
	customerID, err := extractPortalCustomerID(r)
	if err != nil {
		respond.Unauthorised(w, r, "invalid or expired portal token")
		return
	}

	subs, err := h.subs.ListByCustomerNoTenant(r.Context(), customerID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	type invoiceWithPlan struct {
		*domain.Invoice
		PlanName string `json:"plan_name,omitempty"`
	}

	planCache := map[uuid.UUID]*domain.Plan{}
	var all []invoiceWithPlan
	for _, sub := range subs {
		invs, err := h.invoices.ListBySubscription(r.Context(), sub.ID)
		if err != nil {
			continue
		}
		plan, ok := planCache[sub.PlanID]
		if !ok {
			plan, _ = h.plans.GetByID(r.Context(), sub.PlanID, sub.TenantID)
			planCache[sub.PlanID] = plan
		}
		planName := ""
		if plan != nil {
			planName = plan.Name
		}
		for _, inv := range invs {
			all = append(all, invoiceWithPlan{Invoice: inv, PlanName: planName})
		}
	}

	sort.Slice(all, func(i, j int) bool { return all[i].CreatedAt.After(all[j].CreatedAt) })

	respond.JSON(w, r, http.StatusOK, all)
}

// DownloadInvoice returns structured invoice data for the frontend to render
// as a PDF client-side (the dashboard's invoice PDF already works this way).
func (h *PortalHandler) DownloadInvoice(w http.ResponseWriter, r *http.Request) {
	customerID, err := extractPortalCustomerID(r)
	if err != nil {
		respond.Unauthorised(w, r, "invalid or expired portal token")
		return
	}

	invID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "invoice ID is not a valid UUID")
		return
	}

	inv, err := h.invoices.GetByIDNoTenant(r.Context(), invID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}
	if inv.CustomerID != customerID {
		respond.Unauthorised(w, r, "invoice does not belong to this customer")
		return
	}

	customer, _ := h.customers.GetByIDNoTenant(r.Context(), customerID)
	sub, _ := h.subs.GetByIDNoTenant(r.Context(), inv.SubscriptionID)

	planName := ""
	planInterval := ""
	merchantName := "Merchant"
	if sub != nil {
		if plan, err := h.plans.GetByID(r.Context(), sub.PlanID, sub.TenantID); err == nil {
			planName = plan.Name
			planInterval = string(plan.Interval)
		}
		if tenant, err := h.tenants.GetByID(r.Context(), sub.TenantID); err == nil {
			merchantName = tenant.Name
		}
	}

	customerEmail := ""
	if customer != nil {
		customerEmail = customer.Email
	}

	respond.JSON(w, r, http.StatusOK, map[string]interface{}{
		"invoice":        inv,
		"plan_name":      planName,
		"plan_interval":  planInterval,
		"merchant_name":  merchantName,
		"customer_email": customerEmail,
	})
}

// PortalCancel cancels a subscription via portal token.
func (h *PortalHandler) PortalCancel(w http.ResponseWriter, r *http.Request) {
	customerID, err := extractPortalCustomerID(r)
	if err != nil {
		respond.Unauthorised(w, r, "invalid or expired portal token")
		return
	}

	subID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "subscription ID is not a valid UUID")
		return
	}

	var body struct {
		Reason string `json:"reason"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	sub, err := h.subs.GetByIDNoTenant(r.Context(), subID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}

	if sub.CustomerID != customerID {
		respond.Unauthorised(w, r, "subscription does not belong to this customer")
		return
	}

	_, err = subscription.Transition(sub.Status, subscription.EventCustomerCancelled)
	if err != nil {
		respond.UnprocessableEntity(w, r, "invalid_transition", err.Error())
		return
	}

	if body.Reason != "" {
		if _, err := h.subs.SetCancelReason(r.Context(), subID, sub.TenantID, body.Reason); err != nil {
			log.Error().Err(err).Str("sub_id", subID.String()).Msg("portal cancel: failed to store cancel reason")
		}
	}

	// Customer-initiated cancellation keeps access until the period ends
	updated, err := h.subs.CancelAtPeriodEnd(r.Context(), subID, sub.TenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, updated)
}

// PortalPause pauses a subscription via portal token.
func (h *PortalHandler) PortalPause(w http.ResponseWriter, r *http.Request) {
	customerID, err := extractPortalCustomerID(r)
	if err != nil {
		respond.Unauthorised(w, r, "invalid or expired portal token")
		return
	}

	subID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "subscription ID is not a valid UUID")
		return
	}

	sub, err := h.subs.GetByIDNoTenant(r.Context(), subID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}

	if sub.CustomerID != customerID {
		respond.Unauthorised(w, r, "subscription does not belong to this customer")
		return
	}

	_, err = subscription.Transition(sub.Status, subscription.EventCustomerPaused)
	if err != nil {
		respond.UnprocessableEntity(w, r, "invalid_transition", err.Error())
		return
	}

	plan, err := h.plans.GetByID(r.Context(), sub.PlanID, sub.TenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	now := time.Now().UTC()
	daysInPeriod := sub.CurrentPeriodEnd.Sub(sub.CurrentPeriodStart).Hours() / 24
	daysRemaining := sub.CurrentPeriodEnd.Sub(now).Hours() / 24
	if daysRemaining < 0 {
		daysRemaining = 0
	}
	var creditKobo int64
	if daysInPeriod > 0 && daysRemaining > 0 {
		creditKobo = int64(math.Round(daysRemaining / daysInPeriod * float64(plan.Amount)))
	}

	updated, err := h.subs.Pause(r.Context(), subID, sub.TenantID, creditKobo)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	if creditKobo > 0 {
		ik := fmt.Sprintf("pause-credit-%s-%d", subID, now.Unix())
		if _, err := h.ledgerSvc.RecordPauseCredit(r.Context(), sub.TenantID, subID, sub.CustomerID, creditKobo, plan.Currency, ik, updated.Mode); err != nil {
			log.Error().Err(err).Str("sub_id", subID.String()).Msg("portal pause: failed to record proration credit")
		}
	}

	respond.JSON(w, r, http.StatusOK, updated)
}

// PortalResume resumes a subscription via portal token.
func (h *PortalHandler) PortalResume(w http.ResponseWriter, r *http.Request) {
	customerID, err := extractPortalCustomerID(r)
	if err != nil {
		respond.Unauthorised(w, r, "invalid or expired portal token")
		return
	}

	subID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "subscription ID is not a valid UUID")
		return
	}

	sub, err := h.subs.GetByIDNoTenant(r.Context(), subID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}

	if sub.CustomerID != customerID {
		respond.Unauthorised(w, r, "subscription does not belong to this customer")
		return
	}

	_, err = subscription.Transition(sub.Status, subscription.EventCustomerResumed)
	if err != nil {
		respond.UnprocessableEntity(w, r, "invalid_transition", err.Error())
		return
	}

	updated, err := h.subs.Resume(r.Context(), subID, sub.TenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, updated)
}

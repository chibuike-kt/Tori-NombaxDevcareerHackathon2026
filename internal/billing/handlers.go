package billing

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/dunning"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/email"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/ledger"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/payment"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type Handlers struct {
	subs      domain.SubscriptionRepository
	tenants   domain.TenantRepository
	customers domain.CustomerRepository
	plans     domain.PlanRepository
	ledger    *ledger.Service
	dunning   *dunning.Engine
	payment   payment.NombaClient
	webhooks  domain.WebhookRepository
	invoices  domain.InvoiceRepository
	jobs      domain.JobRepository

	// Optional — wired via WithEmailTemplates. Nil in tests, in which case
	// TrialEndingSoon skips sending rather than panicking.
	emailTemplates domain.EmailTemplateRepository
	emailClient    *email.ResendClient
}

// WithEmailTemplates wires the dependencies needed to send the trial.ending_soon
// merchant email. Returns the same Handlers for chaining.
func (h *Handlers) WithEmailTemplates(emailTemplates domain.EmailTemplateRepository, emailClient *email.ResendClient) *Handlers {
	h.emailTemplates = emailTemplates
	h.emailClient = emailClient
	return h
}

func NewHandlers(
	subs domain.SubscriptionRepository,
	tenants domain.TenantRepository,
	customers domain.CustomerRepository,
	plans domain.PlanRepository,
	ledger *ledger.Service,
	dunning *dunning.Engine,
	payment payment.NombaClient,
	webhooks domain.WebhookRepository,
	invoices domain.InvoiceRepository,
	jobs domain.JobRepository,
) *Handlers {
	return &Handlers{
		subs: subs,
		tenants: tenants,
		customers: customers,
		plans: plans,
		ledger: ledger,
		dunning: dunning,
		payment: payment,
		webhooks: webhooks,
		invoices: invoices,
		jobs: jobs,
	}
}

type subscriptionPayload struct {
	SubscriptionID string `json:"subscription_id"`
	TenantID       string `json:"tenant_id"`
}

// TrialEndingSoon sends the customer a heads-up 3 days before their trial
// ends and the full plan amount is charged. Uses the tenant's configured
// trial.ending_soon template if enabled, otherwise the default. Skips
// silently if the subscription already left TRIALING (converted early,
// cancelled, etc.) or if email dependencies were never wired up.
func (h *Handlers) TrialEndingSoon(ctx context.Context, payload json.RawMessage) error {
	if h.emailClient == nil || h.emailTemplates == nil {
		return nil
	}

	var p subscriptionPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	subID, err := uuid.Parse(p.SubscriptionID)
	if err != nil {
		return fmt.Errorf("invalid subscription_id: %w", err)
	}
	tenantID, err := uuid.Parse(p.TenantID)
	if err != nil {
		return fmt.Errorf("invalid tenant_id: %w", err)
	}

	sub, err := h.subs.GetByID(ctx, subID, tenantID)
	if err != nil {
		return fmt.Errorf("get subscription: %w", err)
	}
	if sub.Status != domain.StatusTrialing {
		log.Info().Str("sub_id", subID.String()).Str("status", string(sub.Status)).
			Msg("trial.ending_soon skipped — subscription no longer trialing")
		return nil
	}

	tmpl, tmplErr := h.emailTemplates.Get(ctx, tenantID, "trial.ending_soon")
	hasCustomTemplate := tmplErr == nil && !tmpl.UseDefault
	if tmplErr == nil && !tmpl.IsEnabled {
		return nil
	}

	plan, err := h.plans.GetByID(ctx, sub.PlanID, tenantID)
	if err != nil {
		return fmt.Errorf("get plan: %w", err)
	}
	customer, err := h.customers.GetByID(ctx, sub.CustomerID, tenantID)
	if err != nil {
		return fmt.Errorf("get customer: %w", err)
	}
	tenant, err := h.tenants.GetByID(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("get tenant: %w", err)
	}

	nextBillingDate := ""
	if sub.TrialEnd != nil {
		nextBillingDate = sub.TrialEnd.Format("Jan 2, 2006")
	}
	vars := email.MerchantEmailVars{
		CustomerEmail:   customer.Email,
		PlanName:        plan.Name,
		AmountKobo:      plan.Amount,
		NextBillingDate: nextBillingDate,
		ProductName:     tenant.Name,
	}

	var subject, html string
	if hasCustomTemplate {
		subject = email.RenderMerchantTemplate(tmpl.Subject, vars)
		html = email.RenderMerchantTemplate(tmpl.HTMLBody, vars)
	} else {
		var ok bool
		subject, html, ok = email.DefaultMerchantTemplate("trial.ending_soon", vars)
		if !ok {
			return nil
		}
	}

	if err := h.emailClient.Send(ctx, customer.Email, subject, html); err != nil {
		log.Error().Err(err).Str("sub_id", subID.String()).Msg("billing: failed to send trial.ending_soon email")
		return nil
	}

	log.Info().Str("sub_id", subID.String()).Str("customer_email", customer.Email).
		Msg("billing: trial.ending_soon email sent")
	return nil
}

// ExpireTrial transitions a TRIALING subscription to ACTIVE when the trial ends.
func (h *Handlers) ExpireTrial(ctx context.Context, payload json.RawMessage) error {
	var p subscriptionPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	subID, err := uuid.Parse(p.SubscriptionID)
	if err != nil {
		return fmt.Errorf("invalid subscription_id: %w", err)
	}
	tenantID, err := uuid.Parse(p.TenantID)
	if err != nil {
		return fmt.Errorf("invalid tenant_id: %w", err)
	}

	sub, err := h.subs.GetByID(ctx, subID, tenantID)
	if err != nil {
		return fmt.Errorf("get subscription: %w", err)
	}

	if sub.Status != domain.StatusTrialing {
		log.Info().Str("sub_id", subID.String()).Str("status", string(sub.Status)).
			Msg("trial already expired or not trialing — skip")
		return nil
	}

	plan, err := h.plans.GetByID(ctx, sub.PlanID, tenantID)
	if err != nil {
		return fmt.Errorf("get plan: %w", err)
	}

	// If no token key — customer never completed checkout
	// Move to PAST_DUE and let dunning handle it
	if sub.TokenKey == "" {
		log.Warn().Str("sub_id", subID.String()).
			Msg("trial expired but no token key — customer never completed checkout, moving to PAST_DUE")
		_, _ = h.subs.UpdateStatus(ctx, subID, tenantID, domain.StatusPastDue)
		_, _ = h.ledger.RecordTrialEnd(ctx, tenantID, subID, sub.CustomerID, "NGN",
			fmt.Sprintf("trial-end-%s", subID), sub.Mode)
		return nil
	}

	// Token key exists — charge the card now
	log.Info().Str("sub_id", subID.String()).Msg("trial expired — charging card now")

	result, err := h.payment.ChargeToken(ctx, payment.ChargeTokenRequest{
		CustomerID:     sub.CustomerID.String(),
		TokenisedCard:  sub.TokenKey,
		Amount:         plan.Amount,
		Currency:       plan.Currency,
		IdempotencyKey: fmt.Sprintf("trial-charge-%s", subID),
		Reference:      fmt.Sprintf("trial-charge-%s", subID),
	})

	if err != nil {
		// Infrastructure/network error reaching Nomba — not a genuine decline.
		// Return the error so the job queue retries rather than burning the
		// subscription's one grace-period attempt on Tori's own hiccup.
		log.Error().Err(err).Str("sub_id", subID.String()).
			Msg("trial charge: infrastructure error reaching Nomba — requeuing, not entering grace period")
		return fmt.Errorf("charge token: %w", err)
	}

	if result.Success {
		// Charge succeeded — activate subscription
		now := time.Now().UTC()
		periodEnd := nextPeriodEnd(now, plan)
		_, _ = h.subs.UpdateAfterRenewal(ctx, subID, tenantID, domain.StatusActive, now, periodEnd)

		// createInvoiceForCharge records the ledger entry itself — a separate
		// RecordCharge call here would double-count this charge in the ledger.
		h.createInvoiceForCharge(ctx, sub, plan, plan.Amount, result.Reference)

		log.Info().Str("sub_id", subID.String()).
			Str("amount", fmt.Sprintf("%.2f", float64(plan.Amount)/100)).
			Msg("trial charge succeeded — subscription activated")
		return nil
	}

	// Charge failed — genuine decline — enter grace period
	log.Warn().Str("sub_id", subID.String()).Msg("trial charge failed — entering grace period")
	retry := time.Now().UTC().Add(48 * time.Hour)
	_, _ = h.subs.UpdateDunning(ctx, subID, tenantID, domain.StatusGracePeriod, 0, &retry)

	_, _ = h.ledger.RecordTrialEnd(ctx, tenantID, subID, sub.CustomerID, "NGN",
		fmt.Sprintf("trial-end-%s", subID), sub.Mode)

	return nil
}

// RetryFailedPayment attempts to charge a DUNNING or PAST_DUE subscription.
func (h *Handlers) RetryFailedPayment(ctx context.Context, payload json.RawMessage) error {
	var p subscriptionPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	subID, err := uuid.Parse(p.SubscriptionID)
	if err != nil {
		return fmt.Errorf("invalid subscription_id: %w", err)
	}
	tenantID, err := uuid.Parse(p.TenantID)
	if err != nil {
		return fmt.Errorf("invalid tenant_id: %w", err)
	}

	sub, err := h.subs.GetByID(ctx, subID, tenantID)
	if err != nil {
		return fmt.Errorf("get subscription: %w", err)
	}

if sub.Status != domain.StatusDunning && sub.Status != domain.StatusPastDue {
    log.Info().Str("sub_id", subID.String()).Msg("not in dunning — skip")
    return nil
}

// If customer requested cancellation, stop retrying — don't charge a cancelling subscription
if sub.CancelAtPeriodEnd {
    log.Info().Str("sub_id", subID.String()).Msg("billing: cancel_at_period_end set — skipping dunning retry")
    return nil
}

	tenant, err := h.tenants.GetByID(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("get tenant: %w", err)
	}

	plan, err := h.plans.GetByID(ctx, sub.PlanID, tenantID)
	if err != nil {
		return fmt.Errorf("get plan: %w", err)
	}

	// Recovery ladder — escalate through card → mandate → pay-link
	result, rail := h.attemptRecoveryCharge(ctx, sub, plan)

	// A network/API failure reaching Nomba is not a card decline — retry the
	// job instead of burning a dunning attempt or notifying the customer.
	if result.IsInfraError {
		log.Error().Str("sub_id", subID.String()).Str("rail", rail).Str("failure", result.FailureMessage).
			Msg("dunning retry: infrastructure error reaching Nomba — requeuing, not counting as a decline")
		return fmt.Errorf("recovery charge infra error: %s", result.FailureMessage)
	}

	// Track which rail is currently being used
	_, _ = h.subs.UpdateRecoveryRail(ctx, subID, tenantID, rail)

	if result.Success {
		now := time.Now().UTC()
		periodEnd := nextPeriodEnd(now, plan)
		_, _ = h.subs.UpdateAfterRenewal(ctx, subID, tenantID, domain.StatusActive, now, periodEnd)
		// createInvoiceForCharge records the ledger entry itself — a separate
		// RecordCharge call here would double-count this charge in the ledger.
		h.createInvoiceForCharge(ctx, sub, plan, plan.Amount, result.Reference)
		log.Info().Str("sub_id", subID.String()).Str("rail", rail).Msg("dunning recovery successful")
		return nil
	}

	// If the ladder reached the manual rail, fire payment.action_required with a fresh pay-link
	if rail == "manual" || result.FailureCode == "action_required" {
		h.firePaymentActionRequired(ctx, sub, plan)
	}

	decision, decErr := h.dunning.Decide(ctx, sub, result.FailureCode, tenant.DunningConfig)
	if decErr != nil {
		return fmt.Errorf("dunning decision: %w", decErr)
	}

	if !decision.ShouldRetry {
		_, _ = h.subs.UpdateStatus(ctx, subID, tenantID, domain.StatusSuspended)
		log.Info().Str("sub_id", subID.String()).Msg("dunning exhausted — suspended")
		return nil
	}

	_, _ = h.subs.UpdateDunning(ctx, subID, tenantID, domain.StatusDunning,
		decision.Attempt, &decision.NextRetryAt)

	log.Info().Str("sub_id", subID.String()).Int("attempt", decision.Attempt).
		Time("next_retry", decision.NextRetryAt).Msg("dunning retry scheduled")
	return nil
}

// SuspendSubscription moves a subscription to SUSPENDED state.
func (h *Handlers) SuspendSubscription(ctx context.Context, payload json.RawMessage) error {
	var p subscriptionPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}
	subID, _ := uuid.Parse(p.SubscriptionID)
	tenantID, _ := uuid.Parse(p.TenantID)

	sub, err := h.subs.GetByID(ctx, subID, tenantID)
	if err != nil {
		return fmt.Errorf("get subscription: %w", err)
	}
	if sub.Status == domain.StatusSuspended || sub.Status == domain.StatusCancelled {
		log.Info().Str("sub_id", subID.String()).Str("status", string(sub.Status)).
			Msg("suspend skipped — subscription already suspended or cancelled")
		return nil
	}

	_, err = h.subs.UpdateStatus(ctx, subID, tenantID, domain.StatusSuspended)
	if err != nil {
		return fmt.Errorf("suspend subscription: %w", err)
	}
	log.Info().Str("sub_id", subID.String()).Msg("subscription suspended")
	return nil
}

// GraceRetry handles the 48-hour grace period retry.
// If successful, activates the subscription.
// If failed, moves to PAST_DUE to begin full dunning.
func (h *Handlers) GraceRetry(ctx context.Context, payload json.RawMessage) error {
	var p subscriptionPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("unmarshal grace retry payload: %w", err)
	}

	subID, err := uuid.Parse(p.SubscriptionID)
	if err != nil {
		return fmt.Errorf("parse subscription id: %w", err)
	}
	tenantID, err := uuid.Parse(p.TenantID)
	if err != nil {
		return fmt.Errorf("parse tenant id: %w", err)
	}

	sub, err := h.subs.GetByID(ctx, subID, tenantID)
	if err != nil {
		return fmt.Errorf("get subscription: %w", err)
	}

if sub.Status != domain.StatusGracePeriod {
    log.Info().
        Str("sub_id", subID.String()).
        Str("status", string(sub.Status)).
        Msg("grace retry skipped — subscription no longer in grace period")
    return nil
}

// If customer requested cancellation, stop retrying
if sub.CancelAtPeriodEnd {
    log.Info().Str("sub_id", subID.String()).Msg("billing: cancel_at_period_end set — skipping grace retry")
    return nil
}

	plan, err := h.plans.GetByID(ctx, sub.PlanID, tenantID)
	if err != nil {
		return fmt.Errorf("get plan: %w", err)
	}

	result, chargeErr := h.payment.ChargeToken(ctx, payment.ChargeTokenRequest{
		CustomerID:     sub.CustomerID.String(),
		TokenisedCard:  sub.TokenKey,
		Amount:         plan.Amount,
		Currency:       plan.Currency,
		IdempotencyKey: fmt.Sprintf("grace-%s-%d", subID, time.Now().Unix()),
		Reference:      fmt.Sprintf("grace-%s", subID),
	})

	if chargeErr != nil {
		// Infrastructure/network error reaching Nomba — not a genuine decline.
		// Return the error so the job queue retries rather than moving the
		// subscription into full dunning over Tori's own hiccup.
		log.Error().Err(chargeErr).Str("sub_id", subID.String()).
			Msg("grace retry: infrastructure error reaching Nomba — requeuing, not moving to PAST_DUE")
		return fmt.Errorf("charge token: %w", chargeErr)
	}

	if result.Success {
		_, err = h.subs.UpdateStatusOptimistic(ctx, subID, tenantID, domain.StatusActive, sub.UpdatedAt)
		if err != nil {
			if errors.Is(err, domain.ErrConflict) {
				return nil
			}
			return fmt.Errorf("activate after grace retry: %w", err)
		}
		// createInvoiceForCharge records the ledger entry itself — a separate
		// RecordCharge call here would double-count this charge in the ledger.
		h.createInvoiceForCharge(ctx, sub, plan, plan.Amount, result.Reference)

		log.Info().Str("sub_id", subID.String()).Msg("grace retry succeeded — subscription activated")
		return nil
	}

	// Grace retry failed — genuine decline — move to PAST_DUE to begin full dunning schedule
	_, err = h.subs.UpdateStatusOptimistic(ctx, subID, tenantID, domain.StatusPastDue, sub.UpdatedAt)
	if err != nil {
		if errors.Is(err, domain.ErrConflict) {
			return nil
		}
		return fmt.Errorf("move to past due after grace failure: %w", err)
	}

	log.Info().Str("sub_id", subID.String()).Msg("grace retry failed — subscription moved to PAST_DUE")
	return nil
}

// createInvoiceForCharge generates an invoice record after a successful charge.
// amount is what was actually charged in kobo — the plan's sticker price for
// a full-price renewal/retry, or a promo-discounted amount for a checkout
// that applied a promo code. It must never be re-derived from plan.Amount
// inside this function, since that would silently overwrite a discount.
func (h *Handlers) createInvoiceForCharge(ctx context.Context, sub *domain.Subscription, plan *domain.Plan, amount int64, chargeRef string) {
	ik := fmt.Sprintf("invoice-charge-%s-%s", sub.ID, chargeRef)
	lineItems, _ := json.Marshal([]map[string]interface{}{
		{
			"description": fmt.Sprintf("%s — %s billing", plan.Name, plan.Interval),
			"amount":      amount,
			"currency":    plan.Currency,
		},
	})

	// Step 1: Create invoice
	invoice, err := h.invoices.Create(ctx, sub.TenantID, sub.ID, sub.CustomerID,
		amount, plan.Currency, domain.InvoiceOpen,
		time.Now().UTC(), lineItems, &ik, sub.Mode)
	if err != nil {
		log.Error().Err(err).Str("sub_id", sub.ID.String()).Msg("failed to create invoice for charge")
		return
	}

	// Step 2: Record ledger entry using the real invoice ID
	ledgerIK := fmt.Sprintf("ledger-charge-%s-%s", sub.ID, chargeRef)
	_, ledgerErr := h.ledger.RecordCharge(ctx,
		sub.TenantID, sub.ID, invoice.ID, sub.CustomerID,
		amount, plan.Currency, ledgerIK, sub.Mode)
	if ledgerErr != nil {
		log.Error().Err(ledgerErr).Str("sub_id", sub.ID.String()).Msg("failed to record ledger charge")
	}

	// Step 3: Mark invoice paid with the charge reference
	_, paidErr := h.invoices.MarkPaid(ctx, invoice.ID, sub.TenantID, chargeRef)
	if paidErr != nil {
		log.Error().Err(paidErr).Str("sub_id", sub.ID.String()).Msg("failed to mark invoice paid")
		return
	}

	log.Info().
		Str("sub_id", sub.ID.String()).
		Str("invoice_id", invoice.ID.String()).
		Int64("amount_kobo", amount).
		Msg("invoice created, ledger entry recorded, invoice marked paid")
}

// CancelAtPeriodEnd is the job handler that fires at current_period_end
// to complete a customer-requested cancellation.
func (h *Handlers) CancelAtPeriodEnd(ctx context.Context, payload json.RawMessage) error {
	var p struct {
		SubscriptionID string `json:"subscription_id"`
		TenantID       string `json:"tenant_id"`
	}
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}
	subID, _ := uuid.Parse(p.SubscriptionID)
	tenantID, _ := uuid.Parse(p.TenantID)

	sub, err := h.subs.GetByID(ctx, subID, tenantID)
	if err != nil {
		return fmt.Errorf("get subscription: %w", err)
	}

	if !sub.CancelAtPeriodEnd {
		// Customer may have reactivated — skip
		log.Info().Str("sub_id", subID.String()).Msg("billing: cancel_at_period_end skipped — flag not set")
		return nil
	}

	_, err = h.subs.Cancel(ctx, subID, tenantID)
	if err != nil {
		return fmt.Errorf("cancel subscription: %w", err)
	}

	log.Info().
		Str("sub_id", subID.String()).
		Msg("billing: subscription cancelled at period end")

	return nil
}

// simulateWebhookPayload is the job payload enqueued by the checkout handler
// when a test-mode (tori_test_) key creates a checkout — Nomba's sandbox does
// not reliably fire a real payment_success webhook back to us.
type simulateWebhookPayload struct {
	SubscriptionID string `json:"subscription_id"`
	TenantID       string `json:"tenant_id"`
	AmountKobo     int64  `json:"amount_kobo"`
	PlanName       string `json:"plan_name"`
	CustomerEmail  string `json:"customer_email"`
}

// randomHex returns n random bytes hex-encoded, used for the fake tokenKey
// stored on simulated test-mode subscriptions.
func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// SimulateWebhook activates a PENDING_PAYMENT subscription created with a
// test-mode API key, mirroring what the real Nomba payment_success webhook
// handler does: store a token key, activate the subscription, create an
// invoice, record the ledger charge, and fire outbound webhooks. Live-mode
// checkouts never enqueue this job — only test-mode ones do.
func (h *Handlers) SimulateWebhook(ctx context.Context, payload json.RawMessage) error {
	var p simulateWebhookPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	subID, err := uuid.Parse(p.SubscriptionID)
	if err != nil {
		return fmt.Errorf("invalid subscription_id: %w", err)
	}
	tenantID, err := uuid.Parse(p.TenantID)
	if err != nil {
		return fmt.Errorf("invalid tenant_id: %w", err)
	}

	log.Info().
		Str("sub_id", subID.String()).
		Str("customer_email", p.CustomerEmail).
		Str("plan_name", p.PlanName).
		Int64("amount_kobo", p.AmountKobo).
		Msg("billing: simulating payment_success webhook for test mode checkout")

	sub, err := h.subs.GetByID(ctx, subID, tenantID)
	if err != nil {
		return fmt.Errorf("get subscription: %w", err)
	}

	if sub.Status != domain.StatusPendingPayment {
		log.Info().Str("sub_id", subID.String()).Str("status", string(sub.Status)).
			Msg("billing: simulated webhook skipped — subscription no longer pending payment")
		return nil
	}

	plan, err := h.plans.GetByID(ctx, sub.PlanID, tenantID)
	if err != nil {
		return fmt.Errorf("get plan: %w", err)
	}

	// Fake token key so the subscription can renew normally in test mode too.
	fakeToken := "tok_test_" + randomHex(8)
	if _, err := h.subs.UpdateTokenKey(ctx, subID, tenantID, fakeToken); err != nil {
		log.Error().Err(err).Str("sub_id", subID.String()).Msg("billing: failed to store simulated token key")
	}

	now := time.Now().UTC()
	periodEnd := nextPeriodEnd(now, plan)
	if _, err := h.subs.UpdateAfterRenewal(ctx, subID, tenantID, domain.StatusActive, now, periodEnd); err != nil {
		return fmt.Errorf("activate simulated subscription: %w", err)
	}

	// p.AmountKobo is what checkout actually charged — the plan's full price,
	// or a promo-discounted amount if a promo code was applied. plan.Amount
	// would silently drop the discount here.
	h.createInvoiceForCharge(ctx, sub, plan, p.AmountKobo, fmt.Sprintf("sim-%s", subID))

	webhookData := map[string]interface{}{
		"id":          sub.ID,
		"customer_id": sub.CustomerID,
		"plan_id":     sub.PlanID,
		"status":      domain.StatusActive,
		"amount_kobo": p.AmountKobo,
		"currency":    plan.Currency,
	}
	for _, evt := range []domain.WebhookEventType{domain.EventSubscriptionActivated, domain.EventPaymentSucceeded} {
		wpayload, _ := json.Marshal(map[string]interface{}{
			"tenant_id":  tenantID.String(),
			"event_type": string(evt),
			"data":       webhookData,
			"mode":       sub.Mode,
		})
		if _, err := h.jobs.Enqueue(ctx, &tenantID, domain.JobWebhookDeliver, wpayload, time.Now(), 5, sub.Mode); err != nil {
			log.Error().Err(err).Str("sub_id", subID.String()).Str("event_type", string(evt)).
				Msg("billing: failed to enqueue simulated webhook delivery")
		}
	}

	log.Info().
		Str("sub_id", subID.String()).
		Str("token_key", fakeToken).
		Str("plan", plan.Name).
		Int64("amount_kobo", p.AmountKobo).
		Msg("billing: simulated payment_success — subscription activated")

	return nil
}

// nextPeriodEnd calculates the next period end date based on the plan interval.
func nextPeriodEnd(from time.Time, plan *domain.Plan) time.Time {
	switch plan.Interval {
	case domain.IntervalAnnual:
		return from.AddDate(1, 0, 0)
	case domain.IntervalMonthly:
		return from.AddDate(0, 1, 0)
	default:
		// Custom — use interval_count as days
		return from.AddDate(0, 0, plan.IntervalCount)
	}
}

// attemptRecoveryCharge escalates through the recovery ladder based on the
// current attempt number and the payment rails available on the subscription.
//
// The ladder:
//   Attempts 1-2 : retry the tokenised card
//   Attempt 3+   : escalate to direct-debit mandate if one exists,
//                  otherwise signal that customer action is required (pay-link)
//
// Returns the charge result and the rail that was used ("card", "mandate", "manual").
func (h *Handlers) attemptRecoveryCharge(ctx context.Context, sub *domain.Subscription, plan *domain.Plan) (*payment.ChargeResponse, string) {
	attempt := sub.DunningAttempt + 1
	cardAvailable := sub.TokenKey != "" && sub.TokenKey != "N/A"
	mandateAvailable := sub.MandateID != ""

	// Rail 1 — tokenised card on the first two attempts
	if attempt <= 2 && cardAvailable {
		return h.chargeCard(ctx, sub, plan, attempt), "card"
	}

	// Attempt 3+ — escalate to direct-debit mandate if available
	if attempt >= 3 && mandateAvailable {
		if mc, ok := h.payment.(payment.MandateCharger); ok {
			log.Info().Str("sub_id", sub.ID.String()).Int("attempt", attempt).
				Msg("recovery ladder: escalating to direct-debit mandate")
			result, err := mc.DebitMandate(ctx, payment.DebitMandateRequest{
				MandateID: sub.MandateID,
				Amount:    plan.Amount,
				Currency:  plan.Currency,
				Reference: fmt.Sprintf("retry-mandate-%s-%d", sub.ID, attempt),
				Narration: "Subscription renewal — direct debit recovery",
			})
			if err != nil {
				return &payment.ChargeResponse{Success: false, FailureCode: "processing_error", FailureMessage: err.Error(), IsInfraError: true}, "mandate"
			}
			return result, "mandate"
		}
	}

	// Fall back to card if we still have one
	if cardAvailable {
		return h.chargeCard(ctx, sub, plan, attempt), "card"
	}

	// No automatic rail — customer must act (pay-link escalation handled by caller)
	return &payment.ChargeResponse{
		Success:        false,
		FailureCode:    "action_required",
		FailureMessage: "no automatic payment rail available — customer action required",
	}, "manual"
}

// chargeCard performs a tokenised card charge with a deterministic idempotency key.
func (h *Handlers) chargeCard(ctx context.Context, sub *domain.Subscription, plan *domain.Plan, attempt int) *payment.ChargeResponse {
	result, err := h.payment.ChargeToken(ctx, payment.ChargeTokenRequest{
		CustomerID:     sub.CustomerID.String(),
		TokenisedCard:  sub.TokenKey,
		Amount:         plan.Amount,
		Currency:       plan.Currency,
		IdempotencyKey: fmt.Sprintf("retry-card-%s-%d", sub.ID, attempt),
		Reference:      fmt.Sprintf("retry-card-%s-%d", sub.ID, attempt),
	})
	if err != nil {
		return &payment.ChargeResponse{Success: false, FailureCode: "processing_error", FailureMessage: err.Error(), IsInfraError: true}
	}
	return result
}

// firePaymentActionRequired is the final rung of the recovery ladder.
// When no automatic rail (card or mandate) can recover the payment, Tori
// generates a fresh Nomba checkout link and fires a payment.action_required
// webhook so the product can prompt the customer to pay manually.
func (h *Handlers) firePaymentActionRequired(ctx context.Context, sub *domain.Subscription, plan *domain.Plan) {
	// Generate a fresh pay-link
	resp, err := h.payment.InitiateCheckout(ctx, payment.CheckoutRequest{
		CustomerID: sub.CustomerID.String(),
		Amount:     plan.Amount,
		Currency:   plan.Currency,
		Reference:  sub.ID.String(),
	})
	if err != nil {
		// Don't fire payment.action_required with no working link — that just
		// tells the developer's integration to prompt a customer to click
		// something that doesn't exist. Log clearly and let the next recovery
		// attempt try again instead.
		log.Error().Err(err).Str("sub_id", sub.ID.String()).
			Msg("recovery ladder: failed to generate pay-link — skipping payment.action_required webhook")
		return
	}
	payLink := resp.CheckoutURL

	// Enqueue the webhook delivery via the job queue
	payload, _ := json.Marshal(map[string]interface{}{
		"tenant_id":  sub.TenantID.String(),
		"event_type": string(domain.EventPaymentActionRequired),
		"data": map[string]interface{}{
			"subscription_id": sub.ID.String(),
			"customer_id":     sub.CustomerID.String(),
			"amount":          plan.Amount,
			"currency":        plan.Currency,
			"pay_link":        payLink,
			"reason":          "automatic payment recovery exhausted — customer action required",
		},
		"mode": sub.Mode,
	})
	_, err = h.jobs.Enqueue(ctx, &sub.TenantID, domain.JobWebhookDeliver, payload, time.Now(), 5, sub.Mode)
	if err != nil {
		log.Error().Err(err).Str("sub_id", sub.ID.String()).
			Msg("recovery ladder: failed to enqueue payment.action_required webhook")
		return
	}

	log.Info().
		Str("sub_id", sub.ID.String()).
		Str("pay_link", payLink).
		Msg("recovery ladder: payment.action_required fired with fresh pay-link")
}

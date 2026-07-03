package billing

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/dunning"
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
			fmt.Sprintf("trial-end-%s", subID))
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

	if err == nil && result.Success {
		// Charge succeeded — activate subscription
		now := time.Now().UTC()
		periodEnd := nextPeriodEnd(now, plan)
		_, _ = h.subs.UpdateAfterRenewal(ctx, subID, tenantID, domain.StatusActive, now, periodEnd)

		_, _ = h.ledger.RecordCharge(ctx, tenantID, subID, subID, sub.CustomerID,
			plan.Amount, plan.Currency, fmt.Sprintf("trial-charge-%s", subID))

		h.createInvoiceForCharge(ctx, sub, plan, result.Reference)

		log.Info().Str("sub_id", subID.String()).
			Str("amount", fmt.Sprintf("%.2f", float64(plan.Amount)/100)).
			Msg("trial charge succeeded — subscription activated")
		return nil
	}

	// Charge failed — enter grace period
	log.Warn().Str("sub_id", subID.String()).Msg("trial charge failed — entering grace period")
	retry := time.Now().UTC().Add(48 * time.Hour)
	_, _ = h.subs.UpdateDunning(ctx, subID, tenantID, domain.StatusGracePeriod, 0, &retry)

	_, _ = h.ledger.RecordTrialEnd(ctx, tenantID, subID, sub.CustomerID, "NGN",
		fmt.Sprintf("trial-end-%s", subID))

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

	// Track which rail is currently being used
	_, _ = h.subs.UpdateRecoveryRail(ctx, subID, tenantID, rail)

	if result.Success {
		ik := fmt.Sprintf("recovery-%s-%d", subID, sub.DunningAttempt)
		_, _ = h.ledger.RecordCharge(ctx, tenantID, subID, subID, sub.CustomerID,
			plan.Amount, plan.Currency, ik)
		now := time.Now().UTC()
		periodEnd := nextPeriodEnd(now, plan)
		_, _ = h.subs.UpdateAfterRenewal(ctx, subID, tenantID, domain.StatusActive, now, periodEnd)
		h.createInvoiceForCharge(ctx, sub, plan, result.Reference)
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

	_, err := h.subs.UpdateStatus(ctx, subID, tenantID, domain.StatusSuspended)
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

	if chargeErr == nil && result.Success {
		_, err = h.subs.UpdateStatusOptimistic(ctx, subID, tenantID, domain.StatusActive, sub.UpdatedAt)
		if err != nil {
			if errors.Is(err, domain.ErrConflict) {
				return nil
			}
			return fmt.Errorf("activate after grace retry: %w", err)
		}
		ik := fmt.Sprintf("grace-recovery-%s", subID)
		_, _ = h.ledger.RecordCharge(ctx, tenantID, subID, subID, sub.CustomerID,
			plan.Amount, plan.Currency, ik)

		h.createInvoiceForCharge(ctx, sub, plan, result.Reference)

		log.Info().Str("sub_id", subID.String()).Msg("grace retry succeeded — subscription activated")
		return nil
	}

	// Grace retry failed — move to PAST_DUE to begin full dunning schedule
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
func (h *Handlers) createInvoiceForCharge(ctx context.Context, sub *domain.Subscription, plan *domain.Plan, chargeRef string) {
	ik := fmt.Sprintf("invoice-charge-%s-%s", sub.ID, chargeRef)
	lineItems, _ := json.Marshal([]map[string]interface{}{
		{
			"description": fmt.Sprintf("%s — %s billing", plan.Name, plan.Interval),
			"amount":      plan.Amount,
			"currency":    plan.Currency,
		},
	})

	// Step 1: Create invoice
	invoice, err := h.invoices.Create(ctx, sub.TenantID, sub.ID, sub.CustomerID,
		plan.Amount, plan.Currency, domain.InvoiceOpen,
		time.Now().UTC(), lineItems, &ik)
	if err != nil {
		log.Error().Err(err).Str("sub_id", sub.ID.String()).Msg("failed to create invoice for charge")
		return
	}

	// Step 2: Record ledger entry using the real invoice ID
	ledgerIK := fmt.Sprintf("ledger-charge-%s-%s", sub.ID, chargeRef)
	_, ledgerErr := h.ledger.RecordCharge(ctx,
		sub.TenantID, sub.ID, invoice.ID, sub.CustomerID,
		plan.Amount, plan.Currency, ledgerIK)
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
		Int64("amount_kobo", plan.Amount).
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
				return &payment.ChargeResponse{Success: false, FailureCode: "processing_error", FailureMessage: err.Error()}, "mandate"
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
		return &payment.ChargeResponse{Success: false, FailureCode: "processing_error", FailureMessage: err.Error()}
	}
	return result
}

// firePaymentActionRequired is the final rung of the recovery ladder.
// When no automatic rail (card or mandate) can recover the payment, Tori
// generates a fresh Nomba checkout link and fires a payment.action_required
// webhook so the product can prompt the customer to pay manually.
func (h *Handlers) firePaymentActionRequired(ctx context.Context, sub *domain.Subscription, plan *domain.Plan) {
	// Generate a fresh pay-link
	payLink := ""
	resp, err := h.payment.InitiateCheckout(ctx, payment.CheckoutRequest{
		CustomerID: sub.CustomerID.String(),
		Amount:     plan.Amount,
		Currency:   plan.Currency,
		Reference:  sub.ID.String(),
	})
	if err != nil {
		log.Error().Err(err).Str("sub_id", sub.ID.String()).
			Msg("recovery ladder: failed to generate pay-link for action_required")
	} else {
		payLink = resp.CheckoutURL
	}

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
	})
	_, err = h.jobs.Enqueue(ctx, &sub.TenantID, domain.JobWebhookDeliver, payload, time.Now(), 5)
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

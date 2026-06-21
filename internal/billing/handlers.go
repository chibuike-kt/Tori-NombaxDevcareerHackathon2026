package billing

import (
	"context"
	"encoding/json"
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
}

func NewHandlers(
	subs domain.SubscriptionRepository,
	tenants domain.TenantRepository,
	customers domain.CustomerRepository,
	plans domain.PlanRepository,
	ledgerSvc *ledger.Service,
	dunningEngine *dunning.Engine,
	paymentClient payment.NombaClient,
	webhooks domain.WebhookRepository,
) *Handlers {
	return &Handlers{
		subs:     subs,
		tenants:  tenants,
		customers: customers,
		plans:    plans,
		ledger:   ledgerSvc,
		dunning:  dunningEngine,
		payment:  paymentClient,
		webhooks: webhooks,
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
		log.Info().Str("sub_id", subID.String()).Str("status", string(sub.Status)).Msg("trial already expired or not trialing — skip")
		return nil
	}

	// With Nomba blocked — just activate. Real impl would charge first.
	_, err = h.subs.UpdateStatus(ctx, subID, tenantID, domain.StatusActive)
	if err != nil {
		return fmt.Errorf("activate subscription: %w", err)
	}

	// Record trial end in ledger
	_, _ = h.ledger.RecordTrialEnd(ctx, tenantID, subID, sub.CustomerID, "NGN",
		fmt.Sprintf("trial-end-%s", subID))

	log.Info().Str("sub_id", subID.String()).Msg("trial expired — subscription activated")
	return nil
}

// RetryFailedPayment attempts to charge a DUNNING subscription.
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

	tenant, err := h.tenants.GetByID(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("get tenant: %w", err)
	}

	plan, err := h.plans.GetByID(ctx, sub.PlanID, tenantID)
	if err != nil {
		return fmt.Errorf("get plan: %w", err)
	}

// Attempt charge via payment client (mock for now)
result, err := h.payment.ChargeToken(ctx, payment.ChargeTokenRequest{
    CustomerID:     sub.CustomerID.String(),
    TokenisedCard:  "",
    Amount:         plan.Amount,
    Currency:       plan.Currency,
    IdempotencyKey: fmt.Sprintf("retry-%s-%d", subID, sub.DunningAttempt+1),
    Reference:      fmt.Sprintf("retry-%s-%d", subID, sub.DunningAttempt+1),
})

if result.Success {
    ik := fmt.Sprintf("recovery-%s-%d", subID, sub.DunningAttempt)
    _, _ = h.ledger.RecordCharge(ctx, tenantID, subID, subID, sub.CustomerID,
        plan.Amount, plan.Currency, ik)

    now := time.Now().UTC()
    periodEnd := now.AddDate(0, 1, 0) // simple month advance; real impl uses NextPeriod
    _, _ = h.subs.UpdateAfterRenewal(ctx, subID, tenantID, domain.StatusActive, now, periodEnd)

    log.Info().Str("sub_id", subID.String()).Msg("dunning recovery successful")
    return nil
}

	// Still failing — decide next action
	decision, err := h.dunning.Decide(ctx, sub, result.FailureCode, tenant.DunningConfig)
	if err != nil {
		return fmt.Errorf("dunning decision: %w", err)
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

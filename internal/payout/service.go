package payout

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/payment"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/webhook"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// Handlers processes async payout requests — the job queued by
// POST /v1/payouts calls the Nomba transfer API and settles the payout to
// completed or failed.
type Handlers struct {
	payouts    domain.PayoutRepository
	payment    payment.NombaClient
	dispatcher *webhook.Dispatcher
	tenants    domain.TenantRepository
}

func NewHandlers(payouts domain.PayoutRepository, paymentClient payment.NombaClient, dispatcher *webhook.Dispatcher, tenants domain.TenantRepository) *Handlers {
	return &Handlers{payouts: payouts, payment: paymentClient, dispatcher: dispatcher, tenants: tenants}
}

type processPayoutPayload struct {
	PayoutID string `json:"payout_id"`
	TenantID string `json:"tenant_id"`
}

// ProcessPayout is the job handler for domain.JobProcessPayout. It's
// idempotent — if the payout is no longer pending (already processed by a
// prior attempt), it does nothing.
func (h *Handlers) ProcessPayout(ctx context.Context, payload json.RawMessage) error {
	var p processPayoutPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	payoutID, err := uuid.Parse(p.PayoutID)
	if err != nil {
		return fmt.Errorf("invalid payout_id: %w", err)
	}
	tenantID, err := uuid.Parse(p.TenantID)
	if err != nil {
		return fmt.Errorf("invalid tenant_id: %w", err)
	}

	po, err := h.payouts.GetByID(ctx, payoutID, tenantID)
	if err != nil {
		return fmt.Errorf("get payout: %w", err)
	}
	if po.Status != string(domain.PayoutPending) {
		log.Info().Str("payout_id", payoutID.String()).Str("status", po.Status).
			Msg("payout: skip — no longer pending")
		return nil
	}

	if _, err := h.payouts.MarkProcessing(ctx, payoutID); err != nil {
		log.Error().Err(err).Str("payout_id", payoutID.String()).Msg("payout: failed to mark processing")
	}

	senderName := "Tori"
	if tenant, err := h.tenants.GetByID(ctx, tenantID); err == nil && tenant != nil {
		senderName = tenant.Name
	}

	resp, transferErr := h.payment.TransferToBank(ctx, payment.TransferRequest{
		Amount:        po.AmountKobo,
		Currency:      po.Currency,
		AccountNumber: po.AccountNumber,
		BankCode:      po.BankCode,
		Narration:     fmt.Sprintf("Tori payout %s", po.ID),
		Reference:     po.ID.String(),
		SenderName:    senderName,
	})

	if transferErr != nil || !resp.Success {
		reason := "transfer failed"
		if transferErr != nil {
			reason = transferErr.Error()
		} else if resp.FailureMessage != "" {
			reason = resp.FailureMessage
		}

		updated, err := h.payouts.MarkFailed(ctx, payoutID, reason)
		if err != nil {
			log.Error().Err(err).Str("payout_id", payoutID.String()).Msg("payout: failed to mark failed")
			return nil
		}
		log.Warn().Str("payout_id", payoutID.String()).Str("reason", reason).Msg("payout: transfer failed")
		h.fireEvent(ctx, tenantID, domain.EventPayoutFailed, updated)
		return nil
	}

	updated, err := h.payouts.MarkCompleted(ctx, payoutID, resp.Reference)
	if err != nil {
		log.Error().Err(err).Str("payout_id", payoutID.String()).Msg("payout: failed to mark completed")
		return nil
	}
	log.Info().Str("payout_id", payoutID.String()).Str("reference", resp.Reference).Msg("payout: transfer completed")
	h.fireEvent(ctx, tenantID, domain.EventPayoutCompleted, updated)
	return nil
}

func (h *Handlers) fireEvent(ctx context.Context, tenantID uuid.UUID, eventType domain.WebhookEventType, po *domain.Payout) {
	if h.dispatcher == nil {
		return
	}
	if err := h.dispatcher.DispatchAsync(ctx, tenantID, eventType, po, po.Mode); err != nil {
		log.Error().Err(err).Str("payout_id", po.ID.String()).Str("event_type", string(eventType)).
			Msg("payout: failed to dispatch webhook")
	}
}

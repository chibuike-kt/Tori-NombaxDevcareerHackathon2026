package billing

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// CheckAbandonedCheckouts finds subscriptions with no tokenKey and moves them to PAST_DUE.
// PENDING_PAYMENT subs abandoned after 1 hour — real money may have been charged,
// Nomba webhook may have failed to deliver.
// TRIALING subs abandoned after 24 hours — only ₦50 verification charge at risk.

func mustJSON(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}

func (h *Handlers) CheckAbandonedCheckouts(ctx context.Context, payload json.RawMessage) error {
	var p struct {
		TenantID string `json:"tenant_id"`
	}
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	tenantID, err := uuid.Parse(p.TenantID)
	if err != nil {
		return fmt.Errorf("invalid tenant_id: %w", err)
	}

	// Abandoned checkouts happen in both modes — sweep test and live separately.
	var subs []*domain.Subscription
	for _, mode := range []string{"live", "test"} {
		page, err := h.subs.List(ctx, tenantID, mode, 1000, 0)
		if err != nil {
			return fmt.Errorf("list subscriptions (mode=%s): %w", mode, err)
		}
		subs = append(subs, page...)
	}

	pendingCutoff := time.Now().UTC().Add(-1 * time.Hour)   // 1 hour for PENDING_PAYMENT
	trialCutoff := time.Now().UTC().Add(-24 * time.Hour)    // 24 hours for TRIALING

	abandoned := 0

	for _, sub := range subs {
		// Skip seeded subscriptions
		if sub.IdempotencyKey != nil && strings.HasPrefix(*sub.IdempotencyKey, "seed-") {
			continue
		}

		// Only check subs with no tokenKey
		if sub.TokenKey != "" {
			continue
		}

		// Determine cutoff based on status
		var cutoff time.Time
		switch sub.Status {
		case domain.StatusPendingPayment:
			cutoff = pendingCutoff
		case domain.StatusTrialing:
			cutoff = trialCutoff
		default:
			continue
		}

		// Only flag if old enough
		if sub.CreatedAt.After(cutoff) {
			continue
		}

		log.Warn().
			Str("sub_id", sub.ID.String()).
			Str("status", string(sub.Status)).
			Str("created_at", sub.CreatedAt.Format(time.RFC3339)).
			Dur("age", time.Since(sub.CreatedAt)).
			Msg("billing: abandoned checkout — no tokenKey, moving to PAST_DUE")

		_, updateErr := h.subs.UpdateStatus(ctx, sub.ID, tenantID, domain.StatusPastDue)
		if updateErr != nil {
			log.Error().Err(updateErr).Str("sub_id", sub.ID.String()).Msg("billing: failed to move abandoned checkout to PAST_DUE")
			continue
		}
		retryAt := time.Now().UTC().AddDate(0, 0, 3)
		_, _ = h.jobs.Enqueue(ctx, &tenantID, domain.JobRetryFailedPayment,
			mustJSON(map[string]string{
				"subscription_id": sub.ID.String(),
				"tenant_id":       tenantID.String(),
			}), retryAt, 3, sub.Mode)
		abandoned++
		log.Info().Str("sub_id", sub.ID.String()).Msg("billing: abandoned checkout moved to PAST_DUE, dunning retry scheduled Day 3")

		abandoned++
		log.Info().
			Str("sub_id", sub.ID.String()).
			Str("status", string(sub.Status)).
			Msg("billing: abandoned checkout moved to PAST_DUE")
	}

	log.Info().
		Int("abandoned", abandoned).
		Str("tenant_id", tenantID.String()).
		Msg("billing: abandoned checkout check complete")

	return nil
}

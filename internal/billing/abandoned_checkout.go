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

// CheckAbandonedCheckouts finds subscriptions created more than 24 hours ago
// with no tokenKey and moves them to PAST_DUE.
// Handles the case where a customer got the checkout URL but never completed payment.
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

	subs, err := h.subs.List(ctx, tenantID, 1000, 0)
	if err != nil {
		return fmt.Errorf("list subscriptions: %w", err)
	}

	cutoff := time.Now().UTC().Add(-24 * time.Hour)
	abandoned := 0

	for _, sub := range subs {
		// Skip seeded subscriptions — inserted directly via SQL without going through checkout
		if sub.IdempotencyKey != nil && strings.HasPrefix(*sub.IdempotencyKey, "seed-") {
			continue
		}

		// Only check ACTIVE or TRIALING subs with no tokenKey
		if sub.TokenKey != "" {
			continue
		}
		if sub.Status != domain.StatusActive &&
				sub.Status != domain.StatusTrialing &&
				sub.Status != domain.StatusPendingPayment {
				continue
		}

		// Only flag if created more than 24 hours ago
		if sub.CreatedAt.After(cutoff) {
			continue
		}

		log.Warn().
			Str("sub_id", sub.ID.String()).
			Str("status", string(sub.Status)).
			Str("created_at", sub.CreatedAt.Format(time.RFC3339)).
			Msg("billing: abandoned checkout — no tokenKey after 24 hours, moving to PAST_DUE")

		_, updateErr := h.subs.UpdateStatus(ctx, sub.ID, tenantID, domain.StatusPastDue)
		if updateErr != nil {
			log.Error().Err(updateErr).Str("sub_id", sub.ID.String()).Msg("billing: failed to move abandoned checkout to PAST_DUE")
			continue
		}

		abandoned++
		log.Info().Str("sub_id", sub.ID.String()).Msg("billing: abandoned checkout moved to PAST_DUE")
	}

	log.Info().
		Int("abandoned", abandoned).
		Str("tenant_id", tenantID.String()).
		Msg("billing: abandoned checkout check complete")

	return nil
}

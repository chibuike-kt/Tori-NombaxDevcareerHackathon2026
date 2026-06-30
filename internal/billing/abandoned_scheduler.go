package billing

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/rs/zerolog/log"
)

// ScheduleAbandonedCheckoutCheck enqueues a checkout_abandoned job for every tenant.
// Called once at worker startup — checks for abandoned checkouts from the past 24 hours.
func (h *Handlers) ScheduleAbandonedCheckoutCheck(ctx context.Context, tenants domain.TenantRepository, jobs domain.JobRepository) error {
	allTenants, err := tenants.List(ctx)
	if err != nil {
		return fmt.Errorf("abandoned checkout scheduler: list tenants: %w", err)
	}

	for _, tenant := range allTenants {
		payload, _ := json.Marshal(map[string]string{
			"tenant_id": tenant.ID.String(),
		})

		_, err := jobs.Enqueue(ctx, &tenant.ID, domain.JobCheckoutAbandoned, payload, time.Now(), 1)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenant.ID.String()).Msg("failed to enqueue abandoned checkout job")
			continue
		}

		log.Info().Str("tenant_id", tenant.ID.String()).Msg("abandoned checkout check scheduled")
	}

	return nil
}

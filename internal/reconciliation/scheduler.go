package reconciliation

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/rs/zerolog/log"
)

// ScheduleNightly enqueues a reconciliation job for every active tenant
// covering the previous 24 hours. Call this once at startup or via a cron.
func (s *Service) ScheduleNightly(ctx context.Context, tenants domain.TenantRepository, jobs domain.JobRepository) error {
	allTenants, err := tenants.List(ctx)
	if err != nil {
		return fmt.Errorf("reconciliation scheduler: list tenants: %w", err)
	}

	now := time.Now().UTC()
	from := now.Add(-24 * time.Hour)

	for _, tenant := range allTenants {
		payload, _ := json.Marshal(reconciliationPayload{
			TenantID: tenant.ID.String(),
			From:     from.Format(time.RFC3339),
			To:       now.Format(time.RFC3339),
		})

		tenantIDPtr := tenant.ID
		// Reconciliation only ever compares against Nomba's real transaction
		// history, which exists only for live-mode money movement.
		_, err := jobs.Enqueue(ctx, &tenantIDPtr, domain.JobReconciliation,
				payload, now, 3, "live") // run immediately (worker picks it up)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenant.ID.String()).
				Msg("reconciliation: failed to enqueue job")
			continue
		}

		log.Info().Str("tenant_id", tenant.ID.String()).
			Msg("reconciliation: nightly job enqueued")
	}

	return nil
}

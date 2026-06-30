package reconciliation

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type reconciliationPayload struct {
	TenantID string `json:"tenant_id"`
	From     string `json:"from"`
	To       string `json:"to"`
}

// HandleReconciliation is the job handler registered with the scheduler.
// Payload contains tenant_id, from, and to as RFC3339 strings.
func (s *Service) HandleReconciliation(ctx context.Context, payload json.RawMessage) error {
	var p reconciliationPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("reconciliation: unmarshal payload: %w", err)
	}

	tenantID, err := uuid.Parse(p.TenantID)
	if err != nil {
		return fmt.Errorf("reconciliation: invalid tenant_id: %w", err)
	}

	from, err := time.Parse(time.RFC3339, p.From)
	if err != nil {
		return fmt.Errorf("reconciliation: invalid from: %w", err)
	}

	to, err := time.Parse(time.RFC3339, p.To)
	if err != nil {
		return fmt.Errorf("reconciliation: invalid to: %w", err)
	}

	result, err := s.Run(ctx, tenantID, from, to)
	if err != nil {
		return fmt.Errorf("reconciliation: run failed: %w", err)
	}

	log.Info().
		Str("tenant_id", tenantID.String()).
		Int("matched", result.MatchedCount).
		Int("missing", result.MissingCount).
		Int("mismatched", result.MismatchCount).
		Int64("nomba_total_kobo", result.TotalNombaKobo).
		Int64("ledger_total_kobo", result.TotalLedgerKobo).
		Str("status", result.Status).
		Msg("reconciliation: job complete")

	return nil
}

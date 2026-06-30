package reconciliation

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/payment"
	db "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/db/generated"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

type Discrepancy struct {
	Type          string  `json:"type"`
	NombaTxRef    string  `json:"nomba_tx_ref"`
	NombaAmountKobo int64 `json:"nomba_amount_kobo,omitempty"`
	LedgerAmountKobo int64 `json:"ledger_amount_kobo,omitempty"`
	TimeCreated   string  `json:"time_created,omitempty"`
	Note          string  `json:"note"`
}

type RunResult struct {
	TenantID         uuid.UUID
	PeriodFrom       time.Time
	PeriodTo         time.Time
	NombaTxCount     int
	MatchedCount     int
	MissingCount     int
	MismatchCount    int
	TotalNombaKobo   int64
	TotalLedgerKobo  int64
	Discrepancies    []Discrepancy
	Status           string
}

type Service struct {
	pool    *pgxpool.Pool
	q       *db.Queries
	payment payment.NombaClient
	ledger  domain.LedgerRepository
}

func NewService(pool *pgxpool.Pool, paymentClient payment.NombaClient, ledger domain.LedgerRepository) *Service {
	return &Service{
		pool:    pool,
		q:       db.New(pool),
		payment: paymentClient,
		ledger:  ledger,
	}
}

// Run performs a reconciliation for a tenant over the given time window.
// It fetches all successful Nomba transactions and matches them against ledger entries.
func (s *Service) Run(ctx context.Context, tenantID uuid.UUID, from, to time.Time) (*RunResult, error) {
	result := &RunResult{
		TenantID:      tenantID,
		PeriodFrom:    from,
		PeriodTo:      to,
		Discrepancies: []Discrepancy{},
		Status:        "ok",
	}

	log.Info().
		Str("tenant_id", tenantID.String()).
		Str("from", from.Format(time.RFC3339)).
		Str("to", to.Format(time.RFC3339)).
		Msg("reconciliation: starting run")

// Fetch all successful Nomba transactions for the period, paginating if needed
var allTxs []payment.Transaction
cursor := ""
maxPages := 20 // safety cap — prevent infinite loops
pages := 0

for {
    if pages >= maxPages {
        log.Warn().
            Int("pages", pages).
            Str("tenant_id", tenantID.String()).
            Msg("reconciliation: hit max page limit — stopping pagination")
        break
    }

    page, err := s.payment.FetchSubAccountTransactions(ctx, from, to, 100, cursor)
    if err != nil {
        return nil, fmt.Errorf("reconciliation: fetch nomba transactions: %w", err)
    }
    allTxs = append(allTxs, page.Transactions...)
    pages++

    if !page.HasMore || page.NextCursor == cursor {
        break
    }
    cursor = page.NextCursor
}

	log.Info().
		Int("count", len(allTxs)).
		Str("tenant_id", tenantID.String()).
		Msg("reconciliation: fetched Nomba transactions")

	result.NombaTxCount = len(allTxs)

	for _, tx := range allTxs {
		result.TotalNombaKobo += tx.Amount

		if tx.Reference == "" {
			// No merchantTxRef — cannot match against ledger
			result.Discrepancies = append(result.Discrepancies, Discrepancy{
				Type:            "no_merchant_ref",
				NombaTxRef:      tx.Reference,
				NombaAmountKobo: tx.Amount,
				TimeCreated:     tx.CreatedAt,
				Note:            "Nomba transaction has no merchantTxRef — cannot match to ledger",
			})
			result.MissingCount++
			result.Status = "discrepancies_found"
			continue
		}

		// Look up ledger entry by idempotency key (which we set to merchantTxRef)
		entry, err := s.ledger.GetByIdempotencyKey(ctx, tx.Reference)
		if err != nil {
			if err == domain.ErrNotFound {
				// Nomba has a charge we have no ledger entry for
				log.Warn().
					Str("nomba_ref", tx.Reference).
					Int64("amount_kobo", tx.Amount).
					Msg("reconciliation: Nomba transaction missing from ledger")

				result.Discrepancies = append(result.Discrepancies, Discrepancy{
					Type:            "missing_in_ledger",
					NombaTxRef:      tx.Reference,
					NombaAmountKobo: tx.Amount,
					TimeCreated:     tx.CreatedAt,
					Note:            "Nomba transaction exists but no matching ledger entry found",
				})
				result.MissingCount++
				result.Status = "discrepancies_found"
				continue
			}
			return nil, fmt.Errorf("reconciliation: ledger lookup: %w", err)
		}

		result.TotalLedgerKobo += entry.Amount

		// Check amount matches
		if entry.Amount != tx.Amount {
			log.Warn().
				Str("nomba_ref", tx.Reference).
				Int64("nomba_amount", tx.Amount).
				Int64("ledger_amount", entry.Amount).
				Msg("reconciliation: amount mismatch")

			result.Discrepancies = append(result.Discrepancies, Discrepancy{
				Type:             "amount_mismatch",
				NombaTxRef:       tx.Reference,
				NombaAmountKobo:  tx.Amount,
				LedgerAmountKobo: entry.Amount,
				TimeCreated:      tx.CreatedAt,
				Note: fmt.Sprintf("Nomba amount (%d kobo) does not match ledger amount (%d kobo)",
					tx.Amount, entry.Amount),
			})
			result.MismatchCount++
			result.Status = "discrepancies_found"
			continue
		}

		result.MatchedCount++
	}

	log.Info().
		Int("matched", result.MatchedCount).
		Int("missing", result.MissingCount).
		Int("mismatched", result.MismatchCount).
		Str("status", result.Status).
		Msg("reconciliation: run complete")

	// Persist the run summary
	if err := s.persistRun(ctx, tenantID, result); err != nil {
		log.Error().Err(err).Msg("reconciliation: failed to persist run")
	}

	return result, nil
}

func (s *Service) persistRun(ctx context.Context, tenantID uuid.UUID, result *RunResult) error {
	discJSON, err := json.Marshal(result.Discrepancies)
	if err != nil {
		return err
	}

	_, err = s.q.CreateReconciliationRun(ctx, db.CreateReconciliationRunParams{
		TenantID:         tenantID,
		PeriodFrom:       result.PeriodFrom,
		PeriodTo:         result.PeriodTo,
		NombaTxCount:     int32(result.NombaTxCount),
		MatchedCount:     int32(result.MatchedCount),
		MissingCount:     int32(result.MissingCount),
		MismatchCount:    int32(result.MismatchCount),
		TotalNombaKobo:   result.TotalNombaKobo,
		TotalLedgerKobo:  result.TotalLedgerKobo,
		Discrepancies:    discJSON,
		Status:           result.Status,
	})
	return err
}

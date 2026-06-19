package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/db/generated"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type LedgerRepo struct {
	q *db.Queries
}

func NewLedgerRepo(pool *pgxpool.Pool) *LedgerRepo {
	return &LedgerRepo{q: db.New(pool)}
}

func (r *LedgerRepo) Append(ctx context.Context, tenantID uuid.UUID, subscriptionID, invoiceID, customerID *uuid.UUID, entryType domain.LedgerEntryType, direction domain.LedgerDirection, amount int64, currency, description, idempotencyKey string, metadata []byte) (*domain.LedgerEntry, error) {
	row, err := r.q.CreateLedgerEntry(ctx, db.CreateLedgerEntryParams{
		TenantID:       tenantID,
		SubscriptionID: toPgUUID(subscriptionID),
		InvoiceID:      toPgUUID(invoiceID),
		CustomerID:     toPgUUID(customerID),
		EntryType:      string(entryType),
		Direction:      string(direction),
		Amount:         amount,
		Currency:       currency,
		Description:    description,
		IdempotencyKey: idempotencyKey,
		Metadata:       metadata,
	})
	if err != nil {
		return nil, err
	}
	return ledgerEntryFromRow(row), nil
}

func (r *LedgerRepo) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*domain.LedgerEntry, error) {
	row, err := r.q.GetLedgerEntryByID(ctx, db.GetLedgerEntryByIDParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return ledgerEntryFromRow(row), nil
}

func (r *LedgerRepo) GetByIdempotencyKey(ctx context.Context, key string) (*domain.LedgerEntry, error) {
	row, err := r.q.GetLedgerEntryByIdempotencyKey(ctx, key)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return ledgerEntryFromRow(row), nil
}

func (r *LedgerRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]*domain.LedgerEntry, error) {
	rows, err := r.q.ListLedgerEntriesByTenant(ctx, db.ListLedgerEntriesByTenantParams{
		TenantID: tenantID,
		Limit:    int32(limit),
		Offset:   int32(offset),
	})
	if err != nil {
		return nil, err
	}
	return ledgerEntriesFromRows(rows), nil
}

func (r *LedgerRepo) ListBySubscription(ctx context.Context, tenantID, subscriptionID uuid.UUID, limit, offset int) ([]*domain.LedgerEntry, error) {
	rows, err := r.q.ListLedgerEntriesBySubscription(ctx, db.ListLedgerEntriesBySubscriptionParams{
		TenantID:       tenantID,
		SubscriptionID: toPgUUID(&subscriptionID),
		Limit:          int32(limit),
		Offset:         int32(offset),
	})
	if err != nil {
		return nil, err
	}
	return ledgerEntriesFromRows(rows), nil
}

func (r *LedgerRepo) ListByCustomer(ctx context.Context, tenantID, customerID uuid.UUID, limit, offset int) ([]*domain.LedgerEntry, error) {
	rows, err := r.q.ListLedgerEntriesByCustomer(ctx, db.ListLedgerEntriesByCustomerParams{
		TenantID:   tenantID,
		CustomerID: toPgUUID(&customerID),
		Limit:      int32(limit),
		Offset:     int32(offset),
	})
	if err != nil {
		return nil, err
	}
	return ledgerEntriesFromRows(rows), nil
}

func (r *LedgerRepo) ListByDateRange(ctx context.Context, tenantID uuid.UUID, from, to time.Time, limit, offset int) ([]*domain.LedgerEntry, error) {
	rows, err := r.q.ListLedgerEntriesByDateRange(ctx, db.ListLedgerEntriesByDateRangeParams{
		TenantID:  tenantID,
		CreatedAt: from,
		CreatedAt_2: to,
		Limit:     int32(limit),
		Offset:    int32(offset),
	})
	if err != nil {
		return nil, err
	}
	return ledgerEntriesFromRows(rows), nil
}

func (r *LedgerRepo) ListByTypeAndDateRange(ctx context.Context, tenantID uuid.UUID, types []string, from, to time.Time, limit, offset int) ([]*domain.LedgerEntry, error) {
	rows, err := r.q.ListLedgerEntriesByTypeAndDateRange(ctx, db.ListLedgerEntriesByTypeAndDateRangeParams{
		TenantID:  tenantID,
		Column2:   types,
		CreatedAt: from,
		CreatedAt_2: to,
		Limit:     int32(limit),
		Offset:    int32(offset),
	})
	if err != nil {
		return nil, err
	}
	return ledgerEntriesFromRows(rows), nil
}

func (r *LedgerRepo) GetSummary(ctx context.Context, tenantID uuid.UUID, from, to time.Time) (*domain.LedgerSummary, error) {
	row, err := r.q.GetLedgerSummary(ctx, db.GetLedgerSummaryParams{
		TenantID:    tenantID,
		CreatedAt:   from,
		CreatedAt_2: to,
	})
	if err != nil {
		return nil, err
	}
	return &domain.LedgerSummary{
		TotalDebits:         toInt64(row.TotalDebits),
		TotalCredits:        toInt64(row.TotalCredits),
		TotalCharged:        toInt64(row.TotalCharged),
		TotalRefunded:       toInt64(row.TotalRefunded),
		TotalCreditsApplied: toInt64(row.TotalCreditsApplied),
		EntryCount:          row.EntryCount,
	}, nil
}

func (r *LedgerRepo) GetMRR(ctx context.Context, tenantID uuid.UUID, from, to time.Time) (int64, error) {
	row, err := r.q.GetMRR(ctx, db.GetMRRParams{
		TenantID:    tenantID,
		CreatedAt:   from,
		CreatedAt_2: to,
	})
	if err != nil {
		return 0, err
	}
	return toInt64(row), nil
}

// toInt64 safely converts interface{} from sqlc aggregate results to int64.
// pgx returns numeric aggregates as int64 or pgtype.Numeric depending on context.
func toInt64(v interface{}) int64 {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case int64:
		return val
	case int32:
		return int64(val)
	case float64:
		return int64(val)
	default:
		return 0
	}
}

func ledgerEntryFromRow(row db.LedgerEntry) *domain.LedgerEntry {
	return &domain.LedgerEntry{
		ID:             row.ID,
		TenantID:       row.TenantID,
		SubscriptionID: fromPgUUID(row.SubscriptionID),
		InvoiceID:      fromPgUUID(row.InvoiceID),
		CustomerID:     fromPgUUID(row.CustomerID),
		EntryType:      domain.LedgerEntryType(row.EntryType),
		Direction:      domain.LedgerDirection(row.Direction),
		Amount:         row.Amount,
		Currency:       row.Currency,
		Description:    row.Description,
		IdempotencyKey: row.IdempotencyKey,
		Metadata:       row.Metadata,
		CreatedAt:      row.CreatedAt,
	}
}

func ledgerEntriesFromRows(rows []db.LedgerEntry) []*domain.LedgerEntry {
	entries := make([]*domain.LedgerEntry, len(rows))
	for i, row := range rows {
		entries[i] = ledgerEntryFromRow(row)
	}
	return entries
}

func toPgUUID(id *uuid.UUID) pgtype.UUID {
	if id == nil {
		return pgtype.UUID{Valid: false}
	}
	return pgtype.UUID{Bytes: *id, Valid: true}
}

func fromPgUUID(u pgtype.UUID) *uuid.UUID {
	if !u.Valid {
		return nil
	}
	id := uuid.UUID(u.Bytes)
	return &id
}

package postgres

import (
	"context"
	"errors"
	"fmt"

	db "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/db/generated"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PayoutRepo struct {
	q *db.Queries
}

func NewPayoutRepo(pool *pgxpool.Pool) *PayoutRepo {
	return &PayoutRepo{q: db.New(pool)}
}

func payoutFromRow(row db.Payout) *domain.Payout {
	p := &domain.Payout{
		ID:            row.ID,
		TenantID:      row.TenantID,
		Mode:          row.Mode,
		AmountKobo:    row.AmountKobo,
		Currency:      row.Currency,
		BankCode:      row.BankCode,
		BankName:      row.BankName,
		AccountNumber: row.AccountNumber,
		AccountName:   row.AccountName,
		Status:        row.Status,
		RequestedAt:   row.RequestedAt,
		CreatedAt:     row.CreatedAt,
		UpdatedAt:     row.UpdatedAt,
	}
	if row.NombaReference.Valid {
		p.NombaReference = &row.NombaReference.String
	}
	if row.FailureReason.Valid {
		p.FailureReason = &row.FailureReason.String
	}
	if row.CompletedAt.Valid {
		t := row.CompletedAt.Time
		p.CompletedAt = &t
	}
	return p
}

func (r *PayoutRepo) Create(ctx context.Context, tenantID uuid.UUID, mode string, amountKobo int64, currency, bankCode, bankName, accountNumber, accountName string) (*domain.Payout, error) {
	row, err := r.q.CreatePayout(ctx, db.CreatePayoutParams{
		TenantID:      tenantID,
		Mode:          mode,
		AmountKobo:    amountKobo,
		Currency:      currency,
		BankCode:      bankCode,
		BankName:      bankName,
		AccountNumber: accountNumber,
		AccountName:   accountName,
	})
	if err != nil {
		return nil, fmt.Errorf("create payout: %w", err)
	}
	return payoutFromRow(row), nil
}

func (r *PayoutRepo) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*domain.Payout, error) {
	row, err := r.q.GetPayoutByID(ctx, db.GetPayoutByIDParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get payout: %w", err)
	}
	return payoutFromRow(row), nil
}

func (r *PayoutRepo) GetByIDNoTenant(ctx context.Context, id uuid.UUID) (*domain.Payout, error) {
	row, err := r.q.GetPayoutByIDNoTenant(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get payout no tenant: %w", err)
	}
	return payoutFromRow(row), nil
}

func (r *PayoutRepo) List(ctx context.Context, tenantID uuid.UUID, mode string, limit, offset int) ([]*domain.Payout, error) {
	rows, err := r.q.ListPayouts(ctx, db.ListPayoutsParams{
		TenantID: tenantID,
		Mode:     mode,
		Limit:    int32(limit),
		Offset:   int32(offset),
	})
	if err != nil {
		return nil, fmt.Errorf("list payouts: %w", err)
	}
	payouts := make([]*domain.Payout, len(rows))
	for i, row := range rows {
		payouts[i] = payoutFromRow(row)
	}
	return payouts, nil
}

func (r *PayoutRepo) MarkProcessing(ctx context.Context, id uuid.UUID) (*domain.Payout, error) {
	row, err := r.q.MarkPayoutProcessing(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("mark payout processing: %w", err)
	}
	return payoutFromRow(row), nil
}

func (r *PayoutRepo) MarkCompleted(ctx context.Context, id uuid.UUID, nombaReference string) (*domain.Payout, error) {
	row, err := r.q.MarkPayoutCompleted(ctx, db.MarkPayoutCompletedParams{ID: id, NombaReference: toPgText(&nombaReference)})
	if err != nil {
		return nil, fmt.Errorf("mark payout completed: %w", err)
	}
	return payoutFromRow(row), nil
}

func (r *PayoutRepo) MarkFailed(ctx context.Context, id uuid.UUID, failureReason string) (*domain.Payout, error) {
	row, err := r.q.MarkPayoutFailed(ctx, db.MarkPayoutFailedParams{ID: id, FailureReason: toPgText(&failureReason)})
	if err != nil {
		return nil, fmt.Errorf("mark payout failed: %w", err)
	}
	return payoutFromRow(row), nil
}

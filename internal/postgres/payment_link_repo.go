package postgres

import (
	"context"
	"errors"
	"fmt"

	db "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/db/generated"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PaymentLinkRepo struct {
	q *db.Queries
}

func NewPaymentLinkRepo(pool *pgxpool.Pool) *PaymentLinkRepo {
	return &PaymentLinkRepo{q: db.New(pool)}
}

func paymentLinkFromRow(row db.PaymentLink) *domain.PaymentLink {
	l := &domain.PaymentLink{
		ID:         row.ID,
		TenantID:   row.TenantID,
		Mode:       row.Mode,
		Title:      row.Title,
		AmountKobo: row.AmountKobo,
		Currency:   row.Currency,
		UseCount:   int(row.UseCount),
		IsActive:   row.IsActive,
		CreatedAt:  row.CreatedAt,
		UpdatedAt:  row.UpdatedAt,
	}
	if row.Description.Valid {
		l.Description = row.Description.String
	}
	if row.MaxUses.Valid {
		n := int(row.MaxUses.Int32)
		l.MaxUses = &n
	}
	return l
}

func toPgInt4(n *int) pgtype.Int4 {
	if n == nil {
		return pgtype.Int4{Valid: false}
	}
	return pgtype.Int4{Int32: int32(*n), Valid: true}
}

func (r *PaymentLinkRepo) Create(ctx context.Context, tenantID uuid.UUID, mode, title, description string, amountKobo int64, currency string, maxUses *int) (*domain.PaymentLink, error) {
	row, err := r.q.CreatePaymentLink(ctx, db.CreatePaymentLinkParams{
		TenantID:    tenantID,
		Mode:        mode,
		Title:       title,
		Description: toPgText(&description),
		AmountKobo:  amountKobo,
		Currency:    currency,
		MaxUses:     toPgInt4(maxUses),
	})
	if err != nil {
		return nil, fmt.Errorf("create payment link: %w", err)
	}
	return paymentLinkFromRow(row), nil
}

func (r *PaymentLinkRepo) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*domain.PaymentLink, error) {
	row, err := r.q.GetPaymentLinkByID(ctx, db.GetPaymentLinkByIDParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get payment link: %w", err)
	}
	return paymentLinkFromRow(row), nil
}

func (r *PaymentLinkRepo) GetByIDNoTenant(ctx context.Context, id uuid.UUID) (*domain.PaymentLink, error) {
	row, err := r.q.GetPaymentLinkByIDNoTenant(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get payment link no tenant: %w", err)
	}
	return paymentLinkFromRow(row), nil
}

func (r *PaymentLinkRepo) List(ctx context.Context, tenantID uuid.UUID, mode string) ([]*domain.PaymentLink, error) {
	rows, err := r.q.ListPaymentLinks(ctx, db.ListPaymentLinksParams{TenantID: tenantID, Mode: mode})
	if err != nil {
		return nil, fmt.Errorf("list payment links: %w", err)
	}
	links := make([]*domain.PaymentLink, len(rows))
	for i, row := range rows {
		links[i] = paymentLinkFromRow(row)
	}
	return links, nil
}

func (r *PaymentLinkRepo) Deactivate(ctx context.Context, id, tenantID uuid.UUID) (*domain.PaymentLink, error) {
	row, err := r.q.DeactivatePaymentLink(ctx, db.DeactivatePaymentLinkParams{ID: id, TenantID: tenantID})
	if err != nil {
		return nil, fmt.Errorf("deactivate payment link: %w", err)
	}
	return paymentLinkFromRow(row), nil
}

func (r *PaymentLinkRepo) IncrementUseCount(ctx context.Context, id uuid.UUID) error {
	return r.q.IncrementPaymentLinkUseCount(ctx, id)
}

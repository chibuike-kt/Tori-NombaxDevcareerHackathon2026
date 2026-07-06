package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	db "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/db/generated"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PromoCodeRepo struct {
	q *db.Queries
}

func NewPromoCodeRepo(pool *pgxpool.Pool) *PromoCodeRepo {
	return &PromoCodeRepo{q: db.New(pool)}
}

func promoCodeFromRow(row db.PromoCode) *domain.PromoCode {
	p := &domain.PromoCode{
		ID:            row.ID,
		TenantID:      row.TenantID,
		Code:          row.Code,
		DiscountType:  domain.DiscountType(row.DiscountType),
		DiscountValue: row.DiscountValue,
		UseCount:      int(row.UseCount),
		IsActive:      row.IsActive,
		Mode:          row.Mode,
		CreatedAt:     row.CreatedAt,
		UpdatedAt:     row.UpdatedAt,
	}
	if row.Description.Valid {
		p.Description = row.Description.String
	}
	if row.PlanID.Valid {
		id := uuid.UUID(row.PlanID.Bytes)
		p.PlanID = &id
	}
	if row.MaxUses.Valid {
		n := int(row.MaxUses.Int32)
		p.MaxUses = &n
	}
	if row.ExpiresAt.Valid {
		t := row.ExpiresAt.Time
		p.ExpiresAt = &t
	}
	return p
}

func (r *PromoCodeRepo) Create(ctx context.Context, tenantID uuid.UUID, code, description string, discountType domain.DiscountType, discountValue int64, planID *uuid.UUID, maxUses *int, expiresAt *time.Time, mode string) (*domain.PromoCode, error) {
	pid := pgtype.UUID{}
	if planID != nil {
		pid = pgtype.UUID{Bytes: *planID, Valid: true}
	}
	mu := pgtype.Int4{}
	if maxUses != nil {
		mu = pgtype.Int4{Int32: int32(*maxUses), Valid: true}
	}

	row, err := r.q.CreatePromoCode(ctx, db.CreatePromoCodeParams{
		TenantID:      tenantID,
		Code:          code,
		Description:   pgtype.Text{String: description, Valid: description != ""},
		DiscountType:  string(discountType),
		DiscountValue: discountValue,
		PlanID:        pid,
		MaxUses:       mu,
		ExpiresAt:     toPgTimestamptz(expiresAt),
		Mode:          mode,
	})
	if err != nil {
		return nil, fmt.Errorf("create promo code: %w", err)
	}
	return promoCodeFromRow(row), nil
}

func (r *PromoCodeRepo) GetByCode(ctx context.Context, tenantID uuid.UUID, code string) (*domain.PromoCode, error) {
	row, err := r.q.GetPromoCodeByCode(ctx, db.GetPromoCodeByCodeParams{TenantID: tenantID, Code: code})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get promo code by code: %w", err)
	}
	return promoCodeFromRow(row), nil
}

func (r *PromoCodeRepo) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*domain.PromoCode, error) {
	row, err := r.q.GetPromoCodeByID(ctx, db.GetPromoCodeByIDParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get promo code by id: %w", err)
	}
	return promoCodeFromRow(row), nil
}

func (r *PromoCodeRepo) List(ctx context.Context, tenantID uuid.UUID, mode string) ([]*domain.PromoCode, error) {
	rows, err := r.q.ListAllPromoCodes(ctx, db.ListAllPromoCodesParams{TenantID: tenantID, Mode: mode})
	if err != nil {
		return nil, fmt.Errorf("list promo codes: %w", err)
	}
	codes := make([]*domain.PromoCode, len(rows))
	for i, row := range rows {
		codes[i] = promoCodeFromRow(row)
	}
	return codes, nil
}

func (r *PromoCodeRepo) IncrementUseCount(ctx context.Context, id uuid.UUID) error {
	return r.q.IncrementPromoUseCount(ctx, id)
}

func (r *PromoCodeRepo) Deactivate(ctx context.Context, id, tenantID uuid.UUID) (*domain.PromoCode, error) {
	row, err := r.q.DeactivatePromoCode(ctx, db.DeactivatePromoCodeParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("deactivate promo code: %w", err)
	}
	return promoCodeFromRow(row), nil
}

func (r *PromoCodeRepo) Delete(ctx context.Context, id, tenantID uuid.UUID) error {
	return r.q.DeletePromoCode(ctx, db.DeletePromoCodeParams{ID: id, TenantID: tenantID})
}

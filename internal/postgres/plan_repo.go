package postgres

import (
	"context"
	"errors"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/db/generated"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PlanRepo struct {
	q *db.Queries
}

func NewPlanRepo(pool *pgxpool.Pool) *PlanRepo {
	return &PlanRepo{q: db.New(pool)}
}

func (r *PlanRepo) Create(ctx context.Context, tenantID uuid.UUID, name string, description *string, amount int64, currency string, interval domain.PlanInterval, intervalCount, trialDays int, metadata []byte) (*domain.Plan, error) {
	row, err := r.q.CreatePlan(ctx, db.CreatePlanParams{
		TenantID:        tenantID,
		Name:            name,
		Description:     toPgText(description),
		Amount:          amount,
		Currency:        currency,
		Interval:        string(interval),
		IntervalCount:   int32(intervalCount),
		TrialPeriodDays: int32(trialDays),
		Metadata:        metadata,
	})
	if err != nil {
		return nil, err
	}
	return planFromRow(row), nil
}

func (r *PlanRepo) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*domain.Plan, error) {
	row, err := r.q.GetPlanByID(ctx, db.GetPlanByIDParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return planFromRow(row), nil
}

func (r *PlanRepo) List(ctx context.Context, tenantID uuid.UUID) ([]*domain.Plan, error) {
	rows, err := r.q.ListPlans(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	plans := make([]*domain.Plan, len(rows))
	for i, row := range rows {
		plans[i] = planFromRow(row)
	}
	return plans, nil
}

func (r *PlanRepo) ListAll(ctx context.Context, tenantID uuid.UUID) ([]*domain.Plan, error) {
	rows, err := r.q.ListAllPlans(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	plans := make([]*domain.Plan, len(rows))
	for i, row := range rows {
		plans[i] = planFromRow(row)
	}
	return plans, nil
}

func (r *PlanRepo) Update(ctx context.Context, id, tenantID uuid.UUID, name string, description *string, amount int64, trialDays int, metadata []byte) (*domain.Plan, error) {
	row, err := r.q.UpdatePlan(ctx, db.UpdatePlanParams{
		ID:              id,
		TenantID:        tenantID,
		Name:            name,
		Description:     toPgText(description),
		Amount:          amount,
		TrialPeriodDays: int32(trialDays),
		Metadata:        metadata,
	})
	if err != nil {
		return nil, err
	}
	return planFromRow(row), nil
}

func (r *PlanRepo) Deactivate(ctx context.Context, id, tenantID uuid.UUID) error {
	return r.q.DeactivatePlan(ctx, db.DeactivatePlanParams{ID: id, TenantID: tenantID})
}

func planFromRow(row db.Plan) *domain.Plan {
	desc := fromPgText(row.Description)
	return &domain.Plan{
		ID:              row.ID,
		TenantID:        row.TenantID,
		Name:            row.Name,
		Description:     desc,
		Amount:          row.Amount,
		Currency:        row.Currency,
		Interval:        domain.PlanInterval(row.Interval),
		IntervalCount:   int(row.IntervalCount),
		TrialPeriodDays: int(row.TrialPeriodDays),
		IsActive:        row.IsActive,
		Metadata:        row.Metadata,
		CreatedAt:       row.CreatedAt,
	}
}

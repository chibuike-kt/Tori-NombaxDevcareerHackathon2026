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

type SubscriptionRepo struct {
	q *db.Queries
}

func NewSubscriptionRepo(pool *pgxpool.Pool) *SubscriptionRepo {
	return &SubscriptionRepo{q: db.New(pool)}
}

func (r *SubscriptionRepo) Create(ctx context.Context, tenantID, customerID, planID uuid.UUID, status domain.SubscriptionStatus, periodStart, periodEnd time.Time, trialEnd *time.Time, idempotencyKey *string, metadata []byte) (*domain.Subscription, error) {
	row, err := r.q.CreateSubscription(ctx, db.CreateSubscriptionParams{
		TenantID:           tenantID,
		CustomerID:         customerID,
		PlanID:             planID,
		Status:             string(status),
		CurrentPeriodStart: periodStart,
		CurrentPeriodEnd:   periodEnd,
		TrialEnd:           toPgTimestamptz(trialEnd),
		IdempotencyKey:     toPgText(idempotencyKey),
		Metadata:           metadata,
	})
	if err != nil {
		return nil, err
	}
	return subFromRow(row), nil
}

func (r *SubscriptionRepo) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*domain.Subscription, error) {
	row, err := r.q.GetSubscriptionByID(ctx, db.GetSubscriptionByIDParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return subFromRow(row), nil
}

func (r *SubscriptionRepo) GetByIDNoTenant(ctx context.Context, id uuid.UUID) (*domain.Subscription, error) {
	row, err := r.q.GetSubscriptionByIDNoTenant(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return subFromRow(row), nil
}

func (r *SubscriptionRepo) GetByIdempotencyKey(ctx context.Context, key string, tenantID uuid.UUID) (*domain.Subscription, error) {
	row, err := r.q.GetSubscriptionByIdempotencyKey(ctx, db.GetSubscriptionByIdempotencyKeyParams{
		IdempotencyKey: toPgText(&key),
		TenantID:       tenantID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return subFromRow(row), nil
}

func (r *SubscriptionRepo) List(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]*domain.Subscription, error) {
	rows, err := r.q.ListSubscriptions(ctx, db.ListSubscriptionsParams{
		TenantID: tenantID,
		Limit:    int32(limit),
		Offset:   int32(offset),
	})
	if err != nil {
		return nil, err
	}
	return subsFromRows(rows), nil
}

func (r *SubscriptionRepo) ListByStatus(ctx context.Context, tenantID uuid.UUID, status domain.SubscriptionStatus, limit, offset int) ([]*domain.Subscription, error) {
	rows, err := r.q.ListSubscriptionsByStatus(ctx, db.ListSubscriptionsByStatusParams{
		TenantID: tenantID,
		Status:   string(status),
		Limit:    int32(limit),
		Offset:   int32(offset),
	})
	if err != nil {
		return nil, err
	}
	return subsFromRows(rows), nil
}

func (r *SubscriptionRepo) ListByCustomer(ctx context.Context, tenantID, customerID uuid.UUID) ([]*domain.Subscription, error) {
	rows, err := r.q.ListSubscriptionsByCustomer(ctx, db.ListSubscriptionsByCustomerParams{
		TenantID:   tenantID,
		CustomerID: customerID,
	})
	if err != nil {
		return nil, err
	}
	return subsFromRows(rows), nil
}

func (r *SubscriptionRepo) UpdateStatus(ctx context.Context, id, tenantID uuid.UUID, status domain.SubscriptionStatus) (*domain.Subscription, error) {
	row, err := r.q.UpdateSubscriptionStatus(ctx, db.UpdateSubscriptionStatusParams{
		ID:       id,
		TenantID: tenantID,
		Status:   string(status),
	})
	if err != nil {
		return nil, err
	}
	return subFromRow(row), nil
}

func (r *SubscriptionRepo) UpdateAfterRenewal(ctx context.Context, id, tenantID uuid.UUID, status domain.SubscriptionStatus, periodStart, periodEnd time.Time) (*domain.Subscription, error) {
	row, err := r.q.UpdateSubscriptionAfterRenewal(ctx, db.UpdateSubscriptionAfterRenewalParams{
		ID:                 id,
		TenantID:           tenantID,
		Status:             string(status),
		CurrentPeriodStart: periodStart,
		CurrentPeriodEnd:   periodEnd,
	})
	if err != nil {
		return nil, err
	}
	return subFromRow(row), nil
}

func (r *SubscriptionRepo) UpdateDunning(ctx context.Context, id, tenantID uuid.UUID, status domain.SubscriptionStatus, attempt int, nextRetryAt *time.Time) (*domain.Subscription, error) {
	row, err := r.q.UpdateSubscriptionDunning(ctx, db.UpdateSubscriptionDunningParams{
		ID:             id,
		TenantID:       tenantID,
		Status:         string(status),
		DunningAttempt: int32(attempt),
		NextRetryAt:    toPgTimestamptz(nextRetryAt),
	})
	if err != nil {
		return nil, err
	}
	return subFromRow(row), nil
}

func (r *SubscriptionRepo) UpdatePlan(ctx context.Context, id, tenantID, planID uuid.UUID) (*domain.Subscription, error) {
	row, err := r.q.UpdateSubscriptionPlan(ctx, db.UpdateSubscriptionPlanParams{
		ID:       id,
		TenantID: tenantID,
		PlanID:   planID,
	})
	if err != nil {
		return nil, err
	}
	return subFromRow(row), nil
}

func (r *SubscriptionRepo) Cancel(ctx context.Context, id, tenantID uuid.UUID) (*domain.Subscription, error) {
	row, err := r.q.CancelSubscription(ctx, db.CancelSubscriptionParams{ID: id, TenantID: tenantID})
	if err != nil {
		return nil, err
	}
	return subFromRow(row), nil
}

func (r *SubscriptionRepo) Pause(ctx context.Context, id, tenantID uuid.UUID) (*domain.Subscription, error) {
	row, err := r.q.PauseSubscription(ctx, db.PauseSubscriptionParams{ID: id, TenantID: tenantID})
	if err != nil {
		return nil, err
	}
	return subFromRow(row), nil
}

func (r *SubscriptionRepo) Resume(ctx context.Context, id, tenantID uuid.UUID) (*domain.Subscription, error) {
	row, err := r.q.ResumeSubscription(ctx, db.ResumeSubscriptionParams{ID: id, TenantID: tenantID})
	if err != nil {
		return nil, err
	}
	return subFromRow(row), nil
}

func (r *SubscriptionRepo) ListActiveDue(ctx context.Context, asOf time.Time, limit int) ([]*domain.Subscription, error) {
	rows, err := r.q.ListActiveSubscriptionsDue(ctx, db.ListActiveSubscriptionsDueParams{
		CurrentPeriodEnd: asOf,
		Limit:            int32(limit),
	})
	if err != nil {
		return nil, err
	}
	return subsFromRows(rows), nil
}

func (r *SubscriptionRepo) ListTrialingDue(ctx context.Context, asOf time.Time, limit int) ([]*domain.Subscription, error) {
	rows, err := r.q.ListTrialingSubscriptionsDue(ctx, db.ListTrialingSubscriptionsDueParams{
		TrialEnd: toPgTimestamptz(&asOf),
		Limit:    int32(limit),
	})
	if err != nil {
		return nil, err
	}
	return subsFromRows(rows), nil
}

func (r *SubscriptionRepo) ListDueForRetry(ctx context.Context, asOf time.Time, limit int) ([]*domain.Subscription, error) {
	rows, err := r.q.ListSubscriptionsDueForRetry(ctx, db.ListSubscriptionsDueForRetryParams{
		NextRetryAt: toPgTimestamptz(&asOf),
		Limit:       int32(limit),
	})
	if err != nil {
		return nil, err
	}
	return subsFromRows(rows), nil
}

func subFromRow(row db.Subscription) *domain.Subscription {
	return &domain.Subscription{
		ID:                 row.ID,
		TenantID:           row.TenantID,
		CustomerID:         row.CustomerID,
		PlanID:             row.PlanID,
		Status:             domain.SubscriptionStatus(row.Status),
		CurrentPeriodStart: row.CurrentPeriodStart,
		CurrentPeriodEnd:   row.CurrentPeriodEnd,
		TrialEnd:           fromPgTimestamptz(row.TrialEnd),
		PausedAt:           fromPgTimestamptz(row.PausedAt),
		CancelledAt:        fromPgTimestamptz(row.CancelledAt),
		CancelAtPeriodEnd:  row.CancelAtPeriodEnd,
		DunningAttempt:     int(row.DunningAttempt),
		NextRetryAt:        fromPgTimestamptz(row.NextRetryAt),
		IdempotencyKey:     fromPgText(row.IdempotencyKey),
		Metadata:           row.Metadata,
		CreatedAt:          row.CreatedAt,
		UpdatedAt:          row.UpdatedAt,
	}
}

func subsFromRows(rows []db.Subscription) []*domain.Subscription {
	subs := make([]*domain.Subscription, len(rows))
	for i, row := range rows {
		subs[i] = subFromRow(row)
	}
	return subs
}

func toPgTimestamptz(t *time.Time) pgtype.Timestamptz {
	if t == nil {
		return pgtype.Timestamptz{Valid: false}
	}
	return pgtype.Timestamptz{Time: *t, Valid: true}
}

func fromPgTimestamptz(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	return &t.Time
}

func (r *SubscriptionRepo) UpdateStatusOptimistic(ctx context.Context, id, tenantID uuid.UUID, status domain.SubscriptionStatus, lastUpdatedAt time.Time) (*domain.Subscription, error) {
	row, err := r.q.UpdateSubscriptionStatusOptimistic(ctx, db.UpdateSubscriptionStatusOptimisticParams{
		ID:        id,
		TenantID:  tenantID,
		Status:    string(status),
		UpdatedAt: lastUpdatedAt,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrConflict
		}
		return nil, err
	}
	return subFromRow(row), nil
}

func (r *SubscriptionRepo) ListByCustomerNoTenant(ctx context.Context, customerID uuid.UUID) ([]*domain.Subscription, error) {
	rows, err := r.q.ListSubscriptionsByCustomerNoTenant(ctx, customerID)
	if err != nil {
		return nil, err
	}
	return subsFromRows(rows), nil
}

package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/db/generated"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

type SubscriptionRepo struct {
	q    *db.Queries
	pool *pgxpool.Pool
}

func NewSubscriptionRepo(pool *pgxpool.Pool) *SubscriptionRepo {
	return &SubscriptionRepo{q: db.New(pool), pool: pool}
}

func (r *SubscriptionRepo) Create(ctx context.Context, tenantID, customerID, planID uuid.UUID, status domain.SubscriptionStatus, periodStart, periodEnd time.Time, trialEnd *time.Time, idempotencyKey *string, metadata []byte, discountKobo int64, mode string) (*domain.Subscription, error) {
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
		DiscountKobo:       discountKobo,
		Mode:               mode,
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

func (r *SubscriptionRepo) List(ctx context.Context, tenantID uuid.UUID, mode string, limit, offset int) ([]*domain.Subscription, error) {
	rows, err := r.q.ListSubscriptions(ctx, db.ListSubscriptionsParams{
		TenantID: tenantID,
		Mode:     mode,
		Limit:    int32(limit),
		Offset:   int32(offset),
	})
	if err != nil {
		return nil, err
	}
	return subsFromRows(rows), nil
}

func (r *SubscriptionRepo) ListByStatus(ctx context.Context, tenantID uuid.UUID, status domain.SubscriptionStatus, mode string, limit, offset int) ([]*domain.Subscription, error) {
	rows, err := r.q.ListSubscriptionsByStatus(ctx, db.ListSubscriptionsByStatusParams{
		TenantID: tenantID,
		Status:   string(status),
		Mode:     mode,
		Limit:    int32(limit),
		Offset:   int32(offset),
	})
	if err != nil {
		return nil, err
	}
	return subsFromRows(rows), nil
}

func (r *SubscriptionRepo) ListByCustomer(ctx context.Context, tenantID, customerID uuid.UUID, mode string) ([]*domain.Subscription, error) {
	rows, err := r.q.ListSubscriptionsByCustomer(ctx, db.ListSubscriptionsByCustomerParams{
		TenantID:   tenantID,
		CustomerID: customerID,
		Mode:       mode,
	})
	if err != nil {
		return nil, err
	}
	return subsFromRows(rows), nil
}

func (r *SubscriptionRepo) UpdateStatus(ctx context.Context, id, tenantID uuid.UUID, status domain.SubscriptionStatus) (*domain.Subscription, error) {
	before, err := r.q.GetSubscriptionByID(ctx, db.GetSubscriptionByIDParams{ID: id, TenantID: tenantID})
	if err != nil {
		return nil, err
	}

	row, err := r.q.UpdateSubscriptionStatus(ctx, db.UpdateSubscriptionStatusParams{
		ID:       id,
		TenantID: tenantID,
		Status:   string(status),
	})
	if err != nil {
		return nil, err
	}

	r.recordTransition(ctx, id, tenantID, domain.SubscriptionStatus(before.Status), status, "status_update", "system")
	return subFromRow(row), nil
}

func (r *SubscriptionRepo) UpdateAfterRenewal(ctx context.Context, id, tenantID uuid.UUID, status domain.SubscriptionStatus, periodStart, periodEnd time.Time) (*domain.Subscription, error) {
	before, err := r.q.GetSubscriptionByID(ctx, db.GetSubscriptionByIDParams{ID: id, TenantID: tenantID})
	if err != nil {
		return nil, err
	}

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

	r.recordTransition(ctx, id, tenantID, domain.SubscriptionStatus(before.Status), status, "renewal", "system")
	return subFromRow(row), nil
}

func (r *SubscriptionRepo) ResumeForward(ctx context.Context, id, tenantID uuid.UUID, status domain.SubscriptionStatus, periodStart, periodEnd time.Time, reason string) (*domain.Subscription, error) {
	before, err := r.q.GetSubscriptionByID(ctx, db.GetSubscriptionByIDParams{ID: id, TenantID: tenantID})
	if err != nil {
		return nil, err
	}

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

	r.recordTransition(ctx, id, tenantID, domain.SubscriptionStatus(before.Status), status, reason, "system")
	return subFromRow(row), nil
}

func (r *SubscriptionRepo) ResumeForwardOptimistic(ctx context.Context, id, tenantID uuid.UUID, status domain.SubscriptionStatus, periodStart, periodEnd time.Time, reason string, lastUpdatedAt time.Time) (*domain.Subscription, error) {
	before, err := r.q.GetSubscriptionByID(ctx, db.GetSubscriptionByIDParams{ID: id, TenantID: tenantID})
	if err != nil {
		return nil, err
	}

	row, err := r.q.UpdateSubscriptionAfterRenewalOptimistic(ctx, db.UpdateSubscriptionAfterRenewalOptimisticParams{
		ID:                 id,
		TenantID:           tenantID,
		Status:             string(status),
		CurrentPeriodStart: periodStart,
		CurrentPeriodEnd:   periodEnd,
		UpdatedAt:          lastUpdatedAt,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrConflict
		}
		return nil, err
	}

	r.recordTransition(ctx, id, tenantID, domain.SubscriptionStatus(before.Status), status, reason, "system")
	return subFromRow(row), nil
}

// recordTransition writes an audit-trail row for a status change. Failures
// are logged, not propagated — the audit trail must never block billing.
func (r *SubscriptionRepo) recordTransition(ctx context.Context, subscriptionID, tenantID uuid.UUID, from, to domain.SubscriptionStatus, reason, actor string) {
	if from == to {
		return
	}
	_, err := r.q.CreateSubscriptionTransition(ctx, db.CreateSubscriptionTransitionParams{
		SubscriptionID: subscriptionID,
		TenantID:       tenantID,
		FromStatus:     string(from),
		ToStatus:       string(to),
		Reason:         pgtype.Text{String: reason, Valid: reason != ""},
		Actor:          actor,
	})
	if err != nil {
		log.Error().Err(err).Str("subscription_id", subscriptionID.String()).Msg("subscription: failed to record transition")
	}
}

func (r *SubscriptionRepo) ListTransitions(ctx context.Context, id, tenantID uuid.UUID, limit, offset int) ([]*domain.SubscriptionTransition, error) {
	rows, err := r.q.ListSubscriptionTransitions(ctx, db.ListSubscriptionTransitionsParams{
		SubscriptionID: id,
		TenantID:       tenantID,
		Limit:          int32(limit),
		Offset:         int32(offset),
	})
	if err != nil {
		return nil, err
	}
	out := make([]*domain.SubscriptionTransition, len(rows))
	for i, row := range rows {
		out[i] = transitionFromRow(row)
	}
	return out, nil
}

func transitionFromRow(row db.SubscriptionTransition) *domain.SubscriptionTransition {
	t := &domain.SubscriptionTransition{
		ID:             row.ID,
		SubscriptionID: row.SubscriptionID,
		TenantID:       row.TenantID,
		FromStatus:     row.FromStatus,
		ToStatus:       row.ToStatus,
		Actor:          row.Actor,
		CreatedAt:      row.CreatedAt,
	}
	if row.Reason.Valid {
		t.Reason = row.Reason.String
	}
	return t
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
		TokenKey: func() string {
			if row.TokenKey.Valid {
				return row.TokenKey.String
			}
			return ""
		}(),
		MandateID: func() string {
			if row.MandateID.Valid {
				return row.MandateID.String
			}
			return ""
		}(),
		RecoveryRail:       row.RecoveryRail,
		Metadata:           row.Metadata,
		DiscountKobo:       row.DiscountKobo,
		Mode:               row.Mode,
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

func (r *SubscriptionRepo) UpdateTokenKey(ctx context.Context, id, tenantID uuid.UUID, tokenKey string) (*domain.Subscription, error) {
	row, err := r.q.UpdateSubscriptionTokenKey(ctx, db.UpdateSubscriptionTokenKeyParams{
		ID:       id,
		TenantID: tenantID,
		TokenKey: pgtype.Text{String: tokenKey, Valid: true},
	})
	if err != nil {
		return nil, err
	}
	return subFromRow(row), nil
}

func (r *SubscriptionRepo) CancelAtPeriodEnd(ctx context.Context, id, tenantID uuid.UUID) (*domain.Subscription, error) {
	var s db.Subscription
	err := r.pool.QueryRow(ctx,
		`UPDATE subscriptions
		 SET cancel_at_period_end = true, updated_at = NOW()
		 WHERE id = $1 AND tenant_id = $2
		 RETURNING id, tenant_id, customer_id, plan_id, status, current_period_start,
		           current_period_end, trial_end, paused_at, cancelled_at, cancel_at_period_end,
		           dunning_attempt, next_retry_at, idempotency_key, metadata, created_at, updated_at, token_key`,
		id, tenantID,
	).Scan(
		&s.ID, &s.TenantID, &s.CustomerID, &s.PlanID, &s.Status,
		&s.CurrentPeriodStart, &s.CurrentPeriodEnd, &s.TrialEnd,
		&s.PausedAt, &s.CancelledAt, &s.CancelAtPeriodEnd,
		&s.DunningAttempt, &s.NextRetryAt, &s.IdempotencyKey,
		&s.Metadata, &s.CreatedAt, &s.UpdatedAt, &s.TokenKey,
	)
	if err != nil {
		return nil, fmt.Errorf("cancel at period end: %w", err)
	}
	return subFromRow(s), nil
}

func (r *SubscriptionRepo) SetMandate(ctx context.Context, id, tenantID uuid.UUID, mandateID string) (*domain.Subscription, error) {
	row, err := r.q.SetSubscriptionMandate(ctx, db.SetSubscriptionMandateParams{
		ID:        id,
		TenantID:  tenantID,
		MandateID: pgtype.Text{String: mandateID, Valid: true},
	})
	if err != nil {
		return nil, err
	}
	return subFromRow(row), nil
}

func (r *SubscriptionRepo) UpdateRecoveryRail(ctx context.Context, id, tenantID uuid.UUID, rail string) (*domain.Subscription, error) {
	row, err := r.q.UpdateSubscriptionRecoveryRail(ctx, db.UpdateSubscriptionRecoveryRailParams{
		ID:           id,
		TenantID:     tenantID,
		RecoveryRail: rail,
	})
	if err != nil {
		return nil, err
	}
	return subFromRow(row), nil
}

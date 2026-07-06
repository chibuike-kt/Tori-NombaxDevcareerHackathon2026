package postgres

import (
	"context"
	"errors"
	"time"
	"encoding/json"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/db/generated"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type JobRepo struct {
	q *db.Queries
}

func NewJobRepo(pool *pgxpool.Pool) *JobRepo {
	return &JobRepo{q: db.New(pool)}
}

func (r *JobRepo) Enqueue(ctx context.Context, tenantID *uuid.UUID, jobType domain.JobType, payload []byte, scheduledAt time.Time, maxAttempts int, mode string) (*domain.ScheduledJob, error) {
	row, err := r.q.EnqueueJob(ctx, db.EnqueueJobParams{
		TenantID:    toPgUUID(tenantID),
		JobType:     string(jobType),
		Payload:     payload,
		ScheduledAt: scheduledAt,
		MaxAttempts: int32(maxAttempts),
		Mode:        mode,
	})
	if err != nil {
		return nil, err
	}
	return jobFromRow(row), nil
}

func (r *JobRepo) ClaimNext(ctx context.Context, workerID string) (*domain.ScheduledJob, error) {
	row, err := r.q.ClaimNextJob(ctx, pgtype.Text{String: workerID, Valid: true})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return jobFromRow(row), nil
}

func (r *JobRepo) MarkDone(ctx context.Context, id uuid.UUID) error {
	return r.q.MarkJobDone(ctx, id)
}

func (r *JobRepo) MarkFailed(ctx context.Context, id uuid.UUID, lastError string) error {
	return r.q.MarkJobFailed(ctx, db.MarkJobFailedParams{
		ID:        id,
		LastError: toPgText(&lastError),
	})
}

func (r *JobRepo) Requeue(ctx context.Context, id uuid.UUID, scheduledAt time.Time) error {
	return r.q.RequeueJob(ctx, db.RequeueJobParams{ID: id, ScheduledAt: scheduledAt})
}

func (r *JobRepo) RecoverStaleLocks(ctx context.Context) error {
	return r.q.RecoverStaleLocks(ctx)
}

func (r *JobRepo) GetQueueDepth(ctx context.Context) (int64, error) {
	depth, err := r.q.GetJobQueueDepth(ctx)
	if err != nil {
		return 0, err
	}
	return depth, nil
}

func (r *JobRepo) ListFailed(ctx context.Context, limit, offset int) ([]*domain.ScheduledJob, error) {
	rows, err := r.q.ListFailedJobs(ctx, db.ListFailedJobsParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		return nil, err
	}
	jobs := make([]*domain.ScheduledJob, len(rows))
	for i, row := range rows {
		jobs[i] = jobFromRow(row)
	}
	return jobs, nil
}

func (r *JobRepo) Retry(ctx context.Context, id uuid.UUID) error {
	return r.q.RetryJob(ctx, id)
}

func jobFromRow(row db.ScheduledJob) *domain.ScheduledJob {
	var tenantID *uuid.UUID
	if row.TenantID.Valid {
		id := uuid.UUID(row.TenantID.Bytes)
		tenantID = &id
	}
	return &domain.ScheduledJob{
		ID:          row.ID,
		TenantID:    tenantID,
		JobType:     domain.JobType(row.JobType),
		Payload:     row.Payload,
		Status:      row.Status,
		ScheduledAt: row.ScheduledAt,
		LockedAt:    fromPgTimestamptz(row.LockedAt),
		LockedBy:    fromPgText(row.LockedBy),
		Attempts:    int(row.Attempts),
		MaxAttempts: int(row.MaxAttempts),
		LastError:   fromPgText(row.LastError),
		Mode:        row.Mode,
		CreatedAt:   row.CreatedAt,
	}
}

func (r *JobRepo) CancelPendingJobsForSubscription(ctx context.Context, subscriptionID string) error {
	payload := json.RawMessage(`"` + subscriptionID + `"`)
	return r.q.CancelPendingJobsForSubscription(ctx, payload)
}

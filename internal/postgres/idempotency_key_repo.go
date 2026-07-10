package postgres

import (
	"context"
	"encoding/json"
	"errors"

	db "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/db/generated"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type IdempotencyKeyRepo struct {
	q *db.Queries
}

func NewIdempotencyKeyRepo(pool *pgxpool.Pool) *IdempotencyKeyRepo {
	return &IdempotencyKeyRepo{q: db.New(pool)}
}

func idempotencyKeyFromRow(row db.IdempotencyKey) *domain.IdempotencyKey {
	return &domain.IdempotencyKey{
		ID:             row.ID,
		TenantID:       row.TenantID,
		Key:            row.IdempotencyKey,
		RequestPath:    row.RequestPath,
		RequestMethod:  row.RequestMethod,
		ResponseStatus: int(row.ResponseStatus),
		ResponseBody:   row.ResponseBody,
		Mode:           row.Mode,
		CreatedAt:      row.CreatedAt,
		ExpiresAt:      row.ExpiresAt,
	}
}

func (r *IdempotencyKeyRepo) Get(ctx context.Context, tenantID uuid.UUID, key string) (*domain.IdempotencyKey, error) {
	row, err := r.q.GetIdempotencyKey(ctx, db.GetIdempotencyKeyParams{
		TenantID:       tenantID,
		IdempotencyKey: key,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return idempotencyKeyFromRow(row), nil
}

func (r *IdempotencyKeyRepo) Store(ctx context.Context, tenantID uuid.UUID, key, path, method string, status int, body json.RawMessage, mode string) error {
	_, err := r.q.CreateIdempotencyKey(ctx, db.CreateIdempotencyKeyParams{
		TenantID:       tenantID,
		IdempotencyKey: key,
		RequestPath:    path,
		RequestMethod:  method,
		ResponseStatus: int32(status),
		ResponseBody:   body,
		Mode:           mode,
	})
	if err != nil {
		// ON CONFLICT DO NOTHING with no matched row makes RETURNING yield
		// zero rows — a concurrent request already stored this key first,
		// which is fine, not a failure.
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}
	return nil
}

func (r *IdempotencyKeyRepo) DeleteExpired(ctx context.Context) error {
	return r.q.DeleteExpiredIdempotencyKeys(ctx)
}

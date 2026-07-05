package postgres

import (
	"context"
	"fmt"

	db "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/db/generated"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type APIKeyRepo struct {
	q *db.Queries
}

func NewAPIKeyRepo(pool *pgxpool.Pool) *APIKeyRepo {
	return &APIKeyRepo{q: db.New(pool)}
}

func apiKeyFromRow(row db.ApiKey) *domain.APIKey {
	k := &domain.APIKey{
		ID:        row.ID,
		TenantID:  row.TenantID,
		Mode:      row.Mode,
		KeyHash:   row.KeyHash,
		KeyHint:   row.KeyHint,
		CreatedAt: row.CreatedAt,
	}
	if row.LastUsedAt.Valid {
		t := row.LastUsedAt.Time
		k.LastUsedAt = &t
	}
	return k
}

func (r *APIKeyRepo) Upsert(ctx context.Context, tenantID uuid.UUID, mode, keyHash, keyHint string) (*domain.APIKey, error) {
	row, err := r.q.UpsertAPIKey(ctx, db.UpsertAPIKeyParams{
		TenantID: tenantID,
		Mode:     mode,
		KeyHash:  keyHash,
		KeyHint:  keyHint,
	})
	if err != nil {
		return nil, fmt.Errorf("upsert api key: %w", err)
	}
	return apiKeyFromRow(row), nil
}

func (r *APIKeyRepo) GetByHash(ctx context.Context, keyHash string) (*domain.APIKey, error) {
	row, err := r.q.GetAPIKeyByHash(ctx, keyHash)
	if err != nil {
		return nil, fmt.Errorf("get api key by hash: %w", err)
	}
	return apiKeyFromRow(row), nil
}

func (r *APIKeyRepo) GetByTenantAndMode(ctx context.Context, tenantID uuid.UUID, mode string) (*domain.APIKey, error) {
	row, err := r.q.GetAPIKeyByTenantAndMode(ctx, db.GetAPIKeyByTenantAndModeParams{TenantID: tenantID, Mode: mode})
	if err != nil {
		return nil, fmt.Errorf("get api key by tenant and mode: %w", err)
	}
	return apiKeyFromRow(row), nil
}

func (r *APIKeyRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*domain.APIKey, error) {
	rows, err := r.q.ListAPIKeysByTenant(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list api keys by tenant: %w", err)
	}
	keys := make([]*domain.APIKey, len(rows))
	for i, row := range rows {
		keys[i] = apiKeyFromRow(row)
	}
	return keys, nil
}

func (r *APIKeyRepo) TouchLastUsed(ctx context.Context, id uuid.UUID) error {
	return r.q.TouchAPIKeyLastUsed(ctx, id)
}

func (r *APIKeyRepo) Delete(ctx context.Context, tenantID uuid.UUID, mode string) error {
	return r.q.DeleteAPIKeyByTenantAndMode(ctx, db.DeleteAPIKeyByTenantAndModeParams{TenantID: tenantID, Mode: mode})
}

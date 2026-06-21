package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/db/generated"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TenantRepo struct {
	q *db.Queries
}

func NewTenantRepo(pool *pgxpool.Pool) *TenantRepo {
	return &TenantRepo{q: db.New(pool)}
}

func (r *TenantRepo) Create(ctx context.Context, name, email, apiKeyHash, webhookSecret string, config domain.DunningConfig) (*domain.Tenant, error) {
	configJSON, err := json.Marshal(config)
	if err != nil {
		return nil, err
	}
	row, err := r.q.CreateTenant(ctx, db.CreateTenantParams{
		Name:          name,
		Email:         email,
		ApiKeyHash:    apiKeyHash,
		WebhookSecret: webhookSecret,
		DunningConfig: configJSON,
	})
	if err != nil {
		return nil, err
	}
	return tenantFromRow(row), nil
}

func (r *TenantRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Tenant, error) {
	row, err := r.q.GetTenantByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return tenantFromRow(row), nil
}

func (r *TenantRepo) GetByEmail(ctx context.Context, email string) (*domain.Tenant, error) {
	row, err := r.q.GetTenantByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return tenantFromRow(row), nil
}

func (r *TenantRepo) GetByAPIKeyHash(ctx context.Context, hash string) (*domain.Tenant, error) {
	row, err := r.q.GetTenantByAPIKeyHash(ctx, hash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return tenantFromRow(row), nil
}

func (r *TenantRepo) UpdateDunningConfig(ctx context.Context, id uuid.UUID, config domain.DunningConfig) (*domain.Tenant, error) {
	configJSON, err := json.Marshal(config)
	if err != nil {
		return nil, err
	}
	row, err := r.q.UpdateTenantDunningConfig(ctx, db.UpdateTenantDunningConfigParams{
		ID:            id,
		DunningConfig: configJSON,
	})
	if err != nil {
		return nil, err
	}
	return tenantFromRow(row), nil
}

func (r *TenantRepo) Update(ctx context.Context, id uuid.UUID, name, email string) (*domain.Tenant, error) {
	row, err := r.q.UpdateTenant(ctx, db.UpdateTenantParams{
		ID:    id,
		Name:  name,
		Email: email,
	})
	if err != nil {
		return nil, err
	}
	return tenantFromRow(row), nil
}

func (r *TenantRepo) Deactivate(ctx context.Context, id uuid.UUID) error {
	return r.q.DeactivateTenant(ctx, id)
}

func (r *TenantRepo) List(ctx context.Context) ([]*domain.Tenant, error) {
	rows, err := r.q.ListTenants(ctx)
	if err != nil {
		return nil, err
	}
	tenants := make([]*domain.Tenant, len(rows))
	for i, row := range rows {
		tenants[i] = tenantFromRow(row)
	}
	return tenants, nil
}

func tenantFromRow(row db.Tenant) *domain.Tenant {
	var config domain.DunningConfig
	_ = json.Unmarshal(row.DunningConfig, &config)
	return &domain.Tenant{
		ID:            row.ID,
		Name:          row.Name,
		Email:         row.Email,
		APIKeyHash:    row.ApiKeyHash,
		APIKeyHint:    row.ApiKeyHint,
		PasswordHash:  row.PasswordHash,
		WebhookSecret: row.WebhookSecret,
		DunningConfig: config,
		IsActive:      row.IsActive,
		CreatedAt:     row.CreatedAt,
	}
}

func (r *TenantRepo) UpdateAPIKeyHash(ctx context.Context, id uuid.UUID, hash string) error {
	return r.q.UpdateTenantAPIKeyHash(ctx, db.UpdateTenantAPIKeyHashParams{
		ID:         id,
		ApiKeyHash: hash,
	})
}

func (r *TenantRepo) UpdateAPIKeyHashAndHint(ctx context.Context, id uuid.UUID, hash, hint string) (*domain.Tenant, error) {
	row, err := r.q.UpdateTenantAPIKeyHintAndHash(ctx, db.UpdateTenantAPIKeyHintAndHashParams{
		ID:         id,
		ApiKeyHash: hash,
		ApiKeyHint: hint,
	})
	if err != nil {
		return nil, err
	}
	return tenantFromRow(row), nil
}

func (r *TenantRepo) SetPassword(ctx context.Context, id uuid.UUID, passwordHash string) error {
	return r.q.SetTenantPassword(ctx, db.SetTenantPasswordParams{
		ID:           id,
		PasswordHash: passwordHash,
	})
}

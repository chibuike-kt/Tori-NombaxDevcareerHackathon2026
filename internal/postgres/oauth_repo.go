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
	"github.com/jackc/pgx/v5/pgxpool"
)

type OAuthRepo struct {
	q *db.Queries
}

func NewOAuthRepo(pool *pgxpool.Pool) *OAuthRepo {
	return &OAuthRepo{q: db.New(pool)}
}

func oauthClientFromRow(row db.OauthClient) *domain.OAuthClient {
	c := &domain.OAuthClient{
		ID:               row.ID,
		TenantID:         row.TenantID,
		ClientID:         row.ClientID,
		ClientSecretHash: row.ClientSecretHash,
		ClientSecretHint: row.ClientSecretHint,
		Name:             row.Name,
		Mode:             row.Mode,
		IsActive:         row.IsActive,
		CreatedAt:        row.CreatedAt,
	}
	if row.LastUsedAt.Valid {
		t := row.LastUsedAt.Time
		c.LastUsedAt = &t
	}
	return c
}

func oauthTokenFromRow(row db.OauthToken) *domain.OAuthToken {
	return &domain.OAuthToken{
		ID:        row.ID,
		TenantID:  row.TenantID,
		ClientID:  row.ClientID,
		TokenHash: row.TokenHash,
		Mode:      row.Mode,
		ExpiresAt: row.ExpiresAt,
		CreatedAt: row.CreatedAt,
	}
}

func (r *OAuthRepo) CreateClient(ctx context.Context, tenantID uuid.UUID, clientID, secretHash, secretHint, name, mode string) (*domain.OAuthClient, error) {
	row, err := r.q.CreateOAuthClient(ctx, db.CreateOAuthClientParams{
		TenantID:         tenantID,
		ClientID:         clientID,
		ClientSecretHash: secretHash,
		ClientSecretHint: secretHint,
		Name:             name,
		Mode:             mode,
	})
	if err != nil {
		return nil, fmt.Errorf("create oauth client: %w", err)
	}
	return oauthClientFromRow(row), nil
}

func (r *OAuthRepo) GetClientByClientID(ctx context.Context, clientID string) (*domain.OAuthClient, error) {
	row, err := r.q.GetOAuthClientByClientID(ctx, clientID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get oauth client: %w", err)
	}
	return oauthClientFromRow(row), nil
}

func (r *OAuthRepo) ListClients(ctx context.Context, tenantID uuid.UUID) ([]*domain.OAuthClient, error) {
	rows, err := r.q.ListOAuthClients(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list oauth clients: %w", err)
	}
	clients := make([]*domain.OAuthClient, len(rows))
	for i, row := range rows {
		clients[i] = oauthClientFromRow(row)
	}
	return clients, nil
}

func (r *OAuthRepo) RevokeClient(ctx context.Context, id, tenantID uuid.UUID) (*domain.OAuthClient, error) {
	row, err := r.q.RevokeOAuthClient(ctx, db.RevokeOAuthClientParams{ID: id, TenantID: tenantID})
	if err != nil {
		return nil, fmt.Errorf("revoke oauth client: %w", err)
	}
	return oauthClientFromRow(row), nil
}

func (r *OAuthRepo) TouchClientLastUsed(ctx context.Context, id uuid.UUID) error {
	return r.q.TouchOAuthClientLastUsed(ctx, id)
}

func (r *OAuthRepo) CreateToken(ctx context.Context, tenantID uuid.UUID, clientID, tokenHash, mode string, expiresAt time.Time) (*domain.OAuthToken, error) {
	row, err := r.q.CreateOAuthToken(ctx, db.CreateOAuthTokenParams{
		TenantID:  tenantID,
		ClientID:  clientID,
		TokenHash: tokenHash,
		Mode:      mode,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return nil, fmt.Errorf("create oauth token: %w", err)
	}
	return oauthTokenFromRow(row), nil
}

func (r *OAuthRepo) GetTokenByHash(ctx context.Context, tokenHash string) (*domain.OAuthToken, error) {
	row, err := r.q.GetOAuthTokenByHash(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get oauth token: %w", err)
	}
	return oauthTokenFromRow(row), nil
}

func (r *OAuthRepo) DeleteExpiredTokens(ctx context.Context) error {
	return r.q.DeleteExpiredTokens(ctx)
}

func (r *OAuthRepo) RevokeToken(ctx context.Context, tokenHash string) error {
	return r.q.RevokeOAuthToken(ctx, tokenHash)
}

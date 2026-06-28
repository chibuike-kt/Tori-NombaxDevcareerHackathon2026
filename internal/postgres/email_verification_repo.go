package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type EmailVerificationRepo struct {
	pool *pgxpool.Pool
}

func NewEmailVerificationRepo(pool *pgxpool.Pool) *EmailVerificationRepo {
	return &EmailVerificationRepo{pool: pool}
}

func (r *EmailVerificationRepo) Create(ctx context.Context, tenantID uuid.UUID, code string, expiresAt time.Time) (*domain.EmailVerification, error) {
	// Delete any existing unused codes for this tenant first
	_, _ = r.pool.Exec(ctx,
		`DELETE FROM email_verifications WHERE tenant_id = $1 AND used_at IS NULL`,
		tenantID)

	row := r.pool.QueryRow(ctx,
		`INSERT INTO email_verifications (tenant_id, code, expires_at)
		 VALUES ($1, $2, $3)
		 RETURNING id, tenant_id, code, expires_at, used_at, created_at`,
		tenantID, code, expiresAt)

	var v domain.EmailVerification
	if err := row.Scan(&v.ID, &v.TenantID, &v.Code, &v.ExpiresAt, &v.UsedAt, &v.CreatedAt); err != nil {
		return nil, fmt.Errorf("email verification create: %w", err)
	}
	return &v, nil
}

func (r *EmailVerificationRepo) GetByCode(ctx context.Context, code string) (*domain.EmailVerification, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT id, tenant_id, code, expires_at, used_at, created_at
		 FROM email_verifications
		 WHERE code = $1`,
		code)

	var v domain.EmailVerification
	if err := row.Scan(&v.ID, &v.TenantID, &v.Code, &v.ExpiresAt, &v.UsedAt, &v.CreatedAt); err != nil {
		return nil, domain.ErrNotFound
	}
	return &v, nil
}

func (r *EmailVerificationRepo) MarkUsed(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE email_verifications SET used_at = NOW() WHERE id = $1`,
		id)
	return err
}

func (r *EmailVerificationRepo) DeleteByTenant(ctx context.Context, tenantID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM email_verifications WHERE tenant_id = $1`,
		tenantID)
	return err
}

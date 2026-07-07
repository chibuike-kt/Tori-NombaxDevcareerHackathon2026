package postgres

import (
	"context"
	"errors"
	"time"

	db "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/db/generated"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CustomerOTPRepo struct {
	q *db.Queries
}

func NewCustomerOTPRepo(pool *pgxpool.Pool) *CustomerOTPRepo {
	return &CustomerOTPRepo{q: db.New(pool)}
}

func customerOTPFromRow(row db.CustomerOtpCode) *domain.CustomerOTP {
	otp := &domain.CustomerOTP{
		ID:         row.ID,
		CustomerID: row.CustomerID,
		Code:       row.Code,
		ExpiresAt:  row.ExpiresAt,
		CreatedAt:  row.CreatedAt,
	}
	if row.UsedAt.Valid {
		t := row.UsedAt.Time
		otp.UsedAt = &t
	}
	return otp
}

func (r *CustomerOTPRepo) Create(ctx context.Context, customerID uuid.UUID, code string, expiresAt time.Time) (*domain.CustomerOTP, error) {
	row, err := r.q.CreateCustomerOTP(ctx, db.CreateCustomerOTPParams{
		CustomerID: customerID,
		Code:       code,
		ExpiresAt:  expiresAt,
	})
	if err != nil {
		return nil, err
	}
	return customerOTPFromRow(row), nil
}

func (r *CustomerOTPRepo) GetByCode(ctx context.Context, code string) (*domain.CustomerOTP, error) {
	row, err := r.q.GetCustomerOTPByCode(ctx, code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return customerOTPFromRow(row), nil
}

func (r *CustomerOTPRepo) MarkUsed(ctx context.Context, id uuid.UUID) error {
	return r.q.MarkCustomerOTPUsed(ctx, id)
}

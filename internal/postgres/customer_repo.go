package postgres

import (
	"context"
	"errors"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/db/generated"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CustomerRepo struct {
	q *db.Queries
}

func NewCustomerRepo(pool *pgxpool.Pool) *CustomerRepo {
	return &CustomerRepo{q: db.New(pool)}
}

func (r *CustomerRepo) Create(ctx context.Context, tenantID uuid.UUID, externalID *string, email string, name *string, nombaCustomerID *string, metadata []byte) (*domain.Customer, error) {
	row, err := r.q.CreateCustomer(ctx, db.CreateCustomerParams{
		TenantID:        tenantID,
		ExternalID:      toPgText(externalID),
		Email:           email,
		Name:            toPgText(name),
		NombaCustomerID: toPgText(nombaCustomerID),
		Metadata:        metadata,
	})
	if err != nil {
		return nil, err
	}
	return customerFromRow(row), nil
}

func (r *CustomerRepo) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*domain.Customer, error) {
	row, err := r.q.GetCustomerByID(ctx, db.GetCustomerByIDParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return customerFromRow(row), nil
}

func (r *CustomerRepo) GetByEmail(ctx context.Context, tenantID uuid.UUID, email string) (*domain.Customer, error) {
	row, err := r.q.GetCustomerByEmail(ctx, db.GetCustomerByEmailParams{TenantID: tenantID, Email: email})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return customerFromRow(row), nil
}

func (r *CustomerRepo) GetByExternalID(ctx context.Context, tenantID uuid.UUID, externalID string) (*domain.Customer, error) {
	row, err := r.q.GetCustomerByExternalID(ctx, db.GetCustomerByExternalIDParams{TenantID: tenantID, ExternalID: toPgText(&externalID)})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return customerFromRow(row), nil
}

func (r *CustomerRepo) List(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]*domain.Customer, error) {
	rows, err := r.q.ListCustomers(ctx, db.ListCustomersParams{
		TenantID: tenantID,
		Limit:    int32(limit),
		Offset:   int32(offset),
	})
	if err != nil {
		return nil, err
	}
	customers := make([]*domain.Customer, len(rows))
	for i, row := range rows {
		customers[i] = customerFromRow(row)
	}
	return customers, nil
}

func (r *CustomerRepo) Update(ctx context.Context, id, tenantID uuid.UUID, name *string, email string, metadata []byte) (*domain.Customer, error) {
	row, err := r.q.UpdateCustomer(ctx, db.UpdateCustomerParams{
		ID:       id,
		TenantID: tenantID,
		Name:     toPgText(name),
		Email:    email,
		Metadata: metadata,
	})
	if err != nil {
		return nil, err
	}
	return customerFromRow(row), nil
}

func (r *CustomerRepo) UpdateTokenisedCard(ctx context.Context, id, tenantID uuid.UUID, card []byte, nombaCustomerID *string) (*domain.Customer, error) {
	row, err := r.q.UpdateCustomerTokenisedCard(ctx, db.UpdateCustomerTokenisedCardParams{
		ID:              id,
		TenantID:        tenantID,
		TokenisedCard:   card,
		NombaCustomerID: toPgText(nombaCustomerID),
	})
	if err != nil {
		return nil, err
	}
	return customerFromRow(row), nil
}

func (r *CustomerRepo) Archive(ctx context.Context, id, tenantID uuid.UUID) error {
	return r.q.ArchiveCustomer(ctx, db.ArchiveCustomerParams{ID: id, TenantID: tenantID})
}

func customerFromRow(row db.Customer) *domain.Customer {
	return &domain.Customer{
		ID:              row.ID,
		TenantID:        row.TenantID,
		ExternalID:      fromPgText(row.ExternalID),
		Email:           row.Email,
		Name:            fromPgText(row.Name),
		NombaCustomerID: fromPgText(row.NombaCustomerID),
		TokenisedCard:   row.TokenisedCard,
		Metadata:        row.Metadata,
		CreatedAt:       row.CreatedAt,
	}
}

func toPgText(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{Valid: false}
	}
	return pgtype.Text{String: *s, Valid: true}
}

func fromPgText(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	return &t.String
}

func (r *CustomerRepo) GetByIDNoTenant(ctx context.Context, id uuid.UUID) (*domain.Customer, error) {
	row, err := r.q.GetCustomerByIDNoTenant(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return customerFromRow(row), nil
}

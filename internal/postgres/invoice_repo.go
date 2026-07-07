package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/db/generated"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type InvoiceRepo struct {
	q *db.Queries
}

func NewInvoiceRepo(pool *pgxpool.Pool) *InvoiceRepo {
	return &InvoiceRepo{q: db.New(pool)}
}

func (r *InvoiceRepo) Create(ctx context.Context, tenantID, subscriptionID, customerID uuid.UUID, amount int64, currency string, status domain.InvoiceStatus, dueDate time.Time, lineItems []byte, idempotencyKey *string, mode string) (*domain.Invoice, error) {
	row, err := r.q.CreateInvoice(ctx, db.CreateInvoiceParams{
		TenantID:       tenantID,
		SubscriptionID: subscriptionID,
		CustomerID:     customerID,
		Amount:         amount,
		Currency:       currency,
		Status:         string(status),
		DueDate:        dueDate,
		LineItems:      lineItems,
		IdempotencyKey: toPgText(idempotencyKey),
		Mode:           mode,
	})
	if err != nil {
		return nil, err
	}
	return invoiceFromRow(row), nil
}

func (r *InvoiceRepo) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*domain.Invoice, error) {
	row, err := r.q.GetInvoiceByID(ctx, db.GetInvoiceByIDParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return invoiceFromRow(row), nil
}

func (r *InvoiceRepo) GetByIDNoTenant(ctx context.Context, id uuid.UUID) (*domain.Invoice, error) {
	row, err := r.q.GetInvoiceByIDNoTenant(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return invoiceFromRow(row), nil
}

func (r *InvoiceRepo) GetByIdempotencyKey(ctx context.Context, key string) (*domain.Invoice, error) {
	row, err := r.q.GetInvoiceByIdempotencyKey(ctx, toPgText(&key))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return invoiceFromRow(row), nil
}

func (r *InvoiceRepo) ListBySubscription(ctx context.Context, subscriptionID uuid.UUID) ([]*domain.Invoice, error) {
	rows, err := r.q.ListInvoicesBySubscription(ctx, subscriptionID)
	if err != nil {
		return nil, err
	}
	return invoicesFromRows(rows), nil
}

func (r *InvoiceRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID, mode string, limit, offset int) ([]*domain.Invoice, error) {
	rows, err := r.q.ListInvoicesByTenant(ctx, db.ListInvoicesByTenantParams{
		TenantID: tenantID,
		Mode:     mode,
		Limit:    int32(limit),
		Offset:   int32(offset),
	})
	if err != nil {
		return nil, err
	}
	return invoicesFromRows(rows), nil
}

func (r *InvoiceRepo) ListByStatus(ctx context.Context, tenantID uuid.UUID, status domain.InvoiceStatus, mode string, limit, offset int) ([]*domain.Invoice, error) {
	rows, err := r.q.ListInvoicesByStatus(ctx, db.ListInvoicesByStatusParams{
		TenantID: tenantID,
		Status:   string(status),
		Mode:     mode,
		Limit:    int32(limit),
		Offset:   int32(offset),
	})
	if err != nil {
		return nil, err
	}
	return invoicesFromRows(rows), nil
}

func (r *InvoiceRepo) MarkPaid(ctx context.Context, id, tenantID uuid.UUID, chargeRef string) (*domain.Invoice, error) {
	row, err := r.q.MarkInvoicePaid(ctx, db.MarkInvoicePaidParams{
		ID:             id,
		TenantID:       tenantID,
		NombaChargeRef: toPgText(&chargeRef),
	})
	if err != nil {
		return nil, err
	}
	return invoiceFromRow(row), nil
}

func (r *InvoiceRepo) MarkVoid(ctx context.Context, id, tenantID uuid.UUID) (*domain.Invoice, error) {
	row, err := r.q.MarkInvoiceVoid(ctx, db.MarkInvoiceVoidParams{ID: id, TenantID: tenantID})
	if err != nil {
		return nil, err
	}
	return invoiceFromRow(row), nil
}

func (r *InvoiceRepo) MarkUncollectible(ctx context.Context, id, tenantID uuid.UUID) (*domain.Invoice, error) {
	row, err := r.q.MarkInvoiceUncollectible(ctx, db.MarkInvoiceUncollectibleParams{ID: id, TenantID: tenantID})
	if err != nil {
		return nil, err
	}
	return invoiceFromRow(row), nil
}

func (r *InvoiceRepo) UpdateProration(ctx context.Context, id, tenantID uuid.UUID, prorationDetails, lineItems []byte) (*domain.Invoice, error) {
	row, err := r.q.UpdateInvoiceProration(ctx, db.UpdateInvoiceProrationParams{
		ID:               id,
		TenantID:         tenantID,
		ProrationDetails: prorationDetails,
		LineItems:        lineItems,
	})
	if err != nil {
		return nil, err
	}
	return invoiceFromRow(row), nil
}

func invoiceFromRow(row db.Invoice) *domain.Invoice {
	return &domain.Invoice{
		ID:               row.ID,
		TenantID:         row.TenantID,
		SubscriptionID:   row.SubscriptionID,
		CustomerID:       row.CustomerID,
		Amount:           row.Amount,
		Currency:         row.Currency,
		Status:           domain.InvoiceStatus(row.Status),
		DueDate:          row.DueDate,
		PaidAt:           fromPgTimestamptz(row.PaidAt),
		NombaChargeRef:   fromPgText(row.NombaChargeRef),
		ProrationDetails: row.ProrationDetails,
		LineItems:        row.LineItems,
		IdempotencyKey:   fromPgText(row.IdempotencyKey),
		Mode:             row.Mode,
		CreatedAt:        row.CreatedAt,
	}
}

func invoicesFromRows(rows []db.Invoice) []*domain.Invoice {
	invoices := make([]*domain.Invoice, len(rows))
	for i, row := range rows {
		invoices[i] = invoiceFromRow(row)
	}
	return invoices
}

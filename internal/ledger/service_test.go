package ledger_test

import (
	"context"
	"testing"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/ledger"
	"github.com/google/uuid"
)

// mockLedgerRepo is an in-memory ledger for tests.
// No update or delete methods exist — matches the real contract.
type mockLedgerRepo struct {
	entries []*domain.LedgerEntry
}

func (m *mockLedgerRepo) Append(_ context.Context, tenantID uuid.UUID, subscriptionID, invoiceID, customerID *uuid.UUID, entryType domain.LedgerEntryType, direction domain.LedgerDirection, amount int64, currency, description, idempotencyKey string, metadata []byte) (*domain.LedgerEntry, error) {
	e := &domain.LedgerEntry{
		ID:             uuid.New(),
		TenantID:       tenantID,
		SubscriptionID: subscriptionID,
		InvoiceID:      invoiceID,
		CustomerID:     customerID,
		EntryType:      entryType,
		Direction:      direction,
		Amount:         amount,
		Currency:       currency,
		Description:    description,
		IdempotencyKey: idempotencyKey,
		Metadata:       metadata,
		CreatedAt:      time.Now(),
	}
	m.entries = append(m.entries, e)
	return e, nil
}

func (m *mockLedgerRepo) GetByID(_ context.Context, id, _ uuid.UUID) (*domain.LedgerEntry, error) {
	for _, e := range m.entries {
		if e.ID == id {
			return e, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (m *mockLedgerRepo) GetByIdempotencyKey(_ context.Context, key string) (*domain.LedgerEntry, error) {
	for _, e := range m.entries {
		if e.IdempotencyKey == key {
			return e, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (m *mockLedgerRepo) ListByTenant(_ context.Context, tenantID uuid.UUID, limit, offset int) ([]*domain.LedgerEntry, error) {
	return m.entries, nil
}

func (m *mockLedgerRepo) ListBySubscription(_ context.Context, _, subscriptionID uuid.UUID, limit, offset int) ([]*domain.LedgerEntry, error) {
	var result []*domain.LedgerEntry
	for _, e := range m.entries {
		if e.SubscriptionID != nil && *e.SubscriptionID == subscriptionID {
			result = append(result, e)
		}
	}
	return result, nil
}

func (m *mockLedgerRepo) ListByCustomer(_ context.Context, _, customerID uuid.UUID, limit, offset int) ([]*domain.LedgerEntry, error) {
	return m.entries, nil
}

func (m *mockLedgerRepo) ListByDateRange(_ context.Context, _ uuid.UUID, _, _ time.Time, _, _ int) ([]*domain.LedgerEntry, error) {
	return m.entries, nil
}

func (m *mockLedgerRepo) ListByTypeAndDateRange(_ context.Context, _ uuid.UUID, _ []string, _, _ time.Time, _, _ int) ([]*domain.LedgerEntry, error) {
	return m.entries, nil
}

func (m *mockLedgerRepo) GetSummary(_ context.Context, _ uuid.UUID, _, _ time.Time) (*domain.LedgerSummary, error) {
	var charged, refunded int64
	for _, e := range m.entries {
		if e.EntryType == domain.EntryCharge {
			charged += e.Amount
		}
		if e.EntryType == domain.EntryRefund {
			refunded += e.Amount
		}
	}
	return &domain.LedgerSummary{
		TotalCharged:  charged,
		TotalRefunded: refunded,
		EntryCount:    int64(len(m.entries)),
	}, nil
}

func (m *mockLedgerRepo) GetMRR(_ context.Context, _ uuid.UUID, _, _ time.Time) (int64, error) {
	var total int64
	for _, e := range m.entries {
		if e.EntryType == domain.EntryCharge {
			total += e.Amount
		}
	}
	return total, nil
}

func TestRecordCharge_WritesDebitEntry(t *testing.T) {
	repo := &mockLedgerRepo{}
	svc := ledger.NewService(repo)

	tenantID := uuid.New()
	subID := uuid.New()
	invoiceID := uuid.New()
	customerID := uuid.New()

	entry, err := svc.RecordCharge(ctx(), tenantID, subID, invoiceID, customerID, 500000, "NGN", "charge:key:1")
	if err != nil {
		t.Fatal(err)
	}
	if entry.Direction != domain.DirectionDebit {
		t.Errorf("expected DEBIT, got %q", entry.Direction)
	}
	if entry.EntryType != domain.EntryCharge {
		t.Errorf("expected CHARGE, got %q", entry.EntryType)
	}
	if entry.Amount != 500000 {
		t.Errorf("expected 500000, got %d", entry.Amount)
	}
}

func TestRecordRefund_WritesCreditEntry(t *testing.T) {
	repo := &mockLedgerRepo{}
	svc := ledger.NewService(repo)

	entry, err := svc.RecordRefund(ctx(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), 250000, "NGN", "refund:key:1", "customer request")
	if err != nil {
		t.Fatal(err)
	}
	if entry.Direction != domain.DirectionCredit {
		t.Errorf("expected CREDIT, got %q", entry.Direction)
	}
	if entry.EntryType != domain.EntryRefund {
		t.Errorf("expected REFUND, got %q", entry.EntryType)
	}
}

func TestIdempotency_SameKeyReturnsSameEntry(t *testing.T) {
	repo := &mockLedgerRepo{}
	svc := ledger.NewService(repo)

	tenantID := uuid.New()
	subID := uuid.New()
	invoiceID := uuid.New()
	customerID := uuid.New()
	key := "charge:idempotent-key:0"

	_, err := svc.RecordCharge(ctx(), tenantID, subID, invoiceID, customerID, 500000, "NGN", key)
	if err != nil {
		t.Fatal(err)
	}

	// Simulate worker retry — check key before charging again
	existing, err := svc.GetByIdempotencyKey(ctx(), key)
	if err != nil {
		t.Fatalf("expected to find existing entry: %v", err)
	}
	if existing.IdempotencyKey != key {
		t.Error("returned wrong entry")
	}

	// Confirm only one entry was written
	if len(repo.entries) != 1 {
		t.Errorf("expected 1 ledger entry, got %d", len(repo.entries))
	}
}

func TestGetSummary_NetRevenueCalculation(t *testing.T) {
	repo := &mockLedgerRepo{}
	svc := ledger.NewService(repo)

	tenantID := uuid.New()
	subID := uuid.New()
	invoiceID := uuid.New()
	customerID := uuid.New()

	_, _ = svc.RecordCharge(ctx(), tenantID, subID, invoiceID, customerID, 1000000, "NGN", "key:1")
	_, _ = svc.RecordCharge(ctx(), tenantID, subID, invoiceID, customerID, 500000, "NGN", "key:2")
	_, _ = svc.RecordRefund(ctx(), tenantID, subID, invoiceID, customerID, 200000, "NGN", "key:3", "duplicate charge")

	from := time.Now().AddDate(0, -1, 0)
	to := time.Now().AddDate(0, 1, 0)

	summary, err := svc.GetSummary(ctx(), tenantID, from, to)
	if err != nil {
		t.Fatal(err)
	}
	if summary.TotalCharged != 1500000 {
		t.Errorf("expected total charged 1500000, got %d", summary.TotalCharged)
	}
	if summary.TotalRefunded != 200000 {
		t.Errorf("expected total refunded 200000, got %d", summary.TotalRefunded)
	}
	if summary.NetRevenue != 1300000 {
		t.Errorf("expected net revenue 1300000, got %d", summary.NetRevenue)
	}
}

func TestLedger_NoUpdateOrDeleteMethods(t *testing.T) {
	// This test is intentionally structural — it verifies at compile time
	// that LedgerRepository has no Update or Delete methods.
	// If someone adds one, it won't satisfy the interface and this file won't compile.
	var _ domain.LedgerRepository = &mockLedgerRepo{}
}

func ctx() context.Context {
	return context.Background()
}

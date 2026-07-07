package ledger

import (
	"context"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
)

type Service struct {
	repo domain.LedgerRepository
}

type MonthlyRevenue struct {
	Month    string `json:"month"`
	Charged  int64  `json:"charged_kobo"`
	Refunded int64  `json:"refunded_kobo"`
	Net      int64  `json:"net_kobo"`
}

func (s *Service) GetMonthlyRevenue(ctx context.Context, tenantID uuid.UUID, from, to time.Time, mode string) ([]MonthlyRevenue, error) {
	rows, err := s.repo.GetMonthlyRevenue(ctx, tenantID, from, to, mode)
	if err != nil {
		return nil, err
	}
	result := make([]MonthlyRevenue, 0, len(rows))
	for _, r := range rows {
		result = append(result, MonthlyRevenue{
			Month:    r.Month.Format("Jan 2006"),
			Charged:  r.Charged,
			Refunded: r.Refunded,
			Net:      r.Charged - r.Refunded,
		})
	}
	return result, nil
}

func NewService(repo domain.LedgerRepository) *Service {
	return &Service{repo: repo}
}

// RecordCharge writes a DEBIT entry for a successful payment.
func (s *Service) RecordCharge(ctx context.Context, tenantID, subscriptionID, invoiceID, customerID uuid.UUID, amount int64, currency, idempotencyKey, mode string) (*domain.LedgerEntry, error) {
	return s.repo.Append(ctx,
		tenantID,
		&subscriptionID,
		&invoiceID,
		&customerID,
		domain.EntryCharge,
		domain.DirectionDebit,
		amount,
		currency,
		"Payment collected for subscription renewal",
		idempotencyKey,
		nil,
		mode,
	)
}

// RecordRefund writes a CREDIT entry for a refund issued.
func (s *Service) RecordRefund(ctx context.Context, tenantID, subscriptionID, invoiceID, customerID uuid.UUID, amount int64, currency, idempotencyKey, reason, mode string) (*domain.LedgerEntry, error) {
	return s.repo.Append(ctx,
		tenantID,
		&subscriptionID,
		&invoiceID,
		&customerID,
		domain.EntryRefund,
		domain.DirectionCredit,
		amount,
		currency,
		"Refund issued: "+reason,
		idempotencyKey,
		nil,
		mode,
	)
}

// RecordProration writes a DEBIT entry for a mid-cycle upgrade charge.
func (s *Service) RecordProration(ctx context.Context, tenantID, subscriptionID, customerID uuid.UUID, amount int64, currency, idempotencyKey, mode string) (*domain.LedgerEntry, error) {
	return s.repo.Append(ctx,
		tenantID,
		&subscriptionID,
		nil,
		&customerID,
		domain.EntryProration,
		domain.DirectionDebit,
		amount,
		currency,
		"Proration charge for plan upgrade",
		idempotencyKey,
		nil,
		mode,
	)
}

// RecordCredit writes a CREDIT entry for a mid-cycle downgrade.
func (s *Service) RecordCredit(ctx context.Context, tenantID, subscriptionID, customerID uuid.UUID, amount int64, currency, idempotencyKey, mode string) (*domain.LedgerEntry, error) {
	return s.repo.Append(ctx,
		tenantID,
		&subscriptionID,
		nil,
		&customerID,
		domain.EntryCredit,
		domain.DirectionCredit,
		amount,
		currency,
		"Credit applied from plan downgrade",
		idempotencyKey,
		nil,
		mode,
	)
}

// RecordPauseCredit writes a CREDIT entry for the unused portion of a
// subscription's current billing period when it's paused.
func (s *Service) RecordPauseCredit(ctx context.Context, tenantID, subscriptionID, customerID uuid.UUID, amount int64, currency, idempotencyKey, mode string) (*domain.LedgerEntry, error) {
	return s.repo.Append(ctx,
		tenantID,
		&subscriptionID,
		nil,
		&customerID,
		domain.EntryCredit,
		domain.DirectionCredit,
		amount,
		currency,
		"Prorated credit for unused period — subscription paused",
		idempotencyKey,
		nil,
		mode,
	)
}

// RecordTrialStart writes an audit marker when a trial begins. Amount is zero.
func (s *Service) RecordTrialStart(ctx context.Context, tenantID, subscriptionID, customerID uuid.UUID, currency, idempotencyKey, mode string) (*domain.LedgerEntry, error) {
	return s.repo.Append(ctx,
		tenantID,
		&subscriptionID,
		nil,
		&customerID,
		domain.EntryTrialStart,
		domain.DirectionDebit,
		0,
		currency,
		"Trial period started",
		idempotencyKey,
		nil,
		mode,
	)
}

// RecordTrialEnd writes an audit marker when a trial ends. Amount is zero.
func (s *Service) RecordTrialEnd(ctx context.Context, tenantID, subscriptionID, customerID uuid.UUID, currency, idempotencyKey, mode string) (*domain.LedgerEntry, error) {
	return s.repo.Append(ctx,
		tenantID,
		&subscriptionID,
		nil,
		&customerID,
		domain.EntryTrialEnd,
		domain.DirectionDebit,
		0,
		currency,
		"Trial period ended",
		idempotencyKey,
		nil,
		mode,
	)
}

// RecordAdminOverride writes an OVERRIDE entry when an admin force-sets subscription state.
func (s *Service) RecordAdminOverride(ctx context.Context, tenantID, subscriptionID uuid.UUID, currency, idempotencyKey, reason string, metadata []byte, mode string) (*domain.LedgerEntry, error) {
	return s.repo.Append(ctx,
		tenantID,
		&subscriptionID,
		nil,
		nil,
		domain.EntryOverride,
		domain.DirectionDebit,
		0,
		currency,
		"Admin override: "+reason,
		idempotencyKey,
		metadata,
		mode,
	)
}

// GetSummary returns aggregated financial totals for a tenant over a date range.
func (s *Service) GetSummary(ctx context.Context, tenantID uuid.UUID, from, to time.Time, mode string) (*domain.LedgerSummary, error) {
	summary, err := s.repo.GetSummary(ctx, tenantID, from, to, mode)
	if err != nil {
		return nil, err
	}
	summary.NetRevenue = summary.TotalCharged - summary.TotalRefunded - summary.TotalCreditsApplied
	summary.Currency = "NGN"
	return summary, nil
}

// GetByIdempotencyKey checks whether a charge already succeeded.
// Call this before every charge attempt to enforce idempotency.
func (s *Service) GetByIdempotencyKey(ctx context.Context, key string) (*domain.LedgerEntry, error) {
	return s.repo.GetByIdempotencyKey(ctx, key)
}

func (s *Service) ListBySubscription(ctx context.Context, tenantID, subscriptionID uuid.UUID, mode string, limit, offset int) ([]*domain.LedgerEntry, error) {
	return s.repo.ListBySubscription(ctx, tenantID, subscriptionID, mode, limit, offset)
}

func (s *Service) ListByCustomer(ctx context.Context, tenantID, customerID uuid.UUID, mode string, limit, offset int) ([]*domain.LedgerEntry, error) {
	return s.repo.ListByCustomer(ctx, tenantID, customerID, mode, limit, offset)
}

func (s *Service) ListByDateRange(ctx context.Context, tenantID uuid.UUID, from, to time.Time, mode string, limit, offset int) ([]*domain.LedgerEntry, error) {
	return s.repo.ListByDateRange(ctx, tenantID, from, to, mode, limit, offset)
}

func (s *Service) ListByTypeAndDateRange(ctx context.Context, tenantID uuid.UUID, types []string, from, to time.Time, mode string, limit, offset int) ([]*domain.LedgerEntry, error) {
	return s.repo.ListByTypeAndDateRange(ctx, tenantID, types, from, to, mode, limit, offset)
}

func (s *Service) GetMRR(ctx context.Context, tenantID uuid.UUID, from, to time.Time, mode string) (int64, error) {
	return s.repo.GetMRR(ctx, tenantID, from, to, mode)
}

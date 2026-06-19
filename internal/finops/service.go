package finops

import (
	"context"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
)

type MRRResult struct {
	MRRKobo             int64  `json:"mrr_kobo"`
	Currency            string `json:"currency"`
	Period              string `json:"period"`
}

type ARRResult struct {
	ARRKobo  int64  `json:"arr_kobo"`
	Currency string `json:"currency"`
	Period   string `json:"period"`
}

type ChurnResult struct {
	ChurnRatePct   float64 `json:"churn_rate_pct"`
	CancelledCount int64   `json:"cancelled_count"`
	ChurnedMRRKobo int64   `json:"churned_mrr_kobo"`
	Period         string  `json:"period"`
}

type DunningRecoveryResult struct {
	TotalAtRiskKobo  int64   `json:"total_at_risk_kobo"`
	RecoveredKobo    int64   `json:"recovered_kobo"`
	RecoveryRatePct  float64 `json:"recovery_rate_pct"`
	LostKobo         int64   `json:"lost_kobo"`
	Currency         string  `json:"currency"`
}

type RevenueReport struct {
	GrossRevenueKobo int64           `json:"gross_revenue_kobo"`
	RefundsKobo      int64           `json:"refunds_kobo"`
	CreditsKobo      int64           `json:"credits_kobo"`
	NetRevenueKobo   int64           `json:"net_revenue_kobo"`
	Currency         string          `json:"currency"`
	BreakdownByPlan  []PlanRevenue   `json:"breakdown_by_plan"`
}

type PlanRevenue struct {
	PlanID            uuid.UUID `json:"plan_id"`
	PlanName          string    `json:"plan_name"`
	TotalChargedKobo  int64     `json:"total_charged_kobo"`
	SubscriptionCount int64     `json:"subscription_count"`
}

type Service struct {
	ledger domain.LedgerRepository
	subs   domain.SubscriptionRepository
}

func NewService(ledger domain.LedgerRepository, subs domain.SubscriptionRepository) *Service {
	return &Service{ledger: ledger, subs: subs}
}

func (s *Service) GetMRR(ctx context.Context, tenantID uuid.UUID, period time.Time) (*MRRResult, error) {
	from := time.Date(period.Year(), period.Month(), 1, 0, 0, 0, 0, time.UTC)
	to := from.AddDate(0, 1, 0)

	mrr, err := s.ledger.GetMRR(ctx, tenantID, from, to)
	if err != nil {
		return nil, err
	}

	return &MRRResult{
		MRRKobo:  mrr,
		Currency: "NGN",
		Period:   period.Format("2006-01"),
	}, nil
}

func (s *Service) GetARR(ctx context.Context, tenantID uuid.UUID, period time.Time) (*ARRResult, error) {
	mrr, err := s.GetMRR(ctx, tenantID, period)
	if err != nil {
		return nil, err
	}
	return &ARRResult{
		ARRKobo:  mrr.MRRKobo * 12,
		Currency: "NGN",
		Period:   period.Format("2006-01"),
	}, nil
}

func (s *Service) GetChurn(ctx context.Context, tenantID uuid.UUID, from, to time.Time) (*ChurnResult, error) {
	// Count CANCELLED subscriptions in the period via ledger entries.
	// We use the subscription repository to count cancellations.
	cancelled, err := s.subs.ListByStatus(ctx, tenantID, domain.StatusCancelled, 1000, 0)
	if err != nil {
		return nil, err
	}

	var cancelledInPeriod int64
	for _, sub := range cancelled {
		if sub.CancelledAt != nil && sub.CancelledAt.After(from) && sub.CancelledAt.Before(to) {
			cancelledInPeriod++
		}
	}

	active, err := s.subs.ListByStatus(ctx, tenantID, domain.StatusActive, 1000, 0)
	if err != nil {
		return nil, err
	}

	total := int64(len(active)) + cancelledInPeriod
	var churnRate float64
	if total > 0 {
		churnRate = float64(cancelledInPeriod) / float64(total) * 100
	}

	return &ChurnResult{
		ChurnRatePct:   churnRate,
		CancelledCount: cancelledInPeriod,
		Period:         from.Format("2006-01-02") + " to " + to.Format("2006-01-02"),
	}, nil
}

func (s *Service) GetDunningRecovery(ctx context.Context, tenantID uuid.UUID, from, to time.Time) (*DunningRecoveryResult, error) {
	// At-risk = all CHARGE entries that followed a PAST_DUE or DUNNING state.
	// Approximated here as: total charged during dunning recovery events.
	// A more precise implementation tracks this via webhook events in Phase 10.
	allEntries, err := s.ledger.ListByTypeAndDateRange(ctx, tenantID, []string{"CHARGE"}, from, to, 1000, 0)
	if err != nil {
		return nil, err
	}

	var recoveredKobo int64
	for _, e := range allEntries {
		recoveredKobo += e.Amount
	}

	return &DunningRecoveryResult{
		RecoveredKobo:   recoveredKobo,
		Currency:        "NGN",
	}, nil
}

func (s *Service) GetRevenueReport(ctx context.Context, tenantID uuid.UUID, from, to time.Time) (*RevenueReport, error) {
	summary, err := s.ledger.GetSummary(ctx, tenantID, from, to)
	if err != nil {
		return nil, err
	}

	return &RevenueReport{
		GrossRevenueKobo: summary.TotalCharged,
		RefundsKobo:      summary.TotalRefunded,
		CreditsKobo:      summary.TotalCreditsApplied,
		NetRevenueKobo:   summary.TotalCharged - summary.TotalRefunded - summary.TotalCreditsApplied,
		Currency:         "NGN",
	}, nil
}

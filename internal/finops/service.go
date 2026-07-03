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

// RecoveryCenterResult is the full picture for the Recovery Command Center.
type RecoveryCenterResult struct {
	AtRiskKobo       int64                  `json:"at_risk_kobo"`
	RecoveredKobo    int64                  `json:"recovered_kobo"`
	RecoveryRatePct  float64                `json:"recovery_rate_pct"`
	AtRiskCount      int                    `json:"at_risk_count"`
	RecoveringCount  int                    `json:"recovering_count"`
	RecoveredCount   int                    `json:"recovered_count"`
	AtRisk           []RecoveryItem         `json:"at_risk"`
	Recovering       []RecoveryItem         `json:"recovering"`
	Recovered        []RecoveryItem         `json:"recovered"`
	Currency         string                 `json:"currency"`
	GeneratedAt      time.Time              `json:"generated_at"`
}

// RecoveryItem is one subscription in the recovery pipeline.
type RecoveryItem struct {
	SubscriptionID  string     `json:"subscription_id"`
	CustomerID      string     `json:"customer_id"`
	CustomerEmail   string     `json:"customer_email"`
	Status          string     `json:"status"`
	AmountKobo      int64      `json:"amount_kobo"`
	RecoveryRail    string     `json:"recovery_rail"`
	DunningAttempt  int        `json:"dunning_attempt"`
	NextRetryAt     *time.Time `json:"next_retry_at,omitempty"`
	PlanName        string     `json:"plan_name"`
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

// GetRecoveryCenter assembles the live recovery pipeline for a tenant.
// At-risk    = PAST_DUE and DUNNING subscriptions (money in danger, not yet in active retry)
// Recovering = subscriptions with a retry scheduled (next_retry_at set)
// Recovered  = subscriptions that recovered to ACTIVE this period after dunning
func (s *Service) GetRecoveryCenter(
	ctx context.Context,
	tenantID uuid.UUID,
	subs domain.SubscriptionRepository,
	customers domain.CustomerRepository,
	plans domain.PlanRepository,
	from, to time.Time,
) (*RecoveryCenterResult, error) {
	all, err := subs.List(ctx, tenantID, 1000, 0)
	if err != nil {
		return nil, err
	}

	planName := func(id uuid.UUID) (string, int64) {
		p, err := plans.GetByID(ctx, id, tenantID)
		if err != nil || p == nil {
			return "Unknown plan", 0
		}
		return p.Name, p.Amount
	}
	custEmail := func(id uuid.UUID) string {
		c, err := customers.GetByID(ctx, id, tenantID)
		if err != nil || c == nil {
			return "unknown"
		}
		return c.Email
	}

	result := &RecoveryCenterResult{
		Currency:    "NGN",
		GeneratedAt: time.Now().UTC(),
		AtRisk:      []RecoveryItem{},
		Recovering:  []RecoveryItem{},
		Recovered:   []RecoveryItem{},
	}

	for _, sub := range all {
		name, amount := planName(sub.PlanID)
		item := RecoveryItem{
			SubscriptionID: sub.ID.String(),
			CustomerID:     sub.CustomerID.String(),
			CustomerEmail:  custEmail(sub.CustomerID),
			Status:         string(sub.Status),
			AmountKobo:     amount,
			RecoveryRail:   sub.RecoveryRail,
			DunningAttempt: sub.DunningAttempt,
			NextRetryAt:    sub.NextRetryAt,
			PlanName:       name,
		}

		switch sub.Status {
		case domain.StatusPastDue:
			result.AtRisk = append(result.AtRisk, item)
			result.AtRiskKobo += amount
		case domain.StatusDunning:
			// In dunning with a scheduled retry = actively recovering
			if sub.NextRetryAt != nil {
				result.Recovering = append(result.Recovering, item)
			} else {
				result.AtRisk = append(result.AtRisk, item)
			}
			result.AtRiskKobo += amount
		case domain.StatusActive:
			// Recovered = active now but had dunning history
			if sub.DunningAttempt > 0 {
				result.Recovered = append(result.Recovered, item)
				result.RecoveredKobo += amount
			}
		}
	}

	result.AtRiskCount = len(result.AtRisk)
	result.RecoveringCount = len(result.Recovering)
	result.RecoveredCount = len(result.Recovered)

	// Recovery rate = recovered / (recovered + still at risk)
	denom := result.RecoveredCount + result.AtRiskCount + result.RecoveringCount
	if denom > 0 {
		result.RecoveryRatePct = float64(result.RecoveredCount) / float64(denom) * 100
	}

	return result, nil
}

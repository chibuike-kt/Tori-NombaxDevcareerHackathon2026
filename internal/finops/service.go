package finops

import (
	"context"
	"sort"
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
	plans  domain.PlanRepository
}

// listPageSize bounds each page fetched while paginating through
// subscriptions or ledger entries — pages are looped until exhausted rather
// than capped, so a tenant with more rows than one page never gets silently
// truncated results.
const listPageSize = 1000

// listAllSubscriptions paginates through every subscription for a tenant.
func listAllSubscriptions(ctx context.Context, subs domain.SubscriptionRepository, tenantID uuid.UUID) ([]*domain.Subscription, error) {
	var all []*domain.Subscription
	offset := 0
	for {
		page, err := subs.List(ctx, tenantID, listPageSize, offset)
		if err != nil {
			return nil, err
		}
		all = append(all, page...)
		if len(page) < listPageSize {
			return all, nil
		}
		offset += listPageSize
	}
}

// listAllSubscriptionsByStatus paginates through every subscription for a
// tenant in a given status.
func listAllSubscriptionsByStatus(ctx context.Context, subs domain.SubscriptionRepository, tenantID uuid.UUID, status domain.SubscriptionStatus) ([]*domain.Subscription, error) {
	var all []*domain.Subscription
	offset := 0
	for {
		page, err := subs.ListByStatus(ctx, tenantID, status, listPageSize, offset)
		if err != nil {
			return nil, err
		}
		all = append(all, page...)
		if len(page) < listPageSize {
			return all, nil
		}
		offset += listPageSize
	}
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

func NewService(ledger domain.LedgerRepository, subs domain.SubscriptionRepository, plans domain.PlanRepository) *Service {
	return &Service{ledger: ledger, subs: subs, plans: plans}
}

// GetMRR sums ledger CHARGE entries in the given month, normalized to a
// monthly-equivalent amount per plan interval — an annual plan's once-a-year
// charge is divided by 12 and a monthly plan's charge counts as-is, so a
// renewal landing in this particular month doesn't spike MRR by the full
// yearly amount. Custom-interval plans are not normalized (no fixed monthly
// equivalent is well-defined for an arbitrary day count) and count as-is.
func (s *Service) GetMRR(ctx context.Context, tenantID uuid.UUID, period time.Time) (*MRRResult, error) {
	from := time.Date(period.Year(), period.Month(), 1, 0, 0, 0, 0, time.UTC)
	to := from.AddDate(0, 1, 0)

	subPlanCache := map[uuid.UUID]uuid.UUID{}
	planIntervalCache := map[uuid.UUID]domain.PlanInterval{}

	intervalForSubscription := func(subID uuid.UUID) domain.PlanInterval {
		planID, ok := subPlanCache[subID]
		if !ok {
			sub, err := s.subs.GetByID(ctx, subID, tenantID)
			if err != nil || sub == nil {
				return domain.IntervalMonthly
			}
			planID = sub.PlanID
			subPlanCache[subID] = planID
		}
		if iv, ok := planIntervalCache[planID]; ok {
			return iv
		}
		p, err := s.plans.GetByID(ctx, planID, tenantID)
		if err != nil || p == nil {
			return domain.IntervalMonthly
		}
		planIntervalCache[planID] = p.Interval
		return p.Interval
	}

	var mrr int64
	offset := 0
	for {
		entries, err := s.ledger.ListByTypeAndDateRange(ctx, tenantID, []string{"CHARGE"}, from, to, listPageSize, offset)
		if err != nil {
			return nil, err
		}
		for _, e := range entries {
			amount := e.Amount
			if e.SubscriptionID != nil {
				switch intervalForSubscription(*e.SubscriptionID) {
				case domain.IntervalAnnual:
					amount /= 12
				}
			}
			mrr += amount
		}
		if len(entries) < listPageSize {
			break
		}
		offset += listPageSize
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

// GetChurn computes the churn rate against subscriptions that were active at
// the START of the period — not the current active count — so growth or
// shrinkage during the period doesn't skew the rate. A subscription counts
// as "active at start" if it existed before the period began (created_at <
// from) and either is still active now or was cancelled inside the period.
func (s *Service) GetChurn(ctx context.Context, tenantID uuid.UUID, from, to time.Time) (*ChurnResult, error) {
	all, err := listAllSubscriptions(ctx, s.subs, tenantID)
	if err != nil {
		return nil, err
	}

	var activeAtStart, cancelledInPeriod int64
	for _, sub := range all {
		if !sub.CreatedAt.Before(from) {
			continue // didn't exist yet at the start of the period
		}
		cancelledInThisPeriod := sub.CancelledAt != nil &&
			!sub.CancelledAt.Before(from) && !sub.CancelledAt.After(to)
		if sub.Status == domain.StatusActive || cancelledInThisPeriod {
			activeAtStart++
		}
		if cancelledInThisPeriod {
			cancelledInPeriod++
		}
	}

	var churnRate float64
	if activeAtStart > 0 {
		churnRate = float64(cancelledInPeriod) / float64(activeAtStart) * 100
	}

	return &ChurnResult{
		ChurnRatePct:   churnRate,
		CancelledCount: cancelledInPeriod,
		Period:         from.Format("2006-01-02") + " to " + to.Format("2006-01-02"),
	}, nil
}

// GetDunningRecovery reports the live state of the dunning/recovery pipeline
// as plan-amount sums, not an approximation from raw ledger totals:
//   - AtRiskKobo   — PAST_DUE and DUNNING subscriptions, money not yet lost or recovered
//   - RecoveredKobo — ACTIVE subscriptions that had at least one dunning attempt
//   - LostKobo     — SUSPENDED subscriptions, dunning exhausted with no recovery
func (s *Service) GetDunningRecovery(ctx context.Context, tenantID uuid.UUID, from, to time.Time) (*DunningRecoveryResult, error) {
	planAmount := func(planID uuid.UUID) int64 {
		p, err := s.plans.GetByID(ctx, planID, tenantID)
		if err != nil || p == nil {
			return 0
		}
		return p.Amount
	}

	var atRisk, recovered, lost int64

	for _, status := range []domain.SubscriptionStatus{domain.StatusPastDue, domain.StatusDunning} {
		subs, err := listAllSubscriptionsByStatus(ctx, s.subs, tenantID, status)
		if err != nil {
			return nil, err
		}
		for _, sub := range subs {
			atRisk += planAmount(sub.PlanID)
		}
	}

	active, err := listAllSubscriptionsByStatus(ctx, s.subs, tenantID, domain.StatusActive)
	if err != nil {
		return nil, err
	}
	for _, sub := range active {
		if sub.DunningAttempt > 0 {
			recovered += planAmount(sub.PlanID)
		}
	}

	suspended, err := listAllSubscriptionsByStatus(ctx, s.subs, tenantID, domain.StatusSuspended)
	if err != nil {
		return nil, err
	}
	for _, sub := range suspended {
		lost += planAmount(sub.PlanID)
	}

	var recoveryRate float64
	if recovered+lost > 0 {
		recoveryRate = float64(recovered) / float64(recovered+lost) * 100
	}

	return &DunningRecoveryResult{
		TotalAtRiskKobo: atRisk,
		RecoveredKobo:   recovered,
		LostKobo:        lost,
		RecoveryRatePct: recoveryRate,
		Currency:        "NGN",
	}, nil
}

func (s *Service) GetRevenueReport(ctx context.Context, tenantID uuid.UUID, from, to time.Time) (*RevenueReport, error) {
	summary, err := s.ledger.GetSummary(ctx, tenantID, from, to)
	if err != nil {
		return nil, err
	}

	breakdown, err := s.getPlanBreakdown(ctx, tenantID, from, to)
	if err != nil {
		return nil, err
	}

	return &RevenueReport{
		GrossRevenueKobo: summary.TotalCharged,
		RefundsKobo:      summary.TotalRefunded,
		CreditsKobo:      summary.TotalCreditsApplied,
		NetRevenueKobo:   summary.TotalCharged - summary.TotalRefunded - summary.TotalCreditsApplied,
		Currency:         "NGN",
		BreakdownByPlan:  breakdown,
	}, nil
}

// getPlanBreakdown groups ledger CHARGE entries in the period by the plan of
// the subscription each entry belongs to, summing charged amounts and
// counting distinct subscriptions charged per plan.
func (s *Service) getPlanBreakdown(ctx context.Context, tenantID uuid.UUID, from, to time.Time) ([]PlanRevenue, error) {
	subPlanCache := map[uuid.UUID]uuid.UUID{}
	planOf := func(subID uuid.UUID) (uuid.UUID, bool) {
		if planID, ok := subPlanCache[subID]; ok {
			return planID, true
		}
		sub, err := s.subs.GetByID(ctx, subID, tenantID)
		if err != nil || sub == nil {
			return uuid.Nil, false
		}
		subPlanCache[subID] = sub.PlanID
		return sub.PlanID, true
	}

	byPlan := map[uuid.UUID]*PlanRevenue{}
	subsSeenPerPlan := map[uuid.UUID]map[uuid.UUID]bool{}

	offset := 0
	for {
		entries, err := s.ledger.ListByTypeAndDateRange(ctx, tenantID, []string{"CHARGE"}, from, to, listPageSize, offset)
		if err != nil {
			return nil, err
		}
		for _, e := range entries {
			if e.SubscriptionID == nil {
				continue
			}
			planID, ok := planOf(*e.SubscriptionID)
			if !ok {
				continue
			}
			pr, exists := byPlan[planID]
			if !exists {
				name := "Unknown plan"
				if p, err := s.plans.GetByID(ctx, planID, tenantID); err == nil && p != nil {
					name = p.Name
				}
				pr = &PlanRevenue{PlanID: planID, PlanName: name}
				byPlan[planID] = pr
				subsSeenPerPlan[planID] = map[uuid.UUID]bool{}
			}
			pr.TotalChargedKobo += e.Amount
			if !subsSeenPerPlan[planID][*e.SubscriptionID] {
				subsSeenPerPlan[planID][*e.SubscriptionID] = true
				pr.SubscriptionCount++
			}
		}
		if len(entries) < listPageSize {
			break
		}
		offset += listPageSize
	}

	out := make([]PlanRevenue, 0, len(byPlan))
	for _, pr := range byPlan {
		out = append(out, *pr)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].TotalChargedKobo > out[j].TotalChargedKobo })
	return out, nil
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
	all, err := listAllSubscriptions(ctx, subs, tenantID)
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

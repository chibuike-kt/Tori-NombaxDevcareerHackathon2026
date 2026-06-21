package billing

import (
	"math"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
)

type RevenueForecast struct {
	PeriodLabel        string  `json:"period_label"`
	ExpectedLow        int64   `json:"expected_low"`
	ExpectedHigh       int64   `json:"expected_high"`
	ExpectedMid        int64   `json:"expected_mid"`
	ActiveSubscriptions int    `json:"active_subscriptions"`
	AtRiskRevenue      int64   `json:"at_risk_revenue"`
	RecoveryRate       float64 `json:"recovery_rate_pct"`
	Confidence         string  `json:"confidence"`
	Note               string  `json:"note"`
}

// ForecastRevenue projects next month's expected revenue from current
// subscription state and historical dunning recovery rate.
// All amounts in kobo.
func ForecastRevenue(
	subs []*domain.Subscription,
	plans map[string]*domain.Plan,
	historicalRecoveryRate float64,
) RevenueForecast {
	now := time.Now().UTC()
	nextMonth := now.AddDate(0, 1, 0)
	label := nextMonth.Format("January 2006")

	var baseRevenue int64
	var atRiskRevenue int64
	activeCount := 0

	for _, sub := range subs {
		plan, ok := plans[sub.PlanID.String()]
		if !ok {
			continue
		}

		switch sub.Status {
		case domain.StatusActive:
			baseRevenue += plan.Amount
			activeCount++
		case domain.StatusTrialing:
			// Trial converts at end — count as expected but discounted
			// Assume 80% trial conversion rate
			baseRevenue += int64(float64(plan.Amount) * 0.80)
			activeCount++
		case domain.StatusDunning, domain.StatusPastDue:
			// At risk — may recover based on historical rate
			atRiskRevenue += plan.Amount
		case domain.StatusSuspended:
			// Likely lost unless customer updates payment
			atRiskRevenue += int64(float64(plan.Amount) * 0.15)
		}
	}

	// Apply historical recovery rate to at-risk revenue
	rate := historicalRecoveryRate
	if rate <= 0 {
		rate = 0.65 // default Nigerian dunning recovery estimate
	}
	if rate > 1 {
		rate = rate / 100
	}

	recoveredRevenue := int64(float64(atRiskRevenue) * rate)
	lostRevenue := atRiskRevenue - recoveredRevenue

	expectedMid := baseRevenue + recoveredRevenue
	variance := int64(float64(expectedMid) * 0.05) // 5% variance band

	expectedLow := expectedMid - variance - lostRevenue
	expectedHigh := expectedMid + variance

	if expectedLow < 0 {
		expectedLow = 0
	}

	confidence := confidenceLevel(activeCount, historicalRecoveryRate)

note := buildForecastNote(activeCount, atRiskRevenue)

	return RevenueForecast{
		PeriodLabel:         label,
		ExpectedLow:         expectedLow,
		ExpectedHigh:        expectedHigh,
		ExpectedMid:         expectedMid,
		ActiveSubscriptions: activeCount,
		AtRiskRevenue:       atRiskRevenue,
		RecoveryRate:        math.Round(rate*100*10) / 10,
		Confidence:          confidence,
		Note:                note,
	}
}

func confidenceLevel(activeCount int, recoveryRate float64) string {
	switch {
	case activeCount >= 20 && recoveryRate > 0:
		return "high"
	case activeCount >= 5:
		return "medium"
	default:
		return "low"
	}
}

func buildForecastNote(activeCount int, atRisk int64) string {
	if activeCount == 0 {
		return "No active subscriptions to forecast from."
	}
	if atRisk == 0 {
		return "All active subscriptions are current. Forecast based on full renewal."
	}
	return "Forecast includes dunning recovery estimate based on your historical retry success rate."
}

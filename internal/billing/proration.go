package billing

import (
	"math"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
)

// ProrationResult holds the output of a mid-cycle plan change calculation.
type ProrationResult struct {
	DaysRemaining int
	DaysInPeriod  int
	CreditAmount  int64 // kobo — credit for unused old plan days
	ChargeAmount  int64 // kobo — charge for remaining new plan days
	NetAdjustment int64 // positive = charge customer, negative = apply as credit
}

// Calculate computes proration amounts when a customer changes plan mid-cycle.
// All amounts in kobo. Rounded to nearest kobo.
func Calculate(now, periodStart, periodEnd time.Time, oldPlan, newPlan *domain.Plan) ProrationResult {
	daysInPeriod := int(math.Ceil(periodEnd.Sub(periodStart).Hours() / 24))
	daysRemaining := int(math.Round(periodEnd.Sub(now).Hours() / 24))

	if daysRemaining < 0 {
		daysRemaining = 0
	}
	if daysInPeriod <= 0 {
		daysInPeriod = 1
	}

	dailyOldRate := float64(oldPlan.Amount) / float64(daysInPeriod)
	dailyNewRate := float64(newPlan.Amount) / float64(daysInPeriod)

	creditAmount := int64(math.Round(dailyOldRate * float64(daysRemaining)))
	chargeAmount := int64(math.Round(dailyNewRate * float64(daysRemaining)))
	netAdjustment := chargeAmount - creditAmount

	return ProrationResult{
		DaysRemaining: daysRemaining,
		DaysInPeriod:  daysInPeriod,
		CreditAmount:  creditAmount,
		ChargeAmount:  chargeAmount,
		NetAdjustment: netAdjustment,
	}
}

// ToDetails converts a ProrationResult to the JSONB structure stored on invoices.
func ToDetails(r ProrationResult, oldPlan, newPlan *domain.Plan) domain.ProrationDetails {
	return domain.ProrationDetails{
		OldPlanID:     oldPlan.ID,
		NewPlanID:     newPlan.ID,
		DaysRemaining: r.DaysRemaining,
		DaysInPeriod:  r.DaysInPeriod,
		CreditAmount:  r.CreditAmount,
		ChargeAmount:  r.ChargeAmount,
		NetAdjustment: r.NetAdjustment,
	}
}

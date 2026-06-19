package billing_test

import (
	"testing"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/billing"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
)

func monthlyPlan(amount int64) *domain.Plan {
	return &domain.Plan{
		ID:            uuid.New(),
		Interval:      domain.IntervalMonthly,
		IntervalCount: 1,
		Amount:        amount,
		Currency:      "NGN",
	}
}

func TestProration_UpgradeMidCycle(t *testing.T) {
	periodStart := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	periodEnd := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	now := time.Date(2026, 6, 16, 0, 0, 0, 0, time.UTC) // halfway through

	oldPlan := monthlyPlan(500000) // ₦5,000
	newPlan := monthlyPlan(1000000) // ₦10,000

	result := billing.Calculate(now, periodStart, periodEnd, oldPlan, newPlan)

	if result.NetAdjustment <= 0 {
		t.Errorf("upgrade should produce positive net adjustment, got %d", result.NetAdjustment)
	}
	if result.CreditAmount <= 0 {
		t.Error("should credit unused old plan days")
	}
	if result.ChargeAmount <= 0 {
		t.Error("should charge remaining new plan days")
	}
	if result.ChargeAmount <= result.CreditAmount {
		t.Error("upgrade charge should exceed credit")
	}
}

func TestProration_DowngradeMidCycle(t *testing.T) {
	periodStart := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	periodEnd := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	now := time.Date(2026, 6, 16, 0, 0, 0, 0, time.UTC)

	oldPlan := monthlyPlan(1000000) // ₦10,000
	newPlan := monthlyPlan(500000)  // ₦5,000

	result := billing.Calculate(now, periodStart, periodEnd, oldPlan, newPlan)

	if result.NetAdjustment >= 0 {
		t.Errorf("downgrade should produce negative net adjustment (credit), got %d", result.NetAdjustment)
	}
}

func TestProration_SamePlan(t *testing.T) {
	periodStart := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	periodEnd := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	now := time.Date(2026, 6, 16, 0, 0, 0, 0, time.UTC)

	plan := monthlyPlan(500000)
	result := billing.Calculate(now, periodStart, periodEnd, plan, plan)

	if result.NetAdjustment != 0 {
		t.Errorf("same plan should produce zero net adjustment, got %d", result.NetAdjustment)
	}
}

func TestProration_AtPeriodEnd(t *testing.T) {
	periodStart := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	periodEnd := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)

	oldPlan := monthlyPlan(500000)
	newPlan := monthlyPlan(1000000)

	// Changing at period end — zero days remaining
	result := billing.Calculate(periodEnd, periodStart, periodEnd, oldPlan, newPlan)

	if result.DaysRemaining != 0 {
		t.Errorf("expected 0 days remaining at period end, got %d", result.DaysRemaining)
	}
	if result.NetAdjustment != 0 {
		t.Errorf("expected zero adjustment at period end, got %d", result.NetAdjustment)
	}
}

package billing_test

import (
	"testing"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/billing"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
)

func TestNextPeriod_Monthly(t *testing.T) {
	plan := &domain.Plan{Interval: domain.IntervalMonthly, IntervalCount: 1}

	start, end, err := billing.NextPeriod(time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC), plan)
	if err != nil {
		t.Fatal(err)
	}
	if !start.Equal(time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("unexpected start: %v", start)
	}
	if !end.Equal(time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("unexpected end: %v", end)
	}
}

func TestNextPeriod_MonthEndEdgeCase(t *testing.T) {
	// Jan 31 + 1 month = Feb 28 (not Feb 31 which doesn't exist)
	plan := &domain.Plan{Interval: domain.IntervalMonthly, IntervalCount: 1}
	_, end, err := billing.NextPeriod(time.Date(2026, 1, 31, 0, 0, 0, 0, time.UTC), plan)
	if err != nil {
		t.Fatal(err)
	}
	if end.Day() != 28 || end.Month() != time.February {
		t.Errorf("expected Feb 28, got %v", end)
	}
}

func TestNextPeriod_Annual(t *testing.T) {
	plan := &domain.Plan{Interval: domain.IntervalAnnual, IntervalCount: 1}
	_, end, err := billing.NextPeriod(time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC), plan)
	if err != nil {
		t.Fatal(err)
	}
	if !end.Equal(time.Date(2027, 6, 1, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("unexpected end: %v", end)
	}
}

func TestNextPeriod_AnnualLeapYear(t *testing.T) {
	// Feb 29 2024 + 1 year = Feb 28 2025 (2025 is not a leap year)
	plan := &domain.Plan{Interval: domain.IntervalAnnual, IntervalCount: 1}
	_, end, err := billing.NextPeriod(time.Date(2024, 2, 29, 0, 0, 0, 0, time.UTC), plan)
	if err != nil {
		t.Fatal(err)
	}
	if end.Day() != 28 || end.Month() != time.February || end.Year() != 2025 {
		t.Errorf("expected Feb 28 2025, got %v", end)
	}
}

func TestNextPeriod_Custom(t *testing.T) {
	plan := &domain.Plan{Interval: domain.IntervalCustom, IntervalCount: 14}
	_, end, err := billing.NextPeriod(time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC), plan)
	if err != nil {
		t.Fatal(err)
	}
	if !end.Equal(time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("expected Jun 15, got %v", end)
	}
}

func TestNextPeriod_UnknownInterval(t *testing.T) {
	plan := &domain.Plan{Interval: "weekly"}
	_, _, err := billing.NextPeriod(time.Now(), plan)
	if err == nil {
		t.Fatal("expected error for unknown interval")
	}
}

func TestIdempotencyKey_Deterministic(t *testing.T) {
	subID := uuid.New().String()
	periodStart := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)

	k1 := billing.IdempotencyKey(subID, periodStart, 0)
	k2 := billing.IdempotencyKey(subID, periodStart, 0)
	if k1 != k2 {
		t.Errorf("same inputs produced different keys: %q vs %q", k1, k2)
	}
}

func TestIdempotencyKey_DifferentAttempts(t *testing.T) {
	subID := uuid.New().String()
	periodStart := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)

	k0 := billing.IdempotencyKey(subID, periodStart, 0)
	k1 := billing.IdempotencyKey(subID, periodStart, 1)
	if k0 == k1 {
		t.Error("different attempt numbers should produce different keys")
	}
}

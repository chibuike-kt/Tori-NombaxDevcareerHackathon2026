package billing

import (
	"fmt"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
)

// addMonths adds n months to t, clamping to the last day of the target month.
// This handles Jan 31 + 1 month = Feb 28, not March 3.
func addMonths(t time.Time, n int) time.Time {
	year, month, day := t.Date()
	hour, min, sec := t.Clock()
	nsec := t.Nanosecond()
	target := time.Date(year, time.Month(int(month)+n), 1, hour, min, sec, nsec, t.Location())
	// Last day of target month
	lastDay := time.Date(target.Year(), target.Month()+1, 0, hour, min, sec, nsec, t.Location()).Day()
	if day > lastDay {
		day = lastDay
	}
	return time.Date(target.Year(), target.Month(), day, hour, min, sec, nsec, t.Location())
}

// NextPeriod computes the next billing period start and end.
func NextPeriod(periodEnd time.Time, plan *domain.Plan) (start, end time.Time, err error) {
	start = periodEnd
	switch plan.Interval {
	case domain.IntervalMonthly:
		end = addMonths(periodEnd, plan.IntervalCount)
	case domain.IntervalAnnual:
		end = addMonths(periodEnd, plan.IntervalCount*12)
	case domain.IntervalCustom:
		end = periodEnd.AddDate(0, 0, plan.IntervalCount)
	default:
		return time.Time{}, time.Time{}, fmt.Errorf("unknown interval: %q", plan.Interval)
	}
	return start, end, nil
}

// TrialEndDate computes when a trial ends given a start time and trial days.
func TrialEndDate(start time.Time, trialDays int) time.Time {
	return start.AddDate(0, 0, trialDays)
}

// IdempotencyKey generates a deterministic charge key for a given billing attempt.
func IdempotencyKey(subscriptionID string, periodStart time.Time, attempt int) string {
	return fmt.Sprintf("charge:%s:%d:%d", subscriptionID, periodStart.Unix(), attempt)
}

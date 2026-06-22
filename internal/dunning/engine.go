package dunning

import (
	"context"
	"fmt"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/payment"
)

// RetryDecision is what the dunning engine returns after classifying a failure.
type RetryDecision struct {
	ShouldRetry   bool
	NextRetryAt   time.Time
	NewStatus     domain.SubscriptionStatus
	Attempt       int
	IsGracePeriod bool
}

// Engine decides what happens after a payment failure.
type Engine struct {
	classifier *payment.Classifier
}

func NewEngine(classifier *payment.Classifier) *Engine {
	return &Engine{classifier: classifier}
}

// Decide takes the current subscription state and a failure code,
// and returns what the dunning engine should do next.
//
// Grace period logic:
// When a renewal charge fails for the first time on an ACTIVE subscription,
// we do not immediately move to PAST_DUE and begin dunning.
// Instead we grant a 48-hour grace period — one silent retry window
// aligned to the next business day. Only if that also fails do we
// begin the full dunning schedule. This prevents punishing customers
// for one-off bank outages or temporary insufficient funds.
func (e *Engine) Decide(
	ctx context.Context,
	sub *domain.Subscription,
	failureCode string,
	config domain.DunningConfig,
) (*RetryDecision, error) {
	// Non-retriable: stop immediately regardless of state
	if !e.classifier.IsRetriable(failureCode) {
		return &RetryDecision{
			ShouldRetry: false,
			NewStatus:   domain.StatusSuspended,
			Attempt:     sub.DunningAttempt,
		}, nil
	}

	// First failure on an active subscription: enter grace period
	// Give 48 hours before escalating to full dunning
	if sub.DunningAttempt == 0 &&
		(sub.Status == domain.StatusActive || sub.Status == domain.StatusTrialing) {
		graceEnd := time.Now().Add(48 * time.Hour)
		return &RetryDecision{
			ShouldRetry:   true,
			NextRetryAt:   graceEnd,
			NewStatus:     domain.StatusGracePeriod,
			Attempt:       0,
			IsGracePeriod: true,
		}, nil
	}

	// Already in grace period or past due: begin full dunning schedule
	nextAttempt := sub.DunningAttempt + 1

	if nextAttempt > config.MaxAttempts {
		return &RetryDecision{
			ShouldRetry: false,
			NewStatus:   domain.StatusSuspended,
			Attempt:     sub.DunningAttempt,
		}, nil
	}

	intervals := config.RetryIntervalsDays
	if nextAttempt > len(intervals) {
		return &RetryDecision{
			ShouldRetry: false,
			NewStatus:   domain.StatusSuspended,
			Attempt:     sub.DunningAttempt,
		}, nil
	}

	days := intervals[nextAttempt-1]
	nextRetryAt := time.Now().AddDate(0, 0, days)

	newStatus := domain.StatusDunning
	if sub.Status == domain.StatusActive || sub.Status == domain.StatusTrialing {
		newStatus = domain.StatusPastDue
	}

	return &RetryDecision{
		ShouldRetry: true,
		NextRetryAt: nextRetryAt,
		NewStatus:   newStatus,
		Attempt:     nextAttempt,
	}, nil
}

// NotificationStub logs what email would be sent at each dunning stage.
// Real email delivery is out of scope — stubbed per spec.
func NotificationStub(stage string, customerEmail string, sub *domain.Subscription) {
	fmt.Printf("[EMAIL WOULD SEND: %s to %s] subscription_id=%s attempt=%d\n",
		stage, customerEmail, sub.ID, sub.DunningAttempt)
}

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
	ShouldRetry bool
	NextRetryAt time.Time
	NewStatus   domain.SubscriptionStatus
	Attempt     int
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
func (e *Engine) Decide(
	ctx context.Context,
	sub *domain.Subscription,
	failureCode string,
	config domain.DunningConfig,
) (*RetryDecision, error) {
	if !e.classifier.IsRetriable(failureCode) {
		return &RetryDecision{
			ShouldRetry: false,
			NewStatus:   domain.StatusSuspended,
			Attempt:     sub.DunningAttempt,
		}, nil
	}

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

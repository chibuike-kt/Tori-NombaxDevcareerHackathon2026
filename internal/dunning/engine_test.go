package dunning_test

import (
	"context"
	"testing"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/dunning"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/payment"
	"github.com/google/uuid"
)

func newTestClassifier() *payment.Classifier {
	codes := map[string]domain.FailureCategory{
		"insufficient_funds":          domain.FailureRetriable,
		"transaction_limit_exceeded":  domain.FailureRetriable,
		"temporary_bank_decline":      domain.FailureRetriable,
		"network_timeout":             domain.FailureRetriable,
		"do_not_honour_temporary":     domain.FailureRetriable,
		"card_expired":                domain.FailureNonRetriable,
		"card_stolen_or_lost":         domain.FailureNonRetriable,
		"do_not_honour_permanent":     domain.FailureNonRetriable,
		"invalid_card_number":         domain.FailureNonRetriable,
		"card_blocked_international":  domain.FailureNonRetriable,
		"fraud_suspected":             domain.FailureNonRetriable,
	}
	return payment.NewClassifierFromMap(codes)
}

func newEngine() *dunning.Engine {
	return dunning.NewEngine(newTestClassifier())
}

func defaultConfig() domain.DunningConfig {
	return domain.DefaultDunningConfig()
}

func activeSub(attempt int) *domain.Subscription {
	return &domain.Subscription{
		ID:             uuid.New(),
		Status:         domain.StatusActive,
		DunningAttempt: attempt,
	}
}

func dunningSub(attempt int) *domain.Subscription {
	return &domain.Subscription{
		ID:             uuid.New(),
		Status:         domain.StatusDunning,
		DunningAttempt: attempt,
	}
}

func TestDecide_NonRetriableMovesToSuspended(t *testing.T) {
	e := newEngine()
	sub := activeSub(0)
	decision, err := e.Decide(context.Background(), sub, "card_expired", defaultConfig())
	if err != nil {
		t.Fatal(err)
	}
	if decision.ShouldRetry {
		t.Error("card_expired should not retry")
	}
	if decision.NewStatus != domain.StatusSuspended {
		t.Errorf("expected SUSPENDED, got %q", decision.NewStatus)
	}
}

func TestDecide_RetriableSchedulesNextRetry(t *testing.T) {
	e := newEngine()
	sub := activeSub(0)
	decision, err := e.Decide(context.Background(), sub, "insufficient_funds", defaultConfig())
	if err != nil {
		t.Fatal(err)
	}
	if !decision.ShouldRetry {
		t.Error("insufficient_funds should retry")
	}
	if decision.NextRetryAt.Before(time.Now()) {
		t.Error("next retry should be in the future")
	}
}

func TestDecide_RetryCountIncrements(t *testing.T) {
	e := newEngine()
	sub := dunningSub(1)
	decision, err := e.Decide(context.Background(), sub, "insufficient_funds", defaultConfig())
	if err != nil {
		t.Fatal(err)
	}
	if decision.Attempt != 2 {
		t.Errorf("expected attempt 2, got %d", decision.Attempt)
	}
}

func TestDecide_MaxRetriesExhausted(t *testing.T) {
	e := newEngine()
	sub := dunningSub(4)
	decision, err := e.Decide(context.Background(), sub, "insufficient_funds", defaultConfig())
	if err != nil {
		t.Fatal(err)
	}
	if decision.ShouldRetry {
		t.Error("should not retry after max attempts")
	}
	if decision.NewStatus != domain.StatusSuspended {
		t.Errorf("expected SUSPENDED, got %q", decision.NewStatus)
	}
}

func TestDecide_FraudSuspendedImmediately(t *testing.T) {
	e := newEngine()
	sub := activeSub(0)
	decision, err := e.Decide(context.Background(), sub, "fraud_suspected", defaultConfig())
	if err != nil {
		t.Fatal(err)
	}
	if decision.ShouldRetry {
		t.Error("fraud_suspected should never retry")
	}
	if decision.NewStatus != domain.StatusSuspended {
		t.Errorf("expected SUSPENDED, got %q", decision.NewStatus)
	}
}

func TestDecide_PerTenantConfigOverride(t *testing.T) {
	e := newEngine()
	sub := activeSub(0)

	customConfig := domain.DunningConfig{
		RetryIntervalsDays: []int{1, 3},
		MaxAttempts:        2,
		SuspensionAction:   "suspend",
	}

	d1, _ := e.Decide(context.Background(), sub, "insufficient_funds", customConfig)
	if !d1.ShouldRetry {
		t.Error("first retry should be scheduled")
	}

	sub.DunningAttempt = 2
	d2, _ := e.Decide(context.Background(), sub, "insufficient_funds", customConfig)
	if d2.ShouldRetry {
		t.Error("should not retry past custom max")
	}
}

func TestDecide_UnknownCodeDefaultsToRetriable(t *testing.T) {
	e := newEngine()
	sub := activeSub(0)
	decision, err := e.Decide(context.Background(), sub, "some_unknown_code_xyz", defaultConfig())
	if err != nil {
		t.Fatal(err)
	}
	if !decision.ShouldRetry {
		t.Error("unknown codes should default to retriable")
	}
}

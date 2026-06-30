package subscription_test

import (
	"testing"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/subscription"
)

func TestTransition_ValidTransitions(t *testing.T) {
	cases := []struct {
		name  string
		from  domain.SubscriptionStatus
		event subscription.Event
		want  domain.SubscriptionStatus
	}{
		// PENDING_PAYMENT transitions
		{"pending payment succeeds", domain.StatusPendingPayment, subscription.EventCheckoutPaymentSucceeded, domain.StatusActive},
		{"pending payment fails", domain.StatusPendingPayment, subscription.EventCheckoutPaymentFailed, domain.StatusPastDue},
		{"pending checkout abandoned", domain.StatusPendingPayment, subscription.EventCheckoutAbandoned, domain.StatusPastDue},
		{"pending customer cancels", domain.StatusPendingPayment, subscription.EventCustomerCancelled, domain.StatusCancelled},
		{"pending tenant cancels", domain.StatusPendingPayment, subscription.EventTenantCancelled, domain.StatusCancelled},
		// TRIALING transitions
		{"trial payment succeeds", domain.StatusTrialing, subscription.EventTrialPaymentSucceeded, domain.StatusActive},
		{"trial payment fails", domain.StatusTrialing, subscription.EventTrialPaymentFailed, domain.StatusPastDue},
		{"trial cancelled", domain.StatusTrialing, subscription.EventTrialCancelled, domain.StatusCancelled},
		// ACTIVE transitions
		{"renewal fails → grace", domain.StatusActive, subscription.EventRenewalFailed, domain.StatusGracePeriod},
		{"customer pauses", domain.StatusActive, subscription.EventCustomerPaused, domain.StatusPaused},
		{"customer cancels", domain.StatusActive, subscription.EventCustomerCancelled, domain.StatusCancelled},
		{"tenant cancels", domain.StatusActive, subscription.EventTenantCancelled, domain.StatusCancelled},
		// GRACE_PERIOD transitions
		{"grace retry succeeds", domain.StatusGracePeriod, subscription.EventGraceRetrySucceeded, domain.StatusActive},
		{"grace retry fails", domain.StatusGracePeriod, subscription.EventGraceRetryFailed, domain.StatusPastDue},
		{"grace expired", domain.StatusGracePeriod, subscription.EventGraceExpired, domain.StatusPastDue},
		{"grace customer cancels", domain.StatusGracePeriod, subscription.EventCustomerCancelled, domain.StatusCancelled},
		// PAST_DUE transitions
		{"retry 1 succeeds", domain.StatusPastDue, subscription.EventRetrySucceeded, domain.StatusActive},
		{"retry 1 fails retriable", domain.StatusPastDue, subscription.EventRetryFailedRetriable, domain.StatusDunning},
		{"retry 1 fails non-retriable", domain.StatusPastDue, subscription.EventRetryFailedNonRetriable, domain.StatusSuspended},
		// DUNNING transitions
		{"dunning retry succeeds", domain.StatusDunning, subscription.EventRetrySucceeded, domain.StatusActive},
		{"dunning retry fails retriable", domain.StatusDunning, subscription.EventRetryFailedRetriable, domain.StatusDunning},
		{"dunning retries exhausted", domain.StatusDunning, subscription.EventRetriesExhausted, domain.StatusSuspended},
		// PAUSED transitions
		{"customer resumes", domain.StatusPaused, subscription.EventCustomerResumed, domain.StatusActive},
		{"paused customer cancels", domain.StatusPaused, subscription.EventCustomerCancelled, domain.StatusCancelled},
		// SUSPENDED transitions
		{"manual recovery", domain.StatusSuspended, subscription.EventManualRecovery, domain.StatusActive},
		{"suspended customer cancels", domain.StatusSuspended, subscription.EventCustomerCancelled, domain.StatusCancelled},
		{"suspended tenant cancels", domain.StatusSuspended, subscription.EventTenantCancelled, domain.StatusCancelled},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := subscription.Transition(tc.from, tc.event)
			if err != nil {
				t.Fatalf("expected no error, got: %v", err)
			}
			if got != tc.want {
				t.Fatalf("expected state %q, got %q", tc.want, got)
			}
		})
	}
}

func TestTransition_InvalidTransitions(t *testing.T) {
	cases := []struct {
		name  string
		from  domain.SubscriptionStatus
		event subscription.Event
	}{
		{"pending cannot pause", domain.StatusPendingPayment, subscription.EventCustomerPaused},
		{"pending cannot resume", domain.StatusPendingPayment, subscription.EventCustomerResumed},
		{"pending cannot renewal fail", domain.StatusPendingPayment, subscription.EventRenewalFailed},
		{"active cannot resume", domain.StatusActive, subscription.EventCustomerResumed},
		{"active cannot manual recover", domain.StatusActive, subscription.EventManualRecovery},
		{"past_due cannot pause", domain.StatusPastDue, subscription.EventCustomerPaused},
		{"dunning cannot pause", domain.StatusDunning, subscription.EventCustomerPaused},
		{"paused cannot renewal fail", domain.StatusPaused, subscription.EventRenewalFailed},
		{"suspended cannot pause", domain.StatusSuspended, subscription.EventCustomerPaused},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := subscription.Transition(tc.from, tc.event)
			if err == nil {
				t.Fatalf("expected error for invalid transition %q from %q, got none", tc.event, tc.from)
			}
		})
	}
}

func TestTransition_TerminalState(t *testing.T) {
	events := []subscription.Event{
		subscription.EventTrialPaymentSucceeded,
		subscription.EventCheckoutPaymentSucceeded,
		subscription.EventRenewalFailed,
		subscription.EventRetrySucceeded,
		subscription.EventCustomerResumed,
		subscription.EventManualRecovery,
		subscription.EventCustomerCancelled,
		subscription.EventTenantCancelled,
	}

	for _, e := range events {
		t.Run("cancelled+"+string(e), func(t *testing.T) {
			_, err := subscription.Transition(domain.StatusCancelled, e)
			if err == nil {
				t.Fatalf("expected error from terminal CANCELLED state with event %q", e)
			}
		})
	}
}

func TestTransition_ErrorContainsContext(t *testing.T) {
	_, err := subscription.Transition(domain.StatusActive, subscription.EventCustomerResumed)
	if err == nil {
		t.Fatal("expected error")
	}

	te, ok := err.(*domain.TransitionError)
	if !ok {
		if err == domain.ErrTerminalState {
			return
		}
		t.Fatalf("expected *domain.TransitionError, got %T", err)
	}

	if te.CurrentState != domain.StatusActive {
		t.Errorf("expected CurrentState %q, got %q", domain.StatusActive, te.CurrentState)
	}
	if len(te.ValidTransitions) == 0 {
		t.Error("expected ValidTransitions to be populated")
	}
}

func TestTransition_DunningLoopsCorrectly(t *testing.T) {
	state := domain.StatusDunning
	for i := 0; i < 3; i++ {
		next, err := subscription.Transition(state, subscription.EventRetryFailedRetriable)
		if err != nil {
			t.Fatalf("attempt %d: unexpected error: %v", i+1, err)
		}
		if next != domain.StatusDunning {
			t.Fatalf("attempt %d: expected DUNNING, got %q", i+1, next)
		}
		state = next
	}

	next, err := subscription.Transition(state, subscription.EventRetriesExhausted)
	if err != nil {
		t.Fatalf("unexpected error on exhaustion: %v", err)
	}
	if next != domain.StatusSuspended {
		t.Fatalf("expected SUSPENDED after exhaustion, got %q", next)
	}
}

func TestTransition_PendingPaymentFlow(t *testing.T) {
	// Full happy path: PENDING_PAYMENT → ACTIVE
	next, err := subscription.Transition(domain.StatusPendingPayment, subscription.EventCheckoutPaymentSucceeded)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if next != domain.StatusActive {
		t.Fatalf("expected ACTIVE, got %q", next)
	}

	// Failed payment path: PENDING_PAYMENT → PAST_DUE
	next, err = subscription.Transition(domain.StatusPendingPayment, subscription.EventCheckoutPaymentFailed)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if next != domain.StatusPastDue {
		t.Fatalf("expected PAST_DUE, got %q", next)
	}

	// Abandoned path: PENDING_PAYMENT → PAST_DUE
	next, err = subscription.Transition(domain.StatusPendingPayment, subscription.EventCheckoutAbandoned)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if next != domain.StatusPastDue {
		t.Fatalf("expected PAST_DUE, got %q", next)
	}
}

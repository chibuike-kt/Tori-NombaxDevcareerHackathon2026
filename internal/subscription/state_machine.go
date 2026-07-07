package subscription

import "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"

type Event string

const (
	EventTrialPaymentSucceeded    Event = "trial_payment_succeeded"
	EventTrialPaymentFailed       Event = "trial_payment_failed"
	EventTrialCancelled           Event = "trial_cancelled"
	EventRenewalFailed            Event = "renewal_failed"
	EventGraceRetrySucceeded      Event = "grace_retry_succeeded"
	EventGraceRetryFailed         Event = "grace_retry_failed"
	EventCustomerPaused           Event = "customer_paused"
	EventCustomerCancelled        Event = "customer_cancelled"
	EventTenantCancelled          Event = "tenant_cancelled"
	EventRetrySucceeded           Event = "retry_succeeded"
	EventRetryFailedRetriable     Event = "retry_failed_retriable"
	EventRetryFailedNonRetriable  Event = "retry_failed_non_retriable"
	EventRetriesExhausted         Event = "retries_exhausted"
	EventCustomerResumed          Event = "customer_resumed"
	EventManualRecovery           Event = "manual_recovery"
	EventGraceExpired             Event = "grace_expired"
	EventCheckoutPaymentSucceeded Event = "checkout_payment_succeeded"
	EventCheckoutPaymentFailed    Event = "checkout_payment_failed"
	EventCheckoutAbandoned        Event = "checkout_abandoned"
)

var transitions = map[domain.SubscriptionStatus]map[Event]domain.SubscriptionStatus{
	domain.StatusPendingPayment: {
		EventCheckoutPaymentSucceeded: domain.StatusActive,
		EventCheckoutPaymentFailed:    domain.StatusPastDue,
		EventCheckoutAbandoned:        domain.StatusPastDue,
		EventCustomerCancelled:        domain.StatusCancelled,
		EventTenantCancelled:          domain.StatusCancelled,
	},
	domain.StatusTrialing: {
    EventTrialPaymentSucceeded: domain.StatusActive,
    EventTrialPaymentFailed:    domain.StatusPastDue,
    EventTrialCancelled:        domain.StatusCancelled,
    EventCustomerCancelled:     domain.StatusCancelled,
    EventTenantCancelled:       domain.StatusCancelled,
	},
	domain.StatusActive: {
		EventRenewalFailed:     domain.StatusGracePeriod,
		EventCustomerPaused:    domain.StatusPaused,
		EventCustomerCancelled: domain.StatusCancelled,
		EventTenantCancelled:   domain.StatusCancelled,
	},
	domain.StatusGracePeriod: {
		EventGraceRetrySucceeded: domain.StatusActive,
		EventGraceRetryFailed:    domain.StatusPastDue,
		EventGraceExpired:        domain.StatusPastDue,
		EventCustomerCancelled:   domain.StatusCancelled,
		EventTenantCancelled:     domain.StatusCancelled,
	},
	domain.StatusPastDue: {
		EventRetrySucceeded:          domain.StatusActive,
		EventRetryFailedRetriable:    domain.StatusDunning,
		EventRetryFailedNonRetriable: domain.StatusSuspended,
	},
	domain.StatusDunning: {
		EventRetrySucceeded:          domain.StatusActive,
		EventRetryFailedRetriable:    domain.StatusDunning,
		EventRetriesExhausted:        domain.StatusSuspended,
	},
	domain.StatusPaused: {
		EventCustomerResumed:   domain.StatusActive,
		EventCustomerCancelled: domain.StatusCancelled,
	},
	domain.StatusSuspended: {
		EventManualRecovery:    domain.StatusActive,
		EventCustomerCancelled: domain.StatusCancelled,
		EventTenantCancelled:   domain.StatusCancelled,
	},
	domain.StatusCancelled: {},
}

func validEventsFrom(state domain.SubscriptionStatus) []string {
	events, ok := transitions[state]
	if !ok {
		return nil
	}
	result := make([]string, 0, len(events))
	for e := range events {
		result = append(result, string(e))
	}
	return result
}

func Transition(current domain.SubscriptionStatus, event Event) (domain.SubscriptionStatus, error) {
	stateMap, ok := transitions[current]
	if !ok {
		return current, &domain.TransitionError{
			CurrentState:     current,
			AttemptedEvent:   string(event),
			ValidTransitions: nil,
		}
	}

	if current == domain.StatusCancelled {
		return current, domain.ErrTerminalState
	}

	next, ok := stateMap[event]
	if !ok {
		return current, &domain.TransitionError{
			CurrentState:     current,
			AttemptedEvent:   string(event),
			ValidTransitions: validEventsFrom(current),
		}
	}

	return next, nil
}

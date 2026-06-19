package subscription

import "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"

// Event represents something that happened which may cause a state change.
type Event string

const (
	EventTrialPaymentSucceeded   Event = "trial_payment_succeeded"
	EventTrialPaymentFailed      Event = "trial_payment_failed"
	EventTrialCancelled          Event = "trial_cancelled"
	EventRenewalFailed           Event = "renewal_failed"
	EventCustomerPaused          Event = "customer_paused"
	EventCustomerCancelled       Event = "customer_cancelled"
	EventTenantCancelled         Event = "tenant_cancelled"
	EventRetrySucceeded          Event = "retry_succeeded"
	EventRetryFailedRetriable    Event = "retry_failed_retriable"
	EventRetryFailedNonRetriable Event = "retry_failed_non_retriable"
	EventRetriesExhausted        Event = "retries_exhausted"
	EventCustomerResumed         Event = "customer_resumed"
	EventManualRecovery          Event = "manual_recovery"
)

// transitions maps every valid (currentState, event) pair to a new state.
var transitions = map[domain.SubscriptionStatus]map[Event]domain.SubscriptionStatus{
	domain.StatusTrialing: {
		EventTrialPaymentSucceeded: domain.StatusActive,
		EventTrialPaymentFailed:    domain.StatusPastDue,
		EventTrialCancelled:        domain.StatusCancelled,
	},
	domain.StatusActive: {
		EventRenewalFailed:    domain.StatusPastDue,
		EventCustomerPaused:   domain.StatusPaused,
		EventCustomerCancelled: domain.StatusCancelled,
		EventTenantCancelled:  domain.StatusCancelled,
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
		EventManualRecovery:   domain.StatusActive,
		EventCustomerCancelled: domain.StatusCancelled,
		EventTenantCancelled:  domain.StatusCancelled,
	},
	// CANCELLED is terminal — no outbound transitions.
	domain.StatusCancelled: {},
}

// validEventsFrom returns a list of valid event names from a given state.
// Used to populate TransitionError for API consumers.
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

// Transition is a pure function. It takes the current state and an event,
// and returns the next state or an error. No database calls. No side effects.
// The caller is responsible for persisting the new state and firing side effects.
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

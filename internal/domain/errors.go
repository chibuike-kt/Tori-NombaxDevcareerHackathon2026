package domain

import "errors"

var (
	ErrNotFound            = errors.New("not found")
	ErrAlreadyExists       = errors.New("already exists")
	ErrInvalidTransition   = errors.New("invalid state transition")
	ErrTerminalState       = errors.New("subscription is in a terminal state")
	ErrIdempotencyConflict = errors.New("idempotency key already used")
	ErrInvalidAmount       = errors.New("amount must be greater than zero")
	ErrInvalidPlan         = errors.New("plan is inactive or does not exist")
	ErrCustomerArchived    = errors.New("customer is archived")
	ErrTenantInactive      = errors.New("tenant is inactive")
	ErrUnauthorised        = errors.New("unauthorised")
)

// TransitionError carries context about why a state transition was rejected.
type TransitionError struct {
	CurrentState    SubscriptionStatus
	AttemptedEvent  string
	ValidTransitions []string
}

func (e *TransitionError) Error() string {
	return "invalid transition: cannot apply '" + e.AttemptedEvent + "' from state '" + string(e.CurrentState) + "'"
}

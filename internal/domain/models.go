package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// MemberRole defines access levels within a tenant workspace.
type MemberRole string

const (
	MemberRoleOwner     MemberRole = "owner"
	MemberRoleAdmin     MemberRole = "admin"
	MemberRoleDeveloper MemberRole = "developer"
	MemberRoleViewer    MemberRole = "viewer"
)

type MemberStatus string

const (
	MemberStatusActive    MemberStatus = "active"
	MemberStatusInvited   MemberStatus = "invited"
	MemberStatusSuspended MemberStatus = "suspended"
)

type Member struct {
	ID           uuid.UUID    `json:"id"`
	TenantID     uuid.UUID    `json:"tenant_id"`
	Email        string       `json:"email"`
	Name         string       `json:"name"`
	Role         MemberRole   `json:"role"`
	Status       MemberStatus `json:"status"`
	PasswordHash string       `json:"-"`
	LastLoginAt  *time.Time   `json:"last_login_at,omitempty"`
	CreatedAt    time.Time    `json:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at"`
}

type Invitation struct {
	ID         uuid.UUID  `json:"id"`
	TenantID   uuid.UUID  `json:"tenant_id"`
	Email      string     `json:"email"`
	Role       MemberRole `json:"role"`
	Token      string     `json:"token"`
	InvitedBy  *uuid.UUID `json:"invited_by,omitempty"`
	ExpiresAt  time.Time  `json:"expires_at"`
	AcceptedAt *time.Time `json:"accepted_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

type AuditEntry struct {
	ID          uuid.UUID       `json:"id"`
	TenantID    uuid.UUID       `json:"tenant_id"`
	ActorID     *uuid.UUID      `json:"actor_id,omitempty"`
	ActorEmail  string          `json:"actor_email"`
	Action      string          `json:"action"`
	Target      string          `json:"target"`
	IPAddress   string          `json:"ip_address"`
	Metadata    json.RawMessage `json:"metadata,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
}

type SubscriptionStatus string

const (
	StatusTrialing    SubscriptionStatus = "TRIALING"
	StatusActive      SubscriptionStatus = "ACTIVE"
	StatusGracePeriod SubscriptionStatus = "GRACE_PERIOD"
	StatusPastDue     SubscriptionStatus = "PAST_DUE"
	StatusDunning     SubscriptionStatus = "DUNNING"
	StatusPaused      SubscriptionStatus = "PAUSED"
	StatusSuspended   SubscriptionStatus = "SUSPENDED"
	StatusCancelled   SubscriptionStatus = "CANCELLED"
	StatusPendingPayment SubscriptionStatus = "PENDING_PAYMENT"
)

type PlanInterval string

const (
	IntervalMonthly PlanInterval = "monthly"
	IntervalAnnual  PlanInterval = "annual"
	IntervalCustom  PlanInterval = "custom"
)

type LedgerEntryType string

const (
	EntryCharge     LedgerEntryType = "CHARGE"
	EntryRefund     LedgerEntryType = "REFUND"
	EntryCredit     LedgerEntryType = "CREDIT"
	EntryProration  LedgerEntryType = "PRORATION"
	EntryAdjustment LedgerEntryType = "ADJUSTMENT"
	EntryOverride   LedgerEntryType = "OVERRIDE"
	EntryTrialStart LedgerEntryType = "TRIAL_START"
	EntryTrialEnd   LedgerEntryType = "TRIAL_END"
)

type LedgerDirection string

const (
	DirectionDebit  LedgerDirection = "DEBIT"
	DirectionCredit LedgerDirection = "CREDIT"
)

type InvoiceStatus string

const (
	InvoiceDraft         InvoiceStatus = "draft"
	InvoiceOpen          InvoiceStatus = "open"
	InvoicePaid          InvoiceStatus = "paid"
	InvoiceVoid          InvoiceStatus = "void"
	InvoiceUncollectible InvoiceStatus = "uncollectible"
)

type JobType string

const (
	JobProcessBillingCycle      JobType = "process_billing_cycle"
	JobRetryFailedPayment       JobType = "retry_failed_payment"
	JobExpireTrial              JobType = "expire_trial"
	JobDeliverWebhook           JobType = "deliver_webhook"
	JobSendDunningNotification  JobType = "send_dunning_notification"
	JobSuspendSubscription      JobType = "suspend_subscription"
	JobReactivateSubscription   JobType = "reactivate_subscription"
	JobTypeGraceRetry JobType = "grace_retry"
	JobReconciliation JobType = "reconciliation"
	JobCheckoutAbandoned JobType = "checkout_abandoned"
	JobWebhookDeliver JobType = "webhook_deliver"
	JobCancelAtPeriodEnd JobType = "cancel_at_period_end"
	JobSimulateWebhook JobType = "simulate_webhook"
)

type FailureCategory string

const (
	FailureRetriable    FailureCategory = "RETRIABLE"
	FailureNonRetriable FailureCategory = "NON_RETRIABLE"
)

// WebhookEventType covers all outbound events emitted to tenants.
type WebhookEventType string

const (
	EventSubscriptionCreated   WebhookEventType = "subscription.created"
	EventSubscriptionActivated WebhookEventType = "subscription.activated"
	EventSubscriptionPaused    WebhookEventType = "subscription.paused"
	EventSubscriptionResumed   WebhookEventType = "subscription.resumed"
	EventSubscriptionCancelled WebhookEventType = "subscription.cancelled"
	EventSubscriptionSuspended WebhookEventType = "subscription.suspended"
	EventPaymentSucceeded      WebhookEventType = "payment.succeeded"
	EventPaymentFailed         WebhookEventType = "payment.failed"
	EventPaymentRetrying       WebhookEventType = "payment.retrying"
	EventInvoiceGenerated      WebhookEventType = "invoice.generated"
	EventInvoicePaid           WebhookEventType = "invoice.paid"
	EventInvoiceVoided         WebhookEventType = "invoice.voided"
	EventDunningStarted        WebhookEventType = "dunning.started"
	EventDunningRecovered      WebhookEventType = "dunning.recovered"
	EventDunningExhausted      WebhookEventType = "dunning.exhausted"
	EventPaymentActionRequired WebhookEventType = "payment.action_required"
)

// Tenant represents a SaaS business registered on the billing engine.
type Tenant struct {
	ID            uuid.UUID     `json:"id"`
	Name          string        `json:"name"`
	Email         string        `json:"email"`
	APIKeyHash    string        `json:"-"`
	WebhookSecret string        `json:"-"`
	PasswordHash  string        `json:"-"`
	DunningConfig DunningConfig `json:"dunning_config"`
	IsActive      bool          `json:"is_active"`
	CreatedAt     time.Time     `json:"created_at"`
	APIKeyHint string `json:"api_key_hint"`
	EmailVerified  bool          `json:"email_verified"`
}

type DunningConfig struct {
	RetryIntervalsDays []int  `json:"retry_intervals_days"`
	MaxAttempts        int    `json:"max_attempts"`
	SuspensionAction   string `json:"suspension_action"`
	NotifyCustomer     bool   `json:"notify_customer"`
	NotifyMerchant     bool   `json:"notify_merchant"`
	SmartRetry         bool   `json:"smart_retry"`
}

func DefaultDunningConfig() DunningConfig {
	return DunningConfig{
		RetryIntervalsDays: []int{3, 7, 14, 21},
		MaxAttempts:        4,
		SuspensionAction:   "suspend",
		NotifyCustomer:     true,
		NotifyMerchant:     true,
		SmartRetry:         true,
	}
}

type Customer struct {
	ID              uuid.UUID       `json:"id"`
	TenantID        uuid.UUID       `json:"tenant_id"`
	ExternalID      *string         `json:"external_id,omitempty"`
	Email           string          `json:"email"`
	Name            *string         `json:"name,omitempty"`
	NombaCustomerID *string         `json:"nomba_customer_id,omitempty"`
	TokenisedCard   json.RawMessage `json:"tokenised_card,omitempty"`
	Metadata        json.RawMessage `json:"metadata,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
}

type Plan struct {
	ID              uuid.UUID    `json:"id"`
	TenantID        uuid.UUID    `json:"tenant_id"`
	Name            string       `json:"name"`
	Description     *string      `json:"description,omitempty"`
	Amount          int64        `json:"amount"`
	Currency        string       `json:"currency"`
	Interval        PlanInterval `json:"interval"`
	IntervalCount   int          `json:"interval_count"`
	TrialPeriodDays int          `json:"trial_period_days"`
	IsActive        bool         `json:"is_active"`
	Metadata        json.RawMessage `json:"metadata,omitempty"`
	CreatedAt       time.Time    `json:"created_at"`
}

type Subscription struct {
	ID                 uuid.UUID          `json:"id"`
	TenantID           uuid.UUID          `json:"tenant_id"`
	CustomerID         uuid.UUID          `json:"customer_id"`
	PlanID             uuid.UUID          `json:"plan_id"`
	Status             SubscriptionStatus `json:"status"`
	TokenKey     string `json:"token_key,omitempty"`
	MandateID    string `json:"mandate_id,omitempty"`
	RecoveryRail string `json:"recovery_rail,omitempty"` // card | mandate | manual
	CurrentPeriodStart time.Time          `json:"current_period_start"`
	CurrentPeriodEnd   time.Time          `json:"current_period_end"`
	TrialEnd           *time.Time         `json:"trial_end,omitempty"`
	PausedAt           *time.Time         `json:"paused_at,omitempty"`
	CancelledAt        *time.Time         `json:"cancelled_at,omitempty"`
	CancelAtPeriodEnd  bool               `json:"cancel_at_period_end"`
	DunningAttempt     int                `json:"dunning_attempt"`
	NextRetryAt        *time.Time         `json:"next_retry_at,omitempty"`
	IdempotencyKey     *string            `json:"idempotency_key,omitempty"`
	Metadata           json.RawMessage    `json:"metadata,omitempty"`
	CreatedAt          time.Time          `json:"created_at"`
	UpdatedAt          time.Time          `json:"updated_at"`
}

type Invoice struct {
	ID               uuid.UUID       `json:"id"`
	TenantID         uuid.UUID       `json:"tenant_id"`
	SubscriptionID   uuid.UUID       `json:"subscription_id"`
	CustomerID       uuid.UUID       `json:"customer_id"`
	Amount           int64           `json:"amount"`
	Currency         string          `json:"currency"`
	Status           InvoiceStatus   `json:"status"`
	DueDate          time.Time       `json:"due_date"`
	PaidAt           *time.Time      `json:"paid_at,omitempty"`
	NombaChargeRef   *string         `json:"nomba_charge_ref,omitempty"`
	ProrationDetails json.RawMessage `json:"proration_details,omitempty"`
	LineItems        json.RawMessage `json:"line_items"`
	IdempotencyKey   *string         `json:"idempotency_key,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
}

type LedgerEntry struct {
	ID             uuid.UUID       `json:"id"`
	TenantID       uuid.UUID       `json:"tenant_id"`
	SubscriptionID *uuid.UUID      `json:"subscription_id,omitempty"`
	InvoiceID      *uuid.UUID      `json:"invoice_id,omitempty"`
	CustomerID     *uuid.UUID      `json:"customer_id,omitempty"`
	EntryType      LedgerEntryType `json:"entry_type"`
	Direction      LedgerDirection `json:"direction"`
	Amount         int64           `json:"amount"`
	Currency       string          `json:"currency"`
	Description    string          `json:"description"`
	IdempotencyKey string          `json:"idempotency_key"`
	Metadata       json.RawMessage `json:"metadata,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
}

type LedgerSummary struct {
	TotalDebits         int64  `json:"total_debits"`
	TotalCredits        int64  `json:"total_credits"`
	TotalCharged        int64  `json:"total_charged"`
	TotalRefunded       int64  `json:"total_refunded"`
	TotalCreditsApplied int64  `json:"total_credits_applied"`
	NetRevenue          int64  `json:"net_revenue"`
	EntryCount          int64  `json:"entry_count"`
	Currency            string `json:"currency"`
}

type ScheduledJob struct {
	ID          uuid.UUID       `json:"id"`
	TenantID    *uuid.UUID      `json:"tenant_id,omitempty"`
	JobType     JobType         `json:"job_type"`
	Payload     json.RawMessage `json:"payload"`
	Status      string          `json:"status"`
	ScheduledAt time.Time       `json:"scheduled_at"`
	LockedAt    *time.Time      `json:"locked_at,omitempty"`
	LockedBy    *string         `json:"locked_by,omitempty"`
	Attempts    int             `json:"attempts"`
	MaxAttempts int             `json:"max_attempts"`
	LastError   *string         `json:"last_error,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
}

type WebhookEndpoint struct {
	ID         uuid.UUID `json:"id"`
	TenantID   uuid.UUID `json:"tenant_id"`
	URL        string    `json:"url"`
	Events     []string  `json:"events"`
	Secret     string    `json:"-"`
	APIVersion string    `json:"api_version"`
	IsActive   bool      `json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
}

type WebhookDelivery struct {
	ID             uuid.UUID  `json:"id"`
	EndpointID     uuid.UUID  `json:"endpoint_id"`
	TenantID       uuid.UUID  `json:"tenant_id"`
	EventType      string     `json:"event_type"`
	APIVersion     string     `json:"api_version"`
	Payload        json.RawMessage `json:"payload"`
	Status         string     `json:"status"`
	ResponseStatus *int       `json:"response_status,omitempty"`
	ResponseBody   *string    `json:"response_body,omitempty"`
	AttemptCount   int        `json:"attempt_count"`
	NextRetryAt    *time.Time `json:"next_retry_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

// ProrationDetails is stored as JSONB on invoices for mid-cycle plan changes.
type ProrationDetails struct {
	OldPlanID       uuid.UUID `json:"old_plan_id"`
	NewPlanID       uuid.UUID `json:"new_plan_id"`
	DaysRemaining   int       `json:"days_remaining"`
	DaysInPeriod    int       `json:"days_in_period"`
	CreditAmount    int64     `json:"credit_amount"`
	ChargeAmount    int64     `json:"charge_amount"`
	NetAdjustment   int64     `json:"net_adjustment"`
}

// PaymentResult is returned by the NombaClient after a charge attempt.
type PaymentResult struct {
	Success        bool
	Reference      string
	FailureCode    string
	FailureMessage string
}

type MonthlyRevenueRow struct {
	Month    time.Time
	Charged  int64
	Refunded int64
}

type DiscountType string

const (
	DiscountTypePercentage DiscountType = "percentage"
	DiscountTypeFixed      DiscountType = "fixed"
)

// PromoCode is a tenant-defined discount redeemable at checkout.
type PromoCode struct {
	ID            uuid.UUID    `json:"id"`
	TenantID      uuid.UUID    `json:"tenant_id"`
	Code          string       `json:"code"`
	Description   string       `json:"description"`
	DiscountType  DiscountType `json:"discount_type"`
	DiscountValue int64        `json:"discount_value"`
	PlanID        *uuid.UUID   `json:"plan_id,omitempty"`
	MaxUses       *int         `json:"max_uses,omitempty"`
	UseCount      int          `json:"use_count"`
	ExpiresAt     *time.Time   `json:"expires_at,omitempty"`
	IsActive      bool         `json:"is_active"`
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at"`
}

// Session is an active login session, tracked in Redis and keyed by a
// random session ID embedded in both the access and refresh JWTs.
type Session struct {
	ID         string    `json:"id"`
	TenantID   uuid.UUID `json:"tenant_id"`
	IPAddress  string    `json:"ip_address"`
	UserAgent  string    `json:"user_agent"`
	CreatedAt  time.Time `json:"created_at"`
	LastSeenAt time.Time `json:"last_seen_at"`
}

// SubscriptionTransition is an audit-trail row recorded automatically every
// time a subscription's status changes.
type SubscriptionTransition struct {
	ID             uuid.UUID `json:"id"`
	SubscriptionID uuid.UUID `json:"subscription_id"`
	TenantID       uuid.UUID `json:"tenant_id"`
	FromStatus     string    `json:"from_status"`
	ToStatus       string    `json:"to_status"`
	Reason         string    `json:"reason,omitempty"`
	Actor          string    `json:"actor"`
	CreatedAt      time.Time `json:"created_at"`
}

// APIKey is a per-tenant, per-mode credential for the Platform API.
// A tenant holds at most one key per mode (test, live) at a time.
type APIKey struct {
	ID         uuid.UUID  `json:"id"`
	TenantID   uuid.UUID  `json:"tenant_id"`
	Mode       string     `json:"mode"`
	KeyHash    string     `json:"-"`
	KeyHint    string     `json:"key_hint"`
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt *time.Time `json:"last_used_at,omitempty"`
}

type EmailVerification struct {
	ID       uuid.UUID  `json:"id"`
	TenantID uuid.UUID  `json:"tenant_id"`
	Code     string     `json:"-"` // never expose in API responses
	ExpiresAt time.Time `json:"expires_at"`
	UsedAt   *time.Time `json:"used_at,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

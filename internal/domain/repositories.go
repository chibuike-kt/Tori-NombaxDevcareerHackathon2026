package domain

import (
	"context"
	"time"
	"encoding/json"

	"github.com/google/uuid"
)

type TokenRevoker interface {
	Revoke(ctx context.Context, token string, expiresAt time.Time) error
	IsRevoked(ctx context.Context, token string) bool
	RecordLoginFailure(ctx context.Context, email string) (int, error)
	IsLoginLocked(ctx context.Context, email string) bool
	ClearLoginFailures(ctx context.Context, email string)
}

type TenantRepository interface {
	Create(ctx context.Context, name, email, apiKeyHash, webhookSecret string, config DunningConfig) (*Tenant, error)
	SetPassword(ctx context.Context, id uuid.UUID, passwordHash string) error
	GetByID(ctx context.Context, id uuid.UUID) (*Tenant, error)
	GetByEmail(ctx context.Context, email string) (*Tenant, error)
	GetByAPIKeyHash(ctx context.Context, hash string) (*Tenant, error)
	UpdateDunningConfig(ctx context.Context, id uuid.UUID, config DunningConfig) (*Tenant, error)
	Update(ctx context.Context, id uuid.UUID, name, email string) (*Tenant, error)
	Deactivate(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context) ([]*Tenant, error)
	UpdateAPIKeyHash(ctx context.Context, id uuid.UUID, hash string) error
	UpdateAPIKeyHashAndHint(ctx context.Context, id uuid.UUID, hash, hint string) (*Tenant, error)
	MarkEmailVerified(ctx context.Context, id uuid.UUID) (*Tenant, error)
}

type CustomerRepository interface {
	Create(ctx context.Context, tenantID uuid.UUID, externalID *string, email string, name *string, nombaCustomerID *string, metadata []byte) (*Customer, error)
	GetByID(ctx context.Context, id, tenantID uuid.UUID) (*Customer, error)
	GetByEmail(ctx context.Context, tenantID uuid.UUID, email string) (*Customer, error)
	GetByExternalID(ctx context.Context, tenantID uuid.UUID, externalID string) (*Customer, error)
	List(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]*Customer, error)
	Update(ctx context.Context, id, tenantID uuid.UUID, name *string, email string, metadata []byte) (*Customer, error)
	UpdateTokenisedCard(ctx context.Context, id, tenantID uuid.UUID, card []byte, nombaCustomerID *string) (*Customer, error)
	Archive(ctx context.Context, id, tenantID uuid.UUID) error
	GetByIDNoTenant(ctx context.Context, id uuid.UUID) (*Customer, error)
}

type PlanRepository interface {
	Create(ctx context.Context, tenantID uuid.UUID, name string, description *string, amount int64, currency string, interval PlanInterval, intervalCount, trialDays int, metadata []byte) (*Plan, error)
	GetByID(ctx context.Context, id, tenantID uuid.UUID) (*Plan, error)
	List(ctx context.Context, tenantID uuid.UUID) ([]*Plan, error)
	ListAll(ctx context.Context, tenantID uuid.UUID) ([]*Plan, error)
	Update(ctx context.Context, id, tenantID uuid.UUID, name string, description *string, amount int64, trialDays int, metadata []byte) (*Plan, error)
	Deactivate(ctx context.Context, id, tenantID uuid.UUID) error
}

type SubscriptionRepository interface {
	Create(ctx context.Context, tenantID, customerID, planID uuid.UUID, status SubscriptionStatus, periodStart, periodEnd time.Time, trialEnd *time.Time, idempotencyKey *string, metadata []byte) (*Subscription, error)
	GetByID(ctx context.Context, id, tenantID uuid.UUID) (*Subscription, error)
	GetByIDNoTenant(ctx context.Context, id uuid.UUID) (*Subscription, error)
	GetByIdempotencyKey(ctx context.Context, key string, tenantID uuid.UUID) (*Subscription, error)
	List(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]*Subscription, error)
	ListByStatus(ctx context.Context, tenantID uuid.UUID, status SubscriptionStatus, limit, offset int) ([]*Subscription, error)
	ListByCustomer(ctx context.Context, tenantID, customerID uuid.UUID) ([]*Subscription, error)
	UpdateStatus(ctx context.Context, id, tenantID uuid.UUID, status SubscriptionStatus) (*Subscription, error)
	UpdateAfterRenewal(ctx context.Context, id, tenantID uuid.UUID, status SubscriptionStatus, periodStart, periodEnd time.Time) (*Subscription, error)
	UpdateDunning(ctx context.Context, id, tenantID uuid.UUID, status SubscriptionStatus, attempt int, nextRetryAt *time.Time) (*Subscription, error)
	UpdatePlan(ctx context.Context, id, tenantID, planID uuid.UUID) (*Subscription, error)
	Cancel(ctx context.Context, id, tenantID uuid.UUID) (*Subscription, error)
	Pause(ctx context.Context, id, tenantID uuid.UUID) (*Subscription, error)
	Resume(ctx context.Context, id, tenantID uuid.UUID) (*Subscription, error)
	ListActiveDue(ctx context.Context, asOf time.Time, limit int) ([]*Subscription, error)
	ListTrialingDue(ctx context.Context, asOf time.Time, limit int) ([]*Subscription, error)
	ListDueForRetry(ctx context.Context, asOf time.Time, limit int) ([]*Subscription, error)
	UpdateStatusOptimistic(ctx context.Context, id, tenantID uuid.UUID, status SubscriptionStatus, lastUpdatedAt time.Time) (*Subscription, error)
	ListByCustomerNoTenant(ctx context.Context, customerID uuid.UUID) ([]*Subscription, error)
	UpdateTokenKey(ctx context.Context, id, tenantID uuid.UUID, tokenKey string) (*Subscription, error)
	CancelAtPeriodEnd(ctx context.Context, id, tenantID uuid.UUID) (*Subscription, error)
	SetMandate(ctx context.Context, id, tenantID uuid.UUID, mandateID string) (*Subscription, error)
	UpdateRecoveryRail(ctx context.Context, id, tenantID uuid.UUID, rail string) (*Subscription, error)
}

type InvoiceRepository interface {
	Create(ctx context.Context, tenantID, subscriptionID, customerID uuid.UUID, amount int64, currency string, status InvoiceStatus, dueDate time.Time, lineItems []byte, idempotencyKey *string) (*Invoice, error)
	GetByID(ctx context.Context, id, tenantID uuid.UUID) (*Invoice, error)
	GetByIdempotencyKey(ctx context.Context, key string) (*Invoice, error)
	ListBySubscription(ctx context.Context, subscriptionID uuid.UUID) ([]*Invoice, error)
	ListByTenant(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]*Invoice, error)
	ListByStatus(ctx context.Context, tenantID uuid.UUID, status InvoiceStatus, limit, offset int) ([]*Invoice, error)
	MarkPaid(ctx context.Context, id, tenantID uuid.UUID, chargeRef string) (*Invoice, error)
	MarkVoid(ctx context.Context, id, tenantID uuid.UUID) (*Invoice, error)
	MarkUncollectible(ctx context.Context, id, tenantID uuid.UUID) (*Invoice, error)
	UpdateProration(ctx context.Context, id, tenantID uuid.UUID, prorationDetails, lineItems []byte) (*Invoice, error)
}

// LedgerRepository is intentionally read-heavy. Write path is append-only.
// No Update or Delete methods exist — that's the contract.
type LedgerRepository interface {
	Append(ctx context.Context, tenantID uuid.UUID, subscriptionID, invoiceID, customerID *uuid.UUID, entryType LedgerEntryType, direction LedgerDirection, amount int64, currency, description, idempotencyKey string, metadata []byte) (*LedgerEntry, error)
	GetByID(ctx context.Context, id, tenantID uuid.UUID) (*LedgerEntry, error)
	GetByIdempotencyKey(ctx context.Context, key string) (*LedgerEntry, error)
	ListByTenant(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]*LedgerEntry, error)
	ListBySubscription(ctx context.Context, tenantID, subscriptionID uuid.UUID, limit, offset int) ([]*LedgerEntry, error)
	ListByCustomer(ctx context.Context, tenantID, customerID uuid.UUID, limit, offset int) ([]*LedgerEntry, error)
	ListByDateRange(ctx context.Context, tenantID uuid.UUID, from, to time.Time, limit, offset int) ([]*LedgerEntry, error)
	ListByTypeAndDateRange(ctx context.Context, tenantID uuid.UUID, types []string, from, to time.Time, limit, offset int) ([]*LedgerEntry, error)
	GetSummary(ctx context.Context, tenantID uuid.UUID, from, to time.Time) (*LedgerSummary, error)
	GetMRR(ctx context.Context, tenantID uuid.UUID, from, to time.Time) (int64, error)
	GetMonthlyRevenue(ctx context.Context, tenantID uuid.UUID, from, to time.Time) ([]MonthlyRevenueRow, error)
}

type JobRepository interface {
	Enqueue(ctx context.Context, tenantID *uuid.UUID, jobType JobType, payload []byte, scheduledAt time.Time, maxAttempts int) (*ScheduledJob, error)
	ClaimNext(ctx context.Context, workerID string) (*ScheduledJob, error)
	MarkDone(ctx context.Context, id uuid.UUID) error
	MarkFailed(ctx context.Context, id uuid.UUID, lastError string) error
	Requeue(ctx context.Context, id uuid.UUID, scheduledAt time.Time) error
	RecoverStaleLocks(ctx context.Context) error
	GetQueueDepth(ctx context.Context) (int64, error)
	ListFailed(ctx context.Context, limit, offset int) ([]*ScheduledJob, error)
	Retry(ctx context.Context, id uuid.UUID) error
	CancelPendingJobsForSubscription(ctx context.Context, subscriptionID string) error
}

type WebhookRepository interface {
	CreateEndpoint(ctx context.Context, tenantID uuid.UUID, url string, events []string, secret, apiVersion string) (*WebhookEndpoint, error)
	GetEndpointByID(ctx context.Context, id, tenantID uuid.UUID) (*WebhookEndpoint, error)
	ListEndpoints(ctx context.Context, tenantID uuid.UUID) ([]*WebhookEndpoint, error)
	UpdateEndpoint(ctx context.Context, id, tenantID uuid.UUID, url string, events []string, isActive bool) (*WebhookEndpoint, error)
	DeleteEndpoint(ctx context.Context, id, tenantID uuid.UUID) error
	CreateDelivery(ctx context.Context, endpointID, tenantID uuid.UUID, eventType, apiVersion string, payload []byte, status string) (*WebhookDelivery, error)
	GetDeliveryByID(ctx context.Context, id, tenantID uuid.UUID) (*WebhookDelivery, error)
	ListDeliveries(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]*WebhookDelivery, error)
	MarkDeliverySuccess(ctx context.Context, id uuid.UUID, responseStatus int, responseBody string) error
	MarkDeliveryFailed(ctx context.Context, id uuid.UUID, responseStatus int, responseBody string, nextRetryAt time.Time) error
	ListFailedDeliveriesDue(ctx context.Context, limit int) ([]*WebhookDelivery, error)
	ListDeliveriesByEventTypeAndDateRange(ctx context.Context, tenantID uuid.UUID, eventTypes []string, from, to time.Time) ([]*WebhookDelivery, error)
	DisableWebhookEndpoint(ctx context.Context, id uuid.UUID) error
CountRecentFailedDeliveries(ctx context.Context, endpointID uuid.UUID) (int64, error)
}

type EmailVerificationRepository interface {
	Create(ctx context.Context, tenantID uuid.UUID, code string, expiresAt time.Time) (*EmailVerification, error)
	GetByCode(ctx context.Context, code string) (*EmailVerification, error)
	MarkUsed(ctx context.Context, id uuid.UUID) error
	DeleteByTenant(ctx context.Context, tenantID uuid.UUID) error
}

type MemberRepository interface {
	Create(ctx context.Context, tenantID uuid.UUID, email, name string, role MemberRole, status MemberStatus, passwordHash *string) (*Member, error)
	GetByID(ctx context.Context, id, tenantID uuid.UUID) (*Member, error)
	GetByEmail(ctx context.Context, tenantID uuid.UUID, email string) (*Member, error)
	List(ctx context.Context, tenantID uuid.UUID) ([]*Member, error)
	UpdateRole(ctx context.Context, id, tenantID uuid.UUID, role MemberRole) (*Member, error)
	UpdateStatus(ctx context.Context, id, tenantID uuid.UUID, status MemberStatus) (*Member, error)
	Delete(ctx context.Context, id, tenantID uuid.UUID) error
}

type InvitationRepository interface {
	Create(ctx context.Context, tenantID uuid.UUID, email string, role MemberRole, token string, invitedBy *uuid.UUID, expiresAt time.Time) (*Invitation, error)
	GetByToken(ctx context.Context, token string) (*Invitation, error)
	List(ctx context.Context, tenantID uuid.UUID) ([]*Invitation, error)
	Accept(ctx context.Context, token string) (*Invitation, error)
	Delete(ctx context.Context, id, tenantID uuid.UUID) error
}

type AuditRepository interface {
	Create(ctx context.Context, tenantID uuid.UUID, actorID *uuid.UUID, actorEmail, action, target, ip string, metadata json.RawMessage) (*AuditEntry, error)
	List(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]*AuditEntry, error)
}

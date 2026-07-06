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

// SessionRepository tracks active login sessions per tenant in Redis so they
// can be listed and individually revoked from the dashboard.
type SessionRepository interface {
	Create(ctx context.Context, tenantID uuid.UUID, sessionID, ipAddress, userAgent string, ttl time.Duration) error
	Touch(ctx context.Context, tenantID uuid.UUID, sessionID string) error
	IsActive(ctx context.Context, tenantID uuid.UUID, sessionID string) bool
	List(ctx context.Context, tenantID uuid.UUID) ([]*Session, error)
	RevokeSession(ctx context.Context, tenantID uuid.UUID, sessionID string) error
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
	Create(ctx context.Context, tenantID uuid.UUID, externalID *string, email string, name *string, nombaCustomerID *string, metadata []byte, mode string) (*Customer, error)
	GetByID(ctx context.Context, id, tenantID uuid.UUID) (*Customer, error)
	GetByEmail(ctx context.Context, tenantID uuid.UUID, email string) (*Customer, error)
	GetByExternalID(ctx context.Context, tenantID uuid.UUID, externalID string) (*Customer, error)
	List(ctx context.Context, tenantID uuid.UUID, mode string, limit, offset int) ([]*Customer, error)
	Update(ctx context.Context, id, tenantID uuid.UUID, name *string, email string, metadata []byte) (*Customer, error)
	UpdateTokenisedCard(ctx context.Context, id, tenantID uuid.UUID, card []byte, nombaCustomerID *string) (*Customer, error)
	UpdateNombaAccountID(ctx context.Context, id, tenantID uuid.UUID, nombaAccountID string) (*Customer, error)
	Archive(ctx context.Context, id, tenantID uuid.UUID) error
	GetByIDNoTenant(ctx context.Context, id uuid.UUID) (*Customer, error)
}

type PlanRepository interface {
	Create(ctx context.Context, tenantID uuid.UUID, name string, description *string, amount int64, currency string, interval PlanInterval, intervalCount, trialDays int, metadata []byte, mode string) (*Plan, error)
	GetByID(ctx context.Context, id, tenantID uuid.UUID) (*Plan, error)
	List(ctx context.Context, tenantID uuid.UUID, mode string) ([]*Plan, error)
	ListAll(ctx context.Context, tenantID uuid.UUID, mode string) ([]*Plan, error)
	Update(ctx context.Context, id, tenantID uuid.UUID, name string, description *string, amount int64, trialDays int, metadata []byte) (*Plan, error)
	Deactivate(ctx context.Context, id, tenantID uuid.UUID) error
}

type SubscriptionRepository interface {
	Create(ctx context.Context, tenantID, customerID, planID uuid.UUID, status SubscriptionStatus, periodStart, periodEnd time.Time, trialEnd *time.Time, idempotencyKey *string, metadata []byte, discountKobo int64, mode string) (*Subscription, error)
	GetByID(ctx context.Context, id, tenantID uuid.UUID) (*Subscription, error)
	GetByIDNoTenant(ctx context.Context, id uuid.UUID) (*Subscription, error)
	GetByIdempotencyKey(ctx context.Context, key string, tenantID uuid.UUID) (*Subscription, error)
	List(ctx context.Context, tenantID uuid.UUID, mode string, limit, offset int) ([]*Subscription, error)
	ListByStatus(ctx context.Context, tenantID uuid.UUID, status SubscriptionStatus, mode string, limit, offset int) ([]*Subscription, error)
	ListByCustomer(ctx context.Context, tenantID, customerID uuid.UUID, mode string) ([]*Subscription, error)
	UpdateStatus(ctx context.Context, id, tenantID uuid.UUID, status SubscriptionStatus) (*Subscription, error)
	UpdateAfterRenewal(ctx context.Context, id, tenantID uuid.UUID, status SubscriptionStatus, periodStart, periodEnd time.Time) (*Subscription, error)
	// ResumeForward fast-forwards a lapsed subscription to the current billing
	// period instead of back-billing every skipped cycle, recording a custom
	// transition reason (e.g. noting how many cycles were skipped).
	ResumeForward(ctx context.Context, id, tenantID uuid.UUID, status SubscriptionStatus, periodStart, periodEnd time.Time, reason string) (*Subscription, error)
	// ResumeForwardOptimistic is ResumeForward with an optimistic-concurrency
	// check against the subscription's last-known updated_at.
	ResumeForwardOptimistic(ctx context.Context, id, tenantID uuid.UUID, status SubscriptionStatus, periodStart, periodEnd time.Time, reason string, lastUpdatedAt time.Time) (*Subscription, error)
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
	ListTransitions(ctx context.Context, id, tenantID uuid.UUID, limit, offset int) ([]*SubscriptionTransition, error)
}

type InvoiceRepository interface {
	Create(ctx context.Context, tenantID, subscriptionID, customerID uuid.UUID, amount int64, currency string, status InvoiceStatus, dueDate time.Time, lineItems []byte, idempotencyKey *string, mode string) (*Invoice, error)
	GetByID(ctx context.Context, id, tenantID uuid.UUID) (*Invoice, error)
	GetByIdempotencyKey(ctx context.Context, key string) (*Invoice, error)
	ListBySubscription(ctx context.Context, subscriptionID uuid.UUID) ([]*Invoice, error)
	ListByTenant(ctx context.Context, tenantID uuid.UUID, mode string, limit, offset int) ([]*Invoice, error)
	ListByStatus(ctx context.Context, tenantID uuid.UUID, status InvoiceStatus, mode string, limit, offset int) ([]*Invoice, error)
	MarkPaid(ctx context.Context, id, tenantID uuid.UUID, chargeRef string) (*Invoice, error)
	MarkVoid(ctx context.Context, id, tenantID uuid.UUID) (*Invoice, error)
	MarkUncollectible(ctx context.Context, id, tenantID uuid.UUID) (*Invoice, error)
	UpdateProration(ctx context.Context, id, tenantID uuid.UUID, prorationDetails, lineItems []byte) (*Invoice, error)
}

// LedgerRepository is intentionally read-heavy. Write path is append-only.
// No Update or Delete methods exist — that's the contract.
type LedgerRepository interface {
	Append(ctx context.Context, tenantID uuid.UUID, subscriptionID, invoiceID, customerID *uuid.UUID, entryType LedgerEntryType, direction LedgerDirection, amount int64, currency, description, idempotencyKey string, metadata []byte, mode string) (*LedgerEntry, error)
	GetByID(ctx context.Context, id, tenantID uuid.UUID) (*LedgerEntry, error)
	GetByIdempotencyKey(ctx context.Context, key string) (*LedgerEntry, error)
	ListByTenant(ctx context.Context, tenantID uuid.UUID, mode string, limit, offset int) ([]*LedgerEntry, error)
	ListBySubscription(ctx context.Context, tenantID, subscriptionID uuid.UUID, mode string, limit, offset int) ([]*LedgerEntry, error)
	ListByCustomer(ctx context.Context, tenantID, customerID uuid.UUID, mode string, limit, offset int) ([]*LedgerEntry, error)
	ListByDateRange(ctx context.Context, tenantID uuid.UUID, from, to time.Time, mode string, limit, offset int) ([]*LedgerEntry, error)
	ListByTypeAndDateRange(ctx context.Context, tenantID uuid.UUID, types []string, from, to time.Time, mode string, limit, offset int) ([]*LedgerEntry, error)
	GetSummary(ctx context.Context, tenantID uuid.UUID, from, to time.Time, mode string) (*LedgerSummary, error)
	GetBalanceSettlement(ctx context.Context, tenantID uuid.UUID, todayMidnight time.Time, mode string) (availableKobo, pendingKobo int64, err error)
	GetMRR(ctx context.Context, tenantID uuid.UUID, from, to time.Time, mode string) (int64, error)
	GetMonthlyRevenue(ctx context.Context, tenantID uuid.UUID, from, to time.Time, mode string) ([]MonthlyRevenueRow, error)
}

type JobRepository interface {
	Enqueue(ctx context.Context, tenantID *uuid.UUID, jobType JobType, payload []byte, scheduledAt time.Time, maxAttempts int, mode string) (*ScheduledJob, error)
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
	CreateEndpoint(ctx context.Context, tenantID uuid.UUID, url string, events []string, secret, apiVersion, mode string) (*WebhookEndpoint, error)
	GetEndpointByID(ctx context.Context, id, tenantID uuid.UUID) (*WebhookEndpoint, error)
	ListEndpoints(ctx context.Context, tenantID uuid.UUID, mode string) ([]*WebhookEndpoint, error)
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

type APIKeyRepository interface {
	Upsert(ctx context.Context, tenantID uuid.UUID, mode, keyHash, keyHint string) (*APIKey, error)
	GetByHash(ctx context.Context, keyHash string) (*APIKey, error)
	GetByTenantAndMode(ctx context.Context, tenantID uuid.UUID, mode string) (*APIKey, error)
	ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*APIKey, error)
	TouchLastUsed(ctx context.Context, id uuid.UUID) error
	Delete(ctx context.Context, tenantID uuid.UUID, mode string) error
}

type EmailTemplateRepository interface {
	Get(ctx context.Context, tenantID uuid.UUID, eventType string) (*EmailTemplate, error)
	List(ctx context.Context, tenantID uuid.UUID) ([]*EmailTemplate, error)
	Upsert(ctx context.Context, tenantID uuid.UUID, eventType, subject, htmlBody string, isEnabled, useDefault bool) (*EmailTemplate, error)
}

type PromoCodeRepository interface {
	Create(ctx context.Context, tenantID uuid.UUID, code, description string, discountType DiscountType, discountValue int64, planID *uuid.UUID, maxUses *int, expiresAt *time.Time, mode string) (*PromoCode, error)
	GetByCode(ctx context.Context, tenantID uuid.UUID, code string) (*PromoCode, error)
	GetByID(ctx context.Context, id, tenantID uuid.UUID) (*PromoCode, error)
	List(ctx context.Context, tenantID uuid.UUID, mode string) ([]*PromoCode, error)
	IncrementUseCount(ctx context.Context, id uuid.UUID) error
	Deactivate(ctx context.Context, id, tenantID uuid.UUID) (*PromoCode, error)
	Delete(ctx context.Context, id, tenantID uuid.UUID) error
}

type MemberRepository interface {
	Create(ctx context.Context, tenantID uuid.UUID, email, name string, role MemberRole, status MemberStatus, passwordHash *string) (*Member, error)
	GetByID(ctx context.Context, id, tenantID uuid.UUID) (*Member, error)
	GetByEmail(ctx context.Context, tenantID uuid.UUID, email string) (*Member, error)
	GetByEmailAcrossTenants(ctx context.Context, email string) (*Member, error)
	List(ctx context.Context, tenantID uuid.UUID) ([]*Member, error)
	UpdateRole(ctx context.Context, id, tenantID uuid.UUID, role MemberRole) (*Member, error)
	UpdateStatus(ctx context.Context, id, tenantID uuid.UUID, status MemberStatus) (*Member, error)
	UpdateLastLogin(ctx context.Context, id uuid.UUID) error
	Delete(ctx context.Context, id, tenantID uuid.UUID) error
}

type InvitationRepository interface {
	Create(ctx context.Context, tenantID uuid.UUID, email string, role MemberRole, token string, invitedBy *uuid.UUID, expiresAt time.Time) (*Invitation, error)
	GetByToken(ctx context.Context, token string) (*Invitation, error)
	List(ctx context.Context, tenantID uuid.UUID) ([]*Invitation, error)
	Accept(ctx context.Context, token string) (*Invitation, error)
	Delete(ctx context.Context, id, tenantID uuid.UUID) error
}

// OAuthRepository backs the OAuth 2.0 client credentials flow for the
// Platform API. Clients are managed from the dashboard (JWT auth); tokens
// are minted by the public token endpoint and validated by PlatformAuth.
type OAuthRepository interface {
	CreateClient(ctx context.Context, tenantID uuid.UUID, clientID, secretHash, secretHint, name, mode string) (*OAuthClient, error)
	GetClientByClientID(ctx context.Context, clientID string) (*OAuthClient, error)
	ListClients(ctx context.Context, tenantID uuid.UUID) ([]*OAuthClient, error)
	RevokeClient(ctx context.Context, id, tenantID uuid.UUID) (*OAuthClient, error)
	TouchClientLastUsed(ctx context.Context, id uuid.UUID) error
	CreateToken(ctx context.Context, tenantID uuid.UUID, clientID, tokenHash, mode string, expiresAt time.Time) (*OAuthToken, error)
	GetTokenByHash(ctx context.Context, tokenHash string) (*OAuthToken, error)
	DeleteExpiredTokens(ctx context.Context) error
	RevokeToken(ctx context.Context, tokenHash string) error
}

type AuditRepository interface {
	Create(ctx context.Context, tenantID uuid.UUID, actorID *uuid.UUID, actorEmail, action, target, ip string, metadata json.RawMessage) (*AuditEntry, error)
	List(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]*AuditEntry, error)
}

# Tori — Architecture & Security Note

> Recurring billing infrastructure built natively on Nomba's payment primitives.
> Nomba × DevCareer Hackathon 2026 — Kingsley Chibueze (@chibuike_kt)

---

## 1. Problem statement

Nomba exposes world-class payment primitives: hosted checkout, tokenised cards, and a charge API. What Nomba does not ship is the orchestration layer that sits on top of those primitives — the system that decides when to charge, what to do when a charge fails, how to record what happened, and how to surface that information to the business.

Every Nigerian SaaS product, edtech platform, and creator tool that charges customers monthly has had to build this layer from scratch. The result is duplicated engineering effort across the ecosystem, inconsistent dunning behaviour, revenue lost to card failures that a smarter system would have recovered, and customers churned because no self-service portal existed.

Tori is that layer. Built once. Available to every business on Nomba.

---

## 2. High-level architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Product team's app                         │
│              (Laravel, Node.js, any stack)                    │
└─────────────────────┬────────────────────────────────────────┘
                      │ HTTPS + X-API-Key
                      ▼
┌──────────────────────────────────────────────────────────────┐
│                    Tori Platform API                           │
│               /v1/platform/* endpoints                        │
│      Checkout · Plans · Customers · Subscriptions             │
└──────────┬─────────────────────────────┬─────────────────────┘
           │                             │
     State machine               Webhook dispatcher
     Dunning engine              HMAC-SHA256 signed
     Ledger service              Async job queue
     Email service (Resend)      Circuit breaker
           │                             │
           ▼                             ▼
┌────────────────────────────┐  ┌───────────────────────────┐
│       PostgreSQL 17         │  │  Product team's webhook    │
│  11 tables, SKIP LOCKED     │  │  endpoint (any URL)        │
│  Append-only ledger         │  └───────────────────────────┘
│  Idempotent job queue       │
└────────────────────────────┘
┌────────────────────────────┐  ┌───────────────────────────┐
│         Redis 7             │  │         Resend             │
│  Token revocation           │  │  Verification emails       │
│  Brute force counters       │  │  Welcome emails            │
│  Webhook dedup              │  └───────────────────────────┘
│  Job queue locks            │
└────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│                          Nomba                                │
│  /checkout/order · /checkout/tokenized-card-payment           │
│  /checkout/refund · /auth/token/issue                         │
└──────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│                     Customer's bank                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Service inventory

| Service | Technology | Responsibility |
|---------|-----------|----------------|
| `cmd/api` | Go 1.26, Chi v5 | REST API — Dashboard and Platform surfaces |
| `cmd/worker` | Go 1.26, 5-goroutine pool | Background billing — trial expiry, dunning, reconciliation, async webhooks |
| PostgreSQL 17 | Railway managed | Primary data store — all tenant, subscription, ledger, and job data |
| Redis 7 | Railway managed | Token revocation, brute force counters, webhook dedup |
| Resend | External API | Transactional email — verification codes, welcome emails |
| Frontend | Next.js 16.2, Tailwind CSS | Operator dashboard, OTP verification flow, customer portal |

All services are deployed on Railway. Internal communication uses Railway's private network. Only the API and frontend are publicly exposed over HTTPS.

---

## 4. Database schema

Eleven tables, all carrying `tenant_id` for row-level multi-tenant isolation.

```sql
tenants             one row per business — name, email, api_key_hash,
                    webhook_secret, dunning_config, email_verified, verified_at
plans               billing plans — amount in kobo, interval, trial_period_days
customers           subscribers — email, external_id (product's own user ID)
subscriptions       the billing relationship — customer + plan + status + token_key
ledger_entries      append-only financial event log — immutable
scheduled_jobs      PostgreSQL-backed job queue — SKIP LOCKED
webhook_endpoints   registered delivery targets per tenant (max 5)
webhook_deliveries  delivery attempt log — payload, response, status, attempt count
invoices            invoice records with Nomba transactionId reference
reconciliation_runs nightly reconciliation summaries
email_verifications 6-digit OTP codes with expiry and used_at tracking
```

### Key design decisions

**Amounts in kobo** — all monetary values are stored as `BIGINT` in kobo. No floating point arithmetic anywhere in the billing path. ₦15,000 is stored as `1500000`. This eliminates an entire class of rounding errors.

**Invoice before ledger** — invoices are always created before ledger entries so the `invoice_id` FK constraint is always satisfied. This ordering is enforced in every code path that writes both. The pattern: create invoice (open) → write ledger CHARGE entry using invoice.ID → mark invoice paid with Nomba transactionId.

**Idempotency keys** — `ledger_entries` has a unique constraint on `idempotency_key`. Every charge, refund, and proration generates a deterministic key from the subscription ID and billing period. Duplicate writes fail silently. Retried job handlers never double-charge a customer.

**Optimistic locking** — `subscriptions` carries an `updated_at` column with a trigger. State transition handlers use `UPDATE ... WHERE id = $1 AND updated_at = $2`. Two workers racing to transition the same subscription — exactly one wins.

**Immutable ledger** — `ledger_entries` has no `UPDATE` or `DELETE` path in the application layer. Every financial event appends one row. MRR, ARR, churn rate, dunning recovery, and net revenue are computed directly from ledger aggregations — not from subscription state.

**Email verification** — `email_verifications` stores 6-digit codes with a 15-minute expiry and a `used_at` timestamp. Old codes are deleted before new ones are created, preventing code accumulation. The `used_at` field means codes can never be reused even if they have not expired. Existing tenants are auto-verified on migration via `UPDATE tenants SET email_verified = true WHERE email_verified = false`.

---

## 5. API surfaces

### 5.1 Dashboard API (`/v1/*`)

JWT-authenticated. Used by human operators through the Tori dashboard.

Auth: register (with email verification), login (returns `email_verified` flag), refresh, logout with Redis token revocation, verify-email (validates 6-digit code, marks tenant verified, sends welcome email), resend-verification (generates new code, deletes old ones, 60-second cooldown enforced on frontend).

Plans: create, list, update, deactivate.

Customers: create, list, get, update, archive, generate portal token.

Subscriptions: create via checkout, list, get, cancel, pause, resume, change plan with proration, regenerate checkout URL, issue refund.

Ledger: list entries, get summary, monthly revenue breakdown.

Finance: MRR, ARR, churn rate, dunning recovery, revenue forecast.

Billing health: portfolio score, per-subscription health score, churn prediction.

Webhooks: register endpoint (max 5), list, update, delete, delivery log, manual retry.

API keys: create, get hint, rotate.

Observability: GET /v1/metrics (subscription counts by state, MRR, charge success rate, queue depth, failed jobs).

### 5.2 Platform API (`/v1/platform/*`)

API key authenticated via `X-API-Key` header. Server-to-server integration.

`POST /v1/platform/checkout` — the primary integration point. One call with email and plan ID. Finds or creates the customer. Starts the subscription as `PENDING_PAYMENT`. Idempotent via `idempotency_key`. Returns a Nomba checkout URL.

`POST /v1/platform/subscriptions/{id}/checkout` — regenerates checkout URL for expired sessions.

`POST /v1/platform/subscriptions/{id}/refund` — issues a refund via Nomba and records REFUND CREDIT in the ledger.

`GET /v1/platform/customers/{id}/portal-token` — generates a scoped portal JWT.

### 5.3 Customer Portal (`/v1/portal/*`)

Portal JWT scoped to a single customer. Generated by the Platform API and passed to the customer's browser. Allows customers to view subscriptions, pause, resume, and cancel — without contacting support.

---

## 6. Billing state machine

### States

```
PENDING_PAYMENT  subscription created, awaiting Nomba payment_success webhook
TRIALING         free trial, ₦50 verification charge auto-refunded, card tokenised
ACTIVE           billing normally, charges succeed
GRACE_PERIOD     first renewal failed, 48-hour silent retry — no customer disruption
PAST_DUE         grace retry failed, or trial ended with no card, or checkout abandoned
DUNNING          actively retrying on payday-aligned schedule
PAUSED           customer-requested pause, no charges
SUSPENDED        dunning exhausted, access revoked
CANCELLED        terminal — no further transitions
```

### Full transition map

```
PENDING_PAYMENT  checkout_payment_succeeded   ACTIVE
PENDING_PAYMENT  checkout_payment_failed      PAST_DUE
PENDING_PAYMENT  checkout_abandoned           PAST_DUE
PENDING_PAYMENT  customer_cancelled           CANCELLED

TRIALING         trial_payment_succeeded      ACTIVE
TRIALING         trial_payment_failed         PAST_DUE
TRIALING         trial_cancelled              CANCELLED

ACTIVE           renewal_failed               GRACE_PERIOD
ACTIVE           customer_paused              PAUSED
ACTIVE           customer_cancelled           CANCELLED
ACTIVE           tenant_cancelled             CANCELLED

GRACE_PERIOD     grace_retry_succeeded        ACTIVE
GRACE_PERIOD     grace_retry_failed           PAST_DUE
GRACE_PERIOD     grace_expired                PAST_DUE
GRACE_PERIOD     customer_cancelled           CANCELLED

PAST_DUE         retry_succeeded              ACTIVE
PAST_DUE         retry_failed_retriable       DUNNING
PAST_DUE         retry_failed_non_retriable   SUSPENDED

DUNNING          retry_succeeded              ACTIVE
DUNNING          retry_failed_retriable       DUNNING
DUNNING          retries_exhausted            SUSPENDED

PAUSED           customer_resumed             ACTIVE
PAUSED           customer_cancelled           CANCELLED

SUSPENDED        manual_recovery              ACTIVE
SUSPENDED        customer_cancelled           CANCELLED

CANCELLED        (terminal)
```

### Implementation

The state machine is a pure function with zero side effects:

```go
func Transition(current SubscriptionStatus, event Event) (SubscriptionStatus, error)
```

No database calls, no business logic, no HTTP calls. Fully unit-tested with cases covering every valid transition, every invalid transition, terminal state behaviour, error context population, dunning loop correctness, and the full PENDING_PAYMENT flow.

### PENDING_PAYMENT — the correct checkout flow

Subscriptions always start as PENDING_PAYMENT for no-trial plans. The subscription only moves to ACTIVE after Nomba fires payment_success and Tori processes it, creating the invoice and ledger entry. If payment fails, the subscription moves to PAST_DUE. If the customer abandons checkout for 24 hours, the abandoned checkout worker moves it to PAST_DUE. This design ensures a customer never has access to a product they have not paid for.

### GRACE_PERIOD — the Nigerian-first differentiator

When an ACTIVE subscription's renewal charge fails, Tori enters a 48-hour silent retry window before dunning. No webhook fires to the developer. No email to the customer. No disruption to service. This handles the most common Nigerian failure mode: a card with temporary insufficient funds that clears within 48 hours — salary arrived, bank transfer cleared, card was temporarily blocked and unblocked.

---

## 7. Nomba integration depth

### OAuth2 token management

```go
// Token cached in memory, auto-refreshed 5 minutes before expiry
// Zero unnecessary auth calls — one token shared across all requests
c.token = &nombaToken{
    AccessToken: data.AccessToken,
    ExpiresAt:   time.Now().Add(time.Duration(data.ExpiresIn)*time.Second - 5*time.Minute),
}
```

### Checkout with tokenizeCard

```go
payload := map[string]interface{}{
    "order": map[string]interface{}{
        "amount":         "50.00",           // ₦50 for trial verification
        "currency":       "NGN",
        "orderReference": subscriptionID,    // UUID — matched in payment_success webhook
        "customerEmail":  customer.Email,
        "accountId":      subAccountID,
    },
    "tokenizeCard": true,
}
```

For no-trial plans, the full plan amount is charged. For trial plans, ₦50 is charged and immediately refunded after tokenisation.

### payment_success webhook processing

```
Webhook arrives at POST /v1/nomba/webhook
  1. HMAC-SHA256 signature verified with exact field ordering
  2. requestId deduplicated via Redis (24-hour TTL)
  3. orderReference parsed as subscription UUID
  4. tokenKey stored on subscription record

  if PENDING_PAYMENT:
    → UpdateStatus to ACTIVE
    → Create invoice (open) with idempotency key
    → RecordCharge ledger entry using real invoice.ID
    → MarkPaid with Nomba transactionId (stored for refunds)
    → DispatchAsync subscription.activated + payment.succeeded

  if TRIALING and transactionAmount ≤ ₦60:
    → POST /v1/checkout/refund with Nomba transactionId
    → ₦50 returned to customer card immediately

  if PENDING_PAYMENT and payment_failed:
    → UpdateStatus to PAST_DUE
```

### Refund API

```go
// POST /v1/checkout/refund
payload := map[string]interface{}{
    "transactionId": invoice.NombaChargeRef, // WEB-ONLINE_C-... from MarkPaid
    "amount": float64(req.Amount) / 100,     // Naira not kobo
}
// Success field returned as bool or string — both handled via interface{}
```

### Tokenised card recurring charge

```go
// POST /v1/checkout/tokenized-card-payment
// Called by ExpireTrial, RetryFailedPayment, GraceRetry
result, err := c.ChargeToken(ctx, ChargeTokenRequest{
    TokenisedCard:  sub.TokenKey,
    Amount:         plan.Amount,
    Reference:      fmt.Sprintf("retry-%s-%d", subID, attempt),
    IdempotencyKey: fmt.Sprintf("trial-charge-%s", subID),
})
```

### Nightly reconciliation

```
Fetch /transactions/accounts/{subAccountId} with pagination
  Loop safety: max 20 pages, same-cursor detection
  for each Nomba transaction:
    merchantTxRef → ledger_entries.idempotency_key
    matched           → amounts agree, all good
    missing_in_ledger → Nomba charged but no ledger entry
    amount_mismatch   → both exist but kobo amounts differ
Write reconciliation_runs row with full summary
```

---

## Payment methods — card vs bank transfer

Nomba's hosted checkout lets the customer pay by card or bank transfer. Tori handles both, but they behave differently for recurring billing.

### Card payment (tokenised)

When a customer pays by card, Nomba returns a `tokenKey` in the `payment_success` webhook. Tori stores this token on the subscription. Every future renewal and every dunning retry charges this token automatically with no customer interaction. This is the primary path and the one recurring billing is designed around.

### Bank transfer

When a customer pays by bank transfer, there is no card to tokenise, so the `payment_success` webhook arrives with no `tokenKey`. Tori still activates the subscription and records the invoice and ledger entry — the customer paid, so they get access. This is important: a transfer-paying customer is never left stuck in PENDING_PAYMENT.

However, because there is no stored token, Tori cannot silently charge the customer when the subscription renews. At the next billing cycle the tokenised charge has nothing to charge against, so the renewal fails and the subscription enters the normal dunning flow. The `dunning.started` webhook fires to the developer's server, which is the signal to prompt the customer to pay again — either by generating a fresh checkout link via `POST /v1/platform/subscriptions/{id}/checkout` or by asking them to add a card.

### Design rationale

This is deliberate. Forcing card-only payment would exclude the large segment of Nigerian customers who prefer bank transfer. Allowing transfer payment but being honest that it cannot auto-renew is better than silently failing or refusing the payment. The dunning flow already exists to handle "we could not charge this customer" — a transfer-paid renewal is just another instance of that, and the developer is notified through the same webhook they already handle.

For products that require guaranteed auto-renewal, the recommendation is to enable only card payments on the checkout by passing `allowedPaymentMethods: ["Card"]` when creating the checkout, so every subscriber has a tokenised card from the start.

## 8. Dunning engine

### Nigerian failure classification

**Permanently non-retriable** — stop immediately, no further attempts:
- `card_blocked` — issued blocked for online transactions, extremely common with Nigerian bank cards
- `card_expired` — card is past its expiry date
- `do_not_honour` — issuer permanent decline
- `stolen_card`, `lost_card` — fraud indicators, immediate stop

**Retriable** — schedule retry after appropriate delay:
- `insufficient_funds` — most common Nigerian failure, clears after salary day
- `issuer_unavailable` — Nigerian bank system outage, temporary
- `processing_error` — transient network issue
- `timeout` — infrastructure timeout, not card-level failure

Classification is loaded from `config/failure_codes.yaml` at startup. Configurable per deployment without code changes.

### Payday-aligned retry schedule

```
Day 0   renewal charge fails → GRACE_PERIOD
Day 2   grace retry (silent — no customer notification)
Day 3   dunning attempt 1 (post-weekend, many Nigerian salaries arrive Friday)
Day 7   dunning attempt 2 (end of first week)
Day 14  dunning attempt 3 (mid-month, second salary window)
Day 21  dunning attempt 4 (final attempt) → SUSPENDED if fails
```

This schedule is deliberately aligned with Nigerian salary disbursement patterns — it does not follow generic exponential backoff.

---

## 9. Authentication

### JWT (Dashboard API)

```
Algorithm  : HS256
Payload    : { tenant_id, exp, iat }
Access TTL : 15 minutes
Refresh TTL: 7 days
Startup    : API binary refuses to start if JWT_SECRET < 32 characters
```

Token revocation — on logout, the access token is immediately added to a Redis denylist keyed by `SHA256(token)`. Every authenticated request checks the denylist. Entries expire automatically when the token's natural TTL expires, keeping Redis memory bounded.

The frontend maintains a queue of in-flight requests. On a 401 response, one refresh attempt is made. All queued requests are either retried with the new token or rejected if the refresh token is also expired.

### API keys (Platform API)

```
Format  : tori_live_<32 random bytes as hex>
Storage : SHA-256(key) stored — full key never persisted after creation
Hint    : first 12 + last 4 characters for dashboard display
Header  : X-API-Key: tori_live_...
```

### Brute force protection

```
Threshold : 5 failed login attempts
Lockout   : 15 minutes
Storage   : Redis counter keyed by email address
Reset     : on successful login
```

### Password hashing

```
Algorithm  : Argon2id
Parameters : time=1, memory=64MB, threads=4, keyLen=32
Salt       : 16 cryptographically random bytes, unique per password
```

Legacy accounts with static salts are detected on login by checking the hash prefix and automatically re-hashed with a unique random salt on successful authentication.

---

## 10. Email verification

New tenants receive a 6-digit verification code via Resend immediately after registration. The code must be validated before the tenant is considered fully onboarded.

### Code generation

```go
// crypto/rand — not math/rand
const digits = "0123456789"
code := make([]byte, 6)
for i := range code {
    n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(digits))))
    code[i] = digits[n.Int64()]
}
```

### Flow

```
POST /v1/auth/register
  → generate 6-digit crypto/rand code
  → store in email_verifications with 15-minute expiry
  → send via Resend API
  → return access_token + email_verified: false

POST /v1/auth/verify-email { code: "123456" }
  → validate code belongs to this tenant
  → check used_at is null (not already used)
  → check expires_at > now()
  → mark code used_at = NOW()
  → UPDATE tenants SET email_verified = true, verified_at = NOW()
  → send welcome email via Resend
  → return email_verified: true

POST /v1/auth/resend-verification
  → check tenant is not already verified
  → DELETE existing unused codes for this tenant
  → generate new code
  → send new email
  → 60-second cooldown enforced on frontend
```

### Email templates

Both the verification and welcome emails are hand-coded HTML — styled to match Tori's brand (dark header, green accent, monospace OTP display). No third-party email template library.

### Existing tenants

Migration `000009_email_verifications.up.sql` includes:
```sql
UPDATE tenants SET email_verified = true, verified_at = NOW()
WHERE email_verified = false;
```

This ensures existing tenants are not disrupted by the new verification requirement.

---

## 11. Webhooks (outbound)

### Delivery pipeline

```
billing event fires
  → DispatchAsync enqueues webhook_deliver job (non-blocking)
  → worker picks up job via SKIP LOCKED
  → Dispatch fetches active endpoints for tenant
  → for each subscribed endpoint:
      sign payload with HMAC-SHA256
      POST with X-Tori-Signature, X-Tori-Event, X-Tori-API-Version
      record delivery attempt in webhook_deliveries
      on failure: schedule retry, check circuit breaker
```

Async delivery means the request path is never blocked by the developer's endpoint latency. If the job cannot be enqueued, delivery falls back to synchronous — no event is ever lost.

### Retry schedule

```
Attempt 1: immediate
Attempt 2: 5 minutes after failure
Attempt 3: 30 minutes after failure
Attempt 4: 2 hours after failure
Attempt 5: 6 hours after failure
```

### Circuit breaker

After 10 consecutive failures within 24 hours, the endpoint is automatically disabled. This prevents Tori from hammering a dead server. The tenant can re-enable from the dashboard.

### Signing

```go
signature = "sha256=" + hex(HMAC-SHA256(endpoint_secret, raw_body))
// Timing-safe comparison on verification:
hmac.Equal([]byte(expected), []byte(received))
```

### Supported events

```
subscription.created      subscription.activated    subscription.paused
subscription.resumed      subscription.cancelled    subscription.suspended
payment.succeeded         payment.failed
dunning.started           dunning.recovered         dunning.exhausted
```

### Consumer verification (Node.js)

```javascript
const crypto = require('crypto');
function verifyWebhook(rawBody, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}
```

---

## 12. Job queue

### Design

```sql
SELECT * FROM scheduled_jobs
WHERE status = 'pending'
  AND scheduled_at <= NOW()
ORDER BY scheduled_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED
```

`SKIP LOCKED` ensures concurrent goroutines each claim a different job without blocking each other. This gives exactly-once processing semantics without Redis or an external queue.

### Worker pool

```go
func (w *Worker) RunPool(ctx context.Context, n int) {
    for i := 1; i <= n; i++ {
        clone := &Worker{
            jobs:     w.jobs,
            handlers: w.handlers, // shared — handlers are stateless
            interval: w.interval,
            id:       fmt.Sprintf("%s-%d", w.id, i),
        }
        go clone.Run(ctx)
    }
}
// cmd/worker/main.go
worker.RunPool(runCtx, 5) // 5 concurrent goroutines
```

At 1,000 subscribers with monthly billing, 80+ jobs could fire on the same day. 5 goroutines process them in parallel rather than sequentially. Stale lock recovery runs every 5 minutes on worker-1 only to avoid duplicate recovery runs.

### Job types

| Job | When fired | What it does |
|-----|-----------|-------------|
| `expire_trial` | At trial_end timestamp | Charges tokenKey for full plan amount, activates subscription |
| `retry_failed_payment` | Payday-aligned schedule | Retries charge on Day 3, 7, 14, 21 |
| `grace_retry` | 48 hours after first failure | Silent retry before dunning begins |
| `suspend_subscription` | After dunning exhaustion | Moves subscription to SUSPENDED |
| `checkout_abandoned` | Worker startup (daily) | Finds PENDING_PAYMENT/TRIALING subs >24hr with no tokenKey, moves to PAST_DUE |
| `webhook_deliver` | On every billing event | Async webhook delivery to developer endpoint |
| `reconciliation` | Worker startup (nightly) | Fetches Nomba transactions, matches against ledger |

### Dead letter

When a job exhausts all attempts, it is marked `failed` and the worker logs at ERROR with full payload:

```
DEAD LETTER: job exhausted all retry attempts — manual intervention required
  job_id=... job_type=... attempts=5 payload={...}
```

---

## 13. Observability

### Request logger

Every HTTP request is logged with method, path, status code, latency in milliseconds, response bytes, request ID, and client IP. 4xx responses logged at WARN, 5xx at ERROR.

```
7:17PM INF request method=POST path=/v1/auth/login status=200 latency_ms=12ms bytes=312 request_id=abc-123 ip=172.18.0.1
```

### Health endpoint (unauthenticated)

`GET /v1/status` — no credentials required. Judges and monitoring tools can verify liveness without authentication.

```json
{
  "status": "ok",
  "service": "tori-api",
  "version": "1.0.0",
  "checks": { "api": "ok", "database": "ok", "nomba": "connected" },
  "database": {
    "total_conns": 3,
    "acquired_conns": 0,
    "idle_conns": 3,
    "max_conns": 20
  },
  "worker": { "queue_depth": 1 },
  "runtime": {
    "goroutines": 6,
    "heap_alloc_mb": 1.25,
    "num_gc": 0
  }
}
```

### Metrics endpoint (authenticated)

`GET /v1/metrics` — JWT required. Returns operational intelligence for the authenticated tenant.

```json
{
  "subscriptions": {
    "total": 4,
    "active": 4,
    "trialing": 0,
    "pending_payment": 0,
    "dunning": 0,
    "by_status": { "ACTIVE": 4 }
  },
  "revenue": {
    "mrr_kobo": 1750000,
    "mrr_naira": 17500,
    "gross_this_month": 1750000,
    "net_this_month": 1750000
  },
  "billing": {
    "charge_success_rate_pct": 100,
    "at_risk_count": 0
  },
  "worker": {
    "queue_depth": 1,
    "failed_jobs_count": 0
  }
}
```

---

## 14. Security

### Transport

- HTTPS enforced at Railway TLS termination
- HSTS: `max-age=63072000; includeSubDomains; preload` on every API response
- CORS locked to specific origins — no wildcard `Access-Control-Allow-Origin: *`
- Security headers on every API response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`
- Next.js CSP, HSTS, Permissions-Policy headers on every frontend response
- Fontshare and jsDelivr allowed in CSP for fonts and icons

### Data

- Multi-tenant isolation — `tenant_id` on every table, every query, tenant always from auth context never from request body
- Monetary values in kobo as `BIGINT` — no floating point
- Append-only ledger — no `UPDATE` or `DELETE` on `ledger_entries`
- Idempotency keys — unique constraint prevents double-writes on retry
- Optimistic locking on state transitions
- Card data never touches Tori — only `tokenKey` string stored
- PII masking — customer emails masked in all log output (`am***@greenfield.ng`)
- Max 5 webhook endpoints per tenant — prevents resource exhaustion
- 1MB request body limit — prevents OOM attacks

### Encryption

In transit: TLS 1.2+ at Railway's termination layer. Internal traffic (API to PostgreSQL, API to Redis) uses Railway's private network with TLS.

At rest: Railway managed PostgreSQL and Redis use AES-256 encryption at rest. Application-level field encryption is not currently applied — card data is never stored, and PII is limited to email addresses.

### Data retention

| Data type | Retention |
|-----------|-----------|
| Ledger entries | Indefinite — immutable financial record |
| Webhook delivery logs | 90 days |
| Reconciliation runs | 90 days |
| Email verification codes | Deleted after use or superseded by resend |
| Tenant and customer data | Until account deletion |

### Summary table

| Concern | Implementation |
|---------|---------------|
| Password storage | Argon2id, unique random 16-byte salt |
| JWT | HS256, 15min access, 7-day refresh, Redis revocation |
| API key storage | SHA-256 hash only, full key shown once |
| Brute force | Redis counter, 5 attempts, 15-minute lockout |
| Email verification | 6-digit code via Resend, crypto/rand, 15-min expiry, single-use |
| Outbound webhook signing | HMAC-SHA256, X-Tori-Signature, timing-safe comparison |
| Inbound webhook verification | Nomba HMAC-SHA256, exact field ordering, base64 encoding |
| Webhook dedup | Redis requestId, 24-hour TTL |
| Webhook endpoint limit | Max 5 per tenant |
| Multi-tenant isolation | tenant_id on every table and every query |
| State transition safety | Optimistic locking via updated_at |
| Duplicate charges | Idempotency keys, unique DB constraint |
| Request size | 1MB limit on all routes |
| Rate limiting | 100/min per IP global, 300/min JWT, 600/min API key |
| CORS | Named origin allowlist, no wildcard |
| Security headers | HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection |
| PII in logs | Email masking in all log statements |
| Card data | Never stored — tokenKey only |
| Encryption at rest | Railway AES-256 on PostgreSQL and Redis |

---

## 15. Billing intelligence

### Health scoring (0 to 100 per subscription)

```
Base:                   100
GRACE_PERIOD state:     -10
PAST_DUE state:         -20
DUNNING state:          -40
SUSPENDED state:        -60
Each dunning attempt:   -10 (capped at -40)
Subscription < 30 days: -5
Previous recovery:      -10

70-100 : Healthy
50-69  : At risk
0-49   : Critical
```

### Churn prediction

Five signal levels: `none`, `low`, `medium`, `high`, `critical`. Computed from current state, dunning attempt count, days until period end, and payment history depth. Each high or critical signal includes human-readable reasons and a recommended operator action.

### Revenue forecasting

```
Low  = active_mrr × (1 - churn_rate) × (1 - failure_rate)
Mid  = active_mrr × (1 - churn_rate) × (1 - failure_rate × (1 - recovery_rate))
High = active_mrr × (1 - churn_rate)
```

Confidence level computed from active subscription count and ledger history depth.

---

## 16. Rate limiting

| Scope | Limit |
|-------|-------|
| Per-IP (global, all routes) | 100 requests/minute |
| Per-tenant (JWT-authenticated) | 300 requests/minute |
| Per-tenant (API key-authenticated) | 600 requests/minute |

Platform API clients get double the rate limit because server-to-server traffic is more predictable and higher volume than dashboard usage.

Request body size limit: 1MB on all routes — prevents memory exhaustion from oversized payloads.

---

## 17. Infrastructure

### Railway deployment

```
api      → go build -o bin/api ./cmd/api     → ./bin/api
worker   → go build -o bin/worker ./cmd/worker → ./bin/worker
frontend → next build (Dockerfile, Node 24)  → node server.js
postgres → Railway managed PostgreSQL 17
redis    → Railway managed Redis 7
```

Every push to `main` triggers auto-redeploy of all three application services via Railway's GitHub integration. Internal services communicate via Railway's private network (`*.railway.internal`).

### Connection pool tuning

```go
config.MaxConns = 20
config.MinConns = 2
config.MaxConnLifetime = 30 * time.Minute
config.MaxConnIdleTime = 5 * time.Minute
config.HealthCheckPeriod = 1 * time.Minute
config.ConnConfig.ConnectTimeout = 5 * time.Second
```

At 5 concurrent worker goroutines plus API server requests, the pool is sized to handle concurrent billing cycles without exhaustion.

### Migrations

Sequential migration files in `db/migrations/`, numbered `000001` through `000009`. Applied via psql. Each has a corresponding `.down.sql` for rollback. Railway deployment applies migrations before starting the new binary.

Migration `000009` adds `email_verified`, `verified_at` to `tenants`, creates the `email_verifications` table, and auto-verifies existing tenants.

---

## 18. ClassPay demo integration

`classpay/` is a separate Next.js application demonstrating a complete real-world Tori integration from the perspective of a developer who has just integrated Tori for recurring billing.

The entire billing code ClassPay wrote is approximately 60 lines in `classpay/lib/tori.ts`. Everything else — charging, retrying, dunning, reconciliation, invoicing, webhooks — is handled by Tori.

```
School signs up on ClassPay pricing page
  → ClassPay calls POST /v1/platform/checkout (60 lines of integration code)
  → Tori creates Nomba checkout session, subscription starts PENDING_PAYMENT
  → School enters card on Nomba hosted page
  → Nomba fires payment_success webhook to Tori
  → Tori activates subscription, creates invoice + ledger entry
  → Tori fires subscription.activated webhook to ClassPay
  → ClassPay grants school full access
  → Next month, Tori charges automatically — ClassPay does nothing
```

---

## 19. Test credentials

| Field | Value |
|-------|-------|
| Dashboard | https://frontend-production-e3be.up.railway.app |
| API base URL | https://api-production-3847.up.railway.app |
| Email | dev@tori.ng |
| Password | tori-dev-2026 |
| Nomba test card | 5434621074252808 |
| Card expiry | 12/30 |
| Card PIN | 0000 |
| Card OTP (approve) | 000000 |
| Card OTP (timeout) | 1234 |
| Card OTP (invalid) | 5464 |

# Tori — Architecture & Security Note

> Recurring billing infrastructure built natively on Nomba's payment primitives.
> Nomba × DevCareer Hackathon 2026 — Kingsley Chibueze (@chibuike_kt)

---

## 1. Problem statement

Nomba exposes world-class payment primitives: hosted checkout, tokenised cards, and a charge API. What Nomba does not ship is the orchestration layer that sits on top — the system that decides when to charge, what to do when a charge fails, how to record what happened, and how to surface that information to the business.

Every Nigerian SaaS product, edtech platform, and creator tool that charges customers monthly has had to build this layer from scratch. The result is duplicated engineering effort across the ecosystem, inconsistent dunning behaviour, and revenue lost to card failures that a smarter system would have recovered.

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
     Ledger service              Retry + circuit breaker
           │                             │
           ▼                             ▼
┌────────────────────────────┐  ┌───────────────────────────┐
│       PostgreSQL 17         │  │  Product team's webhook    │
│  Subscriptions · Ledger     │  │  endpoint (any URL)        │
│  Plans · Customers · Jobs   │  └───────────────────────────┘
│  Invoices · Webhooks        │
└────────────────────────────┘
┌────────────────────────────┐
│         Redis 7             │
│  Token revocation           │
│  Brute force counters       │
│  Webhook dedup              │
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
| `cmd/worker` | Go 1.26 | Background job processor — billing cycles, dunning, grace retry, reconciliation |
| PostgreSQL 17 | Railway managed | Primary data store — all tenant, subscription, and ledger data |
| Redis 7 | Railway managed | Token revocation denylist, brute force counters, webhook dedup |
| Frontend | Next.js 16.2, Tailwind CSS | Operator dashboard and customer self-service portal |

All five services are deployed on Railway. Internal communication uses Railway's private network. Only the API and frontend are publicly exposed over HTTPS.

---

## 4. Database schema

Ten tables, all carrying `tenant_id` for row-level multi-tenant isolation.

```sql
tenants             one row per business using Tori
plans               billing plans: amount, interval, trial_period_days
customers           subscribers: email, external_id (product's own user ID)
subscriptions       the billing relationship: customer + plan + status
ledger_entries      append-only financial event log
scheduled_jobs      PostgreSQL-backed job queue
webhook_endpoints   registered delivery targets per tenant
webhook_deliveries  delivery attempt log: payload, response, status
invoices            invoice records with Nomba transaction ID reference
reconciliation_runs nightly reconciliation run summaries
```

### Key design decisions

**Amounts in kobo** — all monetary values are stored as `BIGINT` in kobo. No floating point anywhere in the billing path. ₦15,000 = `1500000`. This eliminates an entire class of rounding errors.

**Idempotency keys** — `ledger_entries` has a unique constraint on `idempotency_key`. Every charge, refund, and proration operation generates a deterministic key from the subscription ID and billing period. Duplicate writes fail silently. Retried job handlers never double-charge a customer.

**Invoice before ledger** — invoices are always created before ledger entries so the ledger FK constraint on `invoice_id` is always satisfied. This ordering is enforced in every code path that writes both.

**Optimistic locking** — `subscriptions` carries an `updated_at` column. State transition handlers use `UPDATE ... WHERE id = $1 AND updated_at = $2`. Two workers racing to transition the same subscription — exactly one wins.

**Immutable ledger** — `ledger_entries` has no `UPDATE` or `DELETE` path. Every financial event appends one row. MRR, ARR, churn rate, dunning recovery, and net revenue are computed directly from ledger aggregations.

---

## 5. API surfaces

### 5.1 Dashboard API (`/v1/*`)

JWT-authenticated. Used by human operators through the Tori dashboard.

- Auth: register, login, refresh, logout with Redis token revocation
- Plans: create, list, update, deactivate
- Customers: create, list, get, update, archive, generate portal token
- Subscriptions: create via checkout, list, get, cancel, pause, resume, change plan with proration, regenerate checkout URL, issue refund
- Ledger: list entries, get summary, monthly revenue breakdown
- Finance: MRR, ARR, churn rate, dunning recovery, revenue forecast
- Billing health: portfolio score, per-subscription health score, churn prediction
- Webhooks: register endpoint, list, delete, delivery log, retry delivery
- API keys: create, get hint, rotate

### 5.2 Platform API (`/v1/platform/*`)

API key authenticated via `X-API-Key` header. Server-to-server integration by product teams.

- `POST /v1/platform/checkout` — the primary integration point. One call with email and plan ID. Finds or creates the customer. Starts the subscription as `PENDING_PAYMENT`. Idempotent via `idempotency_key`.
- `GET /v1/platform/customers/{id}/portal-token` — generates a scoped portal JWT
- `POST /v1/platform/subscriptions/{id}/checkout` — regenerates checkout URL for subscriptions with no payment method
- `POST /v1/platform/subscriptions/{id}/refund` — issues a refund via Nomba and records a `REFUND CREDIT` ledger entry

### 5.3 Customer Portal (`/v1/portal/*`)

Portal JWT scoped to a single customer. Generated by the Platform API and passed to the customer's browser by the product team. Allows customers to view subscriptions, pause, resume, and cancel — without contacting support.

---

## 6. Billing state machine

### States

```
PENDING_PAYMENT  subscription created, awaiting payment confirmation from Nomba
TRIALING         within free trial period, card tokenised but not charged
ACTIVE           billing normally, charges succeed
GRACE_PERIOD     first renewal failed, 48-hour silent retry window
PAST_DUE         grace retry failed or no tokenKey at trial end
DUNNING          actively retrying on payday-aligned schedule
PAUSED           customer-requested pause, no charges
SUSPENDED        dunning exhausted, access revoked
CANCELLED        terminal state, no further transitions
```

### Full transition map

```
PENDING_PAYMENT  payment_success    ACTIVE
PENDING_PAYMENT  payment_failed     PAST_DUE
PENDING_PAYMENT  abandoned 24hr     PAST_DUE
PENDING_PAYMENT  cancelled          CANCELLED

TRIALING         trial ends ok      ACTIVE
TRIALING         trial ends fails   GRACE_PERIOD
TRIALING         no tokenKey        PAST_DUE
TRIALING         cancelled          CANCELLED

ACTIVE           renewal_failed     GRACE_PERIOD
ACTIVE           paused             PAUSED
ACTIVE           cancelled          CANCELLED

GRACE_PERIOD     retry_succeeded    ACTIVE
GRACE_PERIOD     retry_failed       PAST_DUE
GRACE_PERIOD     expired            PAST_DUE
GRACE_PERIOD     cancelled          CANCELLED

PAST_DUE         retry_succeeded          ACTIVE
PAST_DUE         retry_failed_retriable   DUNNING
PAST_DUE         retry_failed_permanent   SUSPENDED

DUNNING          retry_succeeded          ACTIVE
DUNNING          retry_failed_retriable   DUNNING
DUNNING          retries_exhausted        SUSPENDED

PAUSED           resumed            ACTIVE
PAUSED           cancelled          CANCELLED

SUSPENDED        manual_recovery    ACTIVE
SUSPENDED        cancelled          CANCELLED

CANCELLED        (terminal)
```

### Implementation

The state machine is a pure function with zero side effects:

```go
func Transition(current SubscriptionStatus, event Event) (SubscriptionStatus, error)
```

It receives the current state and an event, returns the next state or an error. No database calls. No business logic. Fully unit-tested with cases covering every valid and invalid transition including the new `PENDING_PAYMENT` state.

### PENDING_PAYMENT — correct checkout flow

Subscriptions start as `PENDING_PAYMENT` when created for no-trial plans. The subscription only moves to `ACTIVE` after Nomba fires `payment_success` and Tori processes it. If payment fails, the subscription moves to `PAST_DUE`. If the customer abandons checkout for 24 hours, the abandoned checkout worker moves it to `PAST_DUE`. This ensures a customer never has access to a product they have not paid for.

### GRACE_PERIOD — the Nigerian-first differentiator

When an `ACTIVE` subscription's renewal charge fails for the first time, Tori enters a 48-hour silent retry window before dunning. No webhook fires. No customer disruption. This handles the most common Nigerian failure mode: a card with temporary insufficient funds that clears within 48 hours.

---

## 7. Nomba integration depth

### Checkout with tokeniseCard

```go
payload := map[string]interface{}{
    "order": map[string]interface{}{
        "amount":         "50.00",           // ₦50 for trial verification
        "currency":       "NGN",
        "orderReference": subscriptionID,    // used to match webhook to subscription
        "customerEmail":  customer.Email,
        "accountId":      subAccountID,
    },
    "tokenizeCard": true,
}
```

For no-trial plans, the full plan amount is charged at checkout. For trial plans, a ₦50 verification charge is used instead of the full amount — the real charge fires automatically when the trial ends via `ExpireTrial`.

### payment_success webhook processing

```
Webhook arrives at POST /v1/nomba/webhook
  1. HMAC-SHA256 signature verified
  2. requestId deduped via Redis (24-hour TTL)
  3. orderReference parsed as subscription UUID
  4. tokenKey stored on subscription

  if PENDING_PAYMENT:
    → UpdateStatus to ACTIVE
    → Create invoice (open)
    → RecordCharge ledger entry (with invoice.ID)
    → MarkPaid (with Nomba transactionId)

  if TRIALING and amount <= ₦60:
    → POST /v1/checkout/refund (₦50 returned immediately)
```

### Recurring charge

Every renewal uses the stored tokenKey with a deterministic idempotency reference:

```go
ChargeToken(ctx, ChargeTokenRequest{
    TokenisedCard:  sub.TokenKey,
    Amount:         plan.Amount,
    Reference:      fmt.Sprintf("retry-%s-%d", subID, attempt),
    IdempotencyKey: fmt.Sprintf("trial-charge-%s", subID),
})
```

### Refund API

```go
POST /v1/checkout/refund
{
  "transactionId": "WEB-ONLINE_C-69923-...",  // Nomba transaction ID from invoice
  "amount": 5000.00                            // omit for full refund
}
```

Tori stores the Nomba `transactionId` on the invoice via `MarkPaid`. The refund endpoint fetches the invoice to get the correct transaction ID before calling Nomba.

### Nightly reconciliation

```
Nomba /transactions/accounts/{subAccountId}
  paginate all SUCCESS transactions (max 20 pages, same-cursor detection)
  for each transaction:
    match by merchantTxRef → ledger_entries.idempotency_key
    matched          → all good
    missing_in_ledger → flagged
    amount_mismatch  → flagged
  write reconciliation_runs row
```

---

## 8. Dunning engine

### Nigerian failure classification

**Permanently non-retriable** — stop immediately:
- `card_blocked` — issued blocked for online transactions (common with Nigerian banks)
- `card_expired` — past expiry date
- `do_not_honour` — issuer permanent decline
- `stolen_card`, `lost_card` — fraud indicators

**Retriable** — schedule retry:
- `insufficient_funds` — likely clears after salary day
- `issuer_unavailable` — bank system outage, temporary
- `processing_error` — transient network issue
- `timeout` — infrastructure timeout

Classification is loaded from `config/failure_codes.yaml` at startup. Configurable per deployment without code changes.

### Payday-aligned retry schedule

```
Day 0   charge fails → GRACE_PERIOD
Day 2   grace retry (silent)
Day 3   dunning attempt 1 (post-weekend salary window)
Day 7   dunning attempt 2 (end of first week)
Day 14  dunning attempt 3 (mid-month, second salary window)
Day 21  dunning attempt 4 (final attempt) → SUSPENDED if fails
```

---

## 9. Authentication

### JWT (Dashboard API)

```
Algorithm  : HS256
Payload    : { tenant_id, exp, iat }
Access TTL : 15 minutes
Refresh TTL: 7 days
```

Startup validation — the API binary refuses to start if `JWT_SECRET` is shorter than 32 characters.

Token revocation — on logout, the access token is immediately added to a Redis denylist keyed by `SHA256(token)`. Every authenticated request checks the denylist. Entries expire automatically when the token's natural TTL expires.

### API keys (Platform API)

```
Format  : tori_live_<32 random bytes as hex>
Storage : SHA-256(key) stored — full key never persisted
Hint    : first 12 + last 4 characters for dashboard display
Header  : X-API-Key: tori_live_...
```

API keys are shown exactly once at creation. If lost, the tenant rotates it — the old key is invalidated immediately.

### Brute force protection

```
Threshold : 5 failed login attempts
Lockout   : 15 minutes
Storage   : Redis counter keyed by email
Reset     : on successful login
```

### Password hashing

```
Algorithm  : Argon2id
Parameters : time=1, memory=64MB, threads=4, keyLen=32
Salt       : 16 cryptographically random bytes, unique per password
```

---

## 10. Security

### Transport security

- HTTPS enforced at Railway TLS termination
- HSTS: `max-age=63072000; includeSubDomains; preload` on every API response
- CORS locked to specific origins — no wildcard `Access-Control-Allow-Origin: *`
- Security headers on every API response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`
- Next.js CSP, HSTS, Permissions-Policy headers on every frontend response

### Data security

- Multi-tenant isolation — `tenant_id` on every table, every query, tenant from auth context never from request body
- Monetary values in kobo as `BIGINT` — no floating point
- Append-only ledger — no `UPDATE` or `DELETE` on `ledger_entries`
- Idempotency keys — unique constraint prevents double-writes on retry
- Optimistic locking on state transitions
- Card data never touches Tori — only `tokenKey` stored
- PII masking — customer emails masked in all log output (`am***@greenfield.ng`)

### Webhook security

| Direction | Implementation |
|-----------|---------------|
| Outbound (Tori to developer) | HMAC-SHA256, `X-Tori-Signature`, secret stored as hash |
| Inbound (Nomba to Tori) | HMAC-SHA256 with base64 encoding, verified on every event |
| Deduplication | Redis `requestId` dedup, 24-hour TTL |
| Circuit breaker | Endpoint disabled after 10 failures in 24 hours |
| Delivery log | Every attempt logged with payload, status, response |
| Replay | Manual retry from dashboard |
| Timing-safe comparison | `hmac.Equal` — not `bytes.Equal` |

### Encryption

**In transit**: All external traffic uses TLS 1.2+ enforced at Railway's TLS termination layer. Internal service-to-service traffic (API to PostgreSQL, API to Redis) uses Railway's private network with TLS.

**At rest**: Railway managed PostgreSQL and Redis instances use AES-256 encryption at rest by default. Application-level encryption is not currently applied to individual fields.

### Backup and recovery

Railway managed PostgreSQL performs automated daily backups with a 7-day retention window. Point-in-time recovery is available. The immutable ledger design means no financial data can be silently modified — any corruption is detectable by comparing ledger totals against Nomba's reconciliation data.

### Data retention

| Data type | Retention |
|-----------|-----------|
| Ledger entries | Indefinite — immutable financial record |
| Webhook delivery logs | 90 days |
| Reconciliation runs | 90 days |
| Scheduled jobs (done/failed) | 30 days |
| Tenant and customer data | Until account deletion |

### NDPR posture

Tori processes customer email addresses and references Nomba payment tokens. Full card data, BVN, and NIN are never processed or stored. Customer data is isolated per tenant. Tori does not currently provide a formal Data Processing Agreement (DPA) — this is a roadmap item for production launch.

---

## 11. Webhooks (outbound)

### Delivery retry schedule

```
Attempt 1: immediate
Attempt 2: 5 minutes after failure
Attempt 3: 30 minutes after failure
Attempt 4: 2 hours after failure
Attempt 5: 6 hours after failure
```

### Supported events

```
subscription.created      subscription.activated    subscription.paused
subscription.resumed      subscription.cancelled    subscription.suspended
payment.succeeded         payment.failed
dunning.started           dunning.recovered         dunning.exhausted
invoice.generated         invoice.paid
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

PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` — exactly-once processing without an external queue:

```sql
SELECT * FROM scheduled_jobs
WHERE status = 'pending'
  AND scheduled_at <= NOW()
ORDER BY scheduled_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED
```

`SKIP LOCKED` means concurrent workers each grab a different job without blocking each other.

### Job types

| Job | When fired | What it does |
|-----|-----------|-------------|
| `expire_trial` | At trial end | Charges tokenKey for full plan amount, activates subscription |
| `retry_failed_payment` | Dunning schedule | Retries charge on payday-aligned day |
| `grace_retry` | 48 hours after first failure | Silent retry before dunning begins |
| `suspend_subscription` | After dunning exhaustion | Moves subscription to SUSPENDED |
| `checkout_abandoned` | Worker startup (daily) | Finds PENDING_PAYMENT or TRIALING subs with no tokenKey after 24 hours, moves to PAST_DUE |
| `reconciliation` | Worker startup (nightly) | Fetches Nomba transactions, matches against ledger |

Stale lock recovery runs every 5 minutes — resets jobs locked for more than 10 minutes.

---

## 13. Reconciliation

Every 24 hours, the worker fetches all successful Nomba transactions and matches against the ledger by `merchantTxRef`.

### Three outcomes per transaction

| Result | Meaning |
|--------|---------|
| `matched` | Nomba transaction found in ledger, amounts agree |
| `missing_in_ledger` | Nomba has the charge, no Tori ledger entry |
| `amount_mismatch` | Both exist but kobo amounts differ |

### Pagination safety

Tori paginates through Nomba transaction pages with two safety mechanisms:
- Maximum 20 pages per run
- Same-cursor detection — stops if Nomba returns the same cursor twice

### Run summary

Every run writes one row to `reconciliation_runs` with full counts, amounts, and a JSON array of flagged items.

---

## 14. Billing intelligence

### Health scoring (0 to 100)

```
Base:                   100
GRACE_PERIOD state:     -10
PAST_DUE state:         -20
DUNNING state:          -40
SUSPENDED state:        -60
Each dunning attempt:   -10 (capped at -40)
Subscription < 30 days: -5
Previous recovery:      -10
```

### Churn prediction

Five signal levels: `none`, `low`, `medium`, `high`, `critical`. Each signal comes with human-readable reasons and a recommended operator action.

### Revenue forecasting

```
Low  = active_mrr × (1 - churn_rate) × (1 - failure_rate)
Mid  = active_mrr × (1 - churn_rate) × (1 - failure_rate × (1 - recovery_rate))
High = active_mrr × (1 - churn_rate)
```

Confidence level computed from active subscription count and ledger history depth.

---

## 15. Rate limiting

| Scope | Limit |
|-------|-------|
| Per-IP (global) | 100 requests/minute |
| Per-tenant (JWT) | 300 requests/minute |
| Per-tenant (API key) | 600 requests/minute |

Body size limit: 1MB on all routes.

---

## 16. Infrastructure

### Railway deployment

```
api      → go build -o bin/api ./cmd/api     → ./bin/api
worker   → go build -o bin/worker ./cmd/worker → ./bin/worker
frontend → next build (Dockerfile, Node 24)  → node server.js
postgres → Railway managed PostgreSQL 17
redis    → Railway managed Redis 7
```

Every push to `main` triggers auto-redeploy of all three application services.

### Migrations

Migration files in `db/migrations/` numbered `000001` through `000008`. Applied via `psql`. Each has a corresponding `.down.sql` for rollback.

---

## 17. ClassPay demo integration

`classpay/` is a separate Next.js app demonstrating a complete real-world Tori integration. It represents ClassPay — a Nigerian school management SaaS — from the perspective of a developer who has just integrated Tori for recurring billing.

The entire billing code ClassPay wrote is in `classpay/lib/tori.ts` — approximately 60 lines. Everything else (charging, retrying, dunning, reconciliation, invoicing) is handled by Tori.

```
School signs up on ClassPay pricing page
  → ClassPay calls POST /v1/platform/checkout (one API call)
  → Tori creates Nomba checkout session
  → School enters card on Nomba hosted page
  → Nomba fires payment_success to Tori
  → Tori activates subscription, creates invoice and ledger entry
  → Tori fires subscription.activated webhook to ClassPay
  → ClassPay grants school full access
  → Next month, Tori charges automatically — ClassPay does nothing
```

---

## 18. Test credentials

| Field | Value |
|-------|-------|
| Dashboard | https://frontend-production-e3be.up.railway.app |
| API base URL | https://api-production-3847.up.railway.app |
| Email | dev@tori.ng |
| Password | tori-dev-2026 |
| Nomba test card | 5434621074252808 |
| Card PIN | 1234 |
| Card OTP (approve) | 9999 |

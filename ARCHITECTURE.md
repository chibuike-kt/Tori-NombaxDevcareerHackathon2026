# Tori — Architecture & Security Note

> Recurring billing infrastructure built natively on Nomba's payment primitives.
> Nomba × DevCareer Hackathon 2026 — Kingsley Chibueze (@chibuike_kt)

---

## 1. Problem statement

Nomba exposes world-class payment primitives: hosted checkout, tokenised cards, and a charge API. What Nomba does not ship is the orchestration layer that sits on top of those primitives — the system that decides when to charge, what to do when a charge fails, how to record what happened, and how to surface that information to the business.

Every Nigerian SaaS product, edtech platform, and creator tool that charges customers monthly has had to build this layer from scratch. The result is duplicated engineering effort across the ecosystem, inconsistent dunning behaviour, and revenue lost to card failures that a smarter system would have recovered.

Tori is that layer. Built once. Available to every business on Nomba.

---

## 2. High-level architecture
┌─────────────────────────────────────────────────────────────────┐

│                        Product team's app                        │

│              (Laravel, Node.js, any stack)                       │

└──────────────────────┬──────────────────────────────────────────┘

│ HTTPS + X-API-Key

▼

┌─────────────────────────────────────────────────────────────────┐

│                         Tori Platform API                        │

│                    /v1/platform/* endpoints                      │

│         Checkout · Plans · Customers · Subscriptions            │

└──────────────────────┬───────────────────────┬──────────────────┘

│                       │

State machine            Webhook dispatcher

Dunning engine           HMAC-SHA256 signed

Ledger service           Retry + circuit breaker

│                       │

▼                       ▼

┌──────────────────────────────┐   ┌─────────────────────────────┐

│         PostgreSQL 17         │   │   Product team's webhook     │

│   Subscriptions · Ledger      │   │   endpoint (any URL)         │

│   Plans · Customers · Jobs    │   └─────────────────────────────┘

└──────────────────────────────┘

┌──────────────────────────────┐

│           Redis 7             │

│  Token revocation · Brute     │

│  force counters · Job locks   │

└──────────────────────────────┘

│

▼

┌─────────────────────────────────────────────────────────────────┐

│                           Nomba                                  │

│         Checkout API · Tokenised cards · Charge API             │

└──────────────────────────────────────────────────────────────────┘

│

▼

┌─────────────────────────────────────────────────────────────────┐

│                      Customer's bank                             │

│                   Where the naira goes                           │

└─────────────────────────────────────────────────────────────────┘

---

## 3. Service inventory

| Service | Technology | Responsibility |
|---------|-----------|----------------|
| `cmd/api` | Go 1.26, Chi v5 | REST API — Dashboard and Platform surfaces |
| `cmd/worker` | Go 1.26 | Background job processor — billing cycles, dunning, grace retry |
| PostgreSQL 17 | Railway managed | Primary data store — all tenant, subscription, and ledger data |
| Redis 7 | Railway managed | Token revocation denylist, brute force counters, job queue locks |
| Frontend | Next.js 16.2, Tailwind CSS | Operator dashboard and customer self-service portal |

All five services are deployed on Railway. Internal communication between the API, worker, PostgreSQL, and Redis uses Railway's private network (`*.railway.internal`). Only the API and frontend are publicly exposed over HTTPS.

---

## 4. Database schema

Nine tables, all carrying `tenant_id` for row-level multi-tenant isolation.

```sql
tenants           -- one row per business using Tori
plans             -- billing plans: amount, interval, trial_period_days
customers         -- subscribers: email, external_id (product's own user ID)
subscriptions     -- the billing relationship: customer + plan + status
ledger_entries    -- append-only financial event log
scheduled_jobs    -- PostgreSQL-backed job queue
webhook_endpoints -- registered delivery targets per tenant
webhook_deliveries-- delivery attempt log: payload, response, status
invoices          -- invoice records (populated post Nomba integration)
```

### Key design decisions

**Amounts in kobo** — all monetary values are stored as `BIGINT` in the smallest currency unit (kobo). No floating point arithmetic anywhere in the billing path. ₦15,000 is stored as `1500000`. This eliminates an entire class of rounding errors.

**Idempotency keys** — `ledger_entries` has a unique constraint on `idempotency_key`. Every charge, refund, and proration operation generates a deterministic key from the subscription ID and billing period. Duplicate writes fail silently. This means retried job handlers never double-charge a customer.

**Optimistic locking** — `subscriptions` carries an `updated_at` column with a trigger that updates it on every write. State transition handlers use `UPDATE ... WHERE id = $1 AND updated_at = $2` to detect concurrent modifications. If two workers race to transition the same subscription, exactly one wins and the other returns `ErrConflict` and backs off.

**Immutable ledger** — `ledger_entries` has no `UPDATE` or `DELETE` path in the application layer. Every financial event appends one row. The table is the source of truth for all revenue metrics. MRR, ARR, churn rate, dunning recovery, and net revenue are computed directly from ledger aggregations, not from subscription state.

---

## 5. API surfaces

### 5.1 Dashboard API (`/v1/*`)

Authenticated with short-lived JWT tokens. Used by human operators through the Tori dashboard. Covers:

- Auth: register, login, refresh, logout with token revocation
- Plans: create, list, update, deactivate
- Customers: create, list, get, update, archive, generate portal token
- Subscriptions: create via checkout, list, get, cancel, pause, resume, change plan with proration
- Ledger: list entries, get summary, get monthly revenue breakdown
- Finance: MRR, ARR, churn rate, dunning recovery, revenue forecast
- Billing health: portfolio score, per-subscription health score, churn prediction
- Webhooks: register endpoint, list, delete, view delivery log, retry delivery
- API keys: create, get hint, rotate

### 5.2 Platform API (`/v1/platform/*`)

Authenticated with long-lived API keys via `X-API-Key` header. Intended for server-to-server integration by product teams. All dashboard operations are mirrored here plus:

- `POST /v1/platform/checkout` — the primary integration point. One call with email and plan ID. Tori finds or creates the customer and starts the subscription. Idempotent via `idempotency_key`.
- `GET /v1/platform/customers/{id}/portal-token` — generates a scoped portal JWT for customer self-service

### 5.3 Customer Portal (`/v1/portal/*`)

Authenticated with short-lived portal JWT tokens scoped to a single customer. The token is generated by the Platform API and passed to the customer's browser by the product team. Allows customers to:

- View their active subscriptions and plan details
- Pause a subscription
- Resume a paused subscription
- Cancel a subscription

Each action fires the corresponding webhook event so the product team's server can react in real time. Portal tokens expire after one hour.

---

## 6. Billing state machine

### States
TRIALING     -- within free trial period, no charges yet

ACTIVE       -- billing normally, charges succeed

GRACE_PERIOD -- first charge failed, 48-hour silent retry window

PAST_DUE     -- grace retry failed, entering dunning schedule

DUNNING      -- actively retrying on payday-aligned schedule

PAUSED       -- customer-requested pause, no charges

SUSPENDED    -- dunning exhausted, access revoked

CANCELLED    -- terminal state, no further transitions

### Transition map
TRIALING  ──payment_succeeded──► ACTIVE

TRIALING  ──payment_failed────► PAST_DUE

TRIALING  ──cancelled──────────► CANCELLED
ACTIVE    ──renewal_failed────► GRACE_PERIOD  ← Nigerian-first: 48hr grace before dunning

ACTIVE    ──paused────────────► PAUSED

ACTIVE    ──cancelled──────────► CANCELLED
GRACE_PERIOD ──retry_succeeded──► ACTIVE

GRACE_PERIOD ──retry_failed────► PAST_DUE

GRACE_PERIOD ──expired──────────► PAST_DUE

GRACE_PERIOD ──cancelled────────► CANCELLED
PAST_DUE  ──retry_succeeded──► ACTIVE

PAST_DUE  ──retry_failed_retriable──► DUNNING

PAST_DUE  ──retry_failed_permanent──► SUSPENDED
DUNNING   ──retry_succeeded──► ACTIVE

DUNNING   ──retry_failed────► DUNNING (next attempt scheduled)

DUNNING   ──exhausted────────► SUSPENDED
PAUSED    ──resumed──────────► ACTIVE

PAUSED    ──cancelled────────► CANCELLED
SUSPENDED ──manual_recovery──► ACTIVE

SUSPENDED ──cancelled────────► CANCELLED
CANCELLED ── (terminal, no outbound transitions)

### Implementation

The state machine is a pure function with zero side effects:

```go
func Transition(current SubscriptionStatus, event Event) (SubscriptionStatus, error)
```

It receives the current state and an event, returns the next state or an error. No database calls. No business logic. Fully unit tested with 28 test cases covering every valid and invalid transition.

The caller is responsible for:
1. Calling `Transition()` to get the next state
2. Persisting the new state with optimistic locking
3. Enqueueing any follow-up jobs
4. Firing webhook events

---

## 7. Dunning engine

### Nigerian failure classification

Card failures in Nigeria fall into two categories with different handling:

**Permanently non-retriable** — stop immediately, no further attempts:
- `card_blocked` — card issued blocked for online transactions (common with Nigerian banks)
- `card_expired` — card is past expiry date
- `do_not_honour` — issuer permanent decline
- `invalid_account` — account does not exist
- `stolen_card`, `lost_card` — fraud indicators

**Retriable** — schedule retry after appropriate delay:
- `insufficient_funds` — likely clears after salary day
- `issuer_unavailable` — bank system outage, temporary
- `processing_error` — transient network issue
- `timeout` — infrastructure timeout, not card-level failure

Classification is loaded from `config/failure_codes.yaml` at startup. This makes it configurable per deployment without code changes.

### Grace period (48 hours)

When a renewal charge fails for the first time on an ACTIVE subscription:

1. Subscription moves to GRACE_PERIOD (not PAST_DUE)
2. A `grace_retry` job is scheduled 48 hours later
3. No webhook fires yet — no customer-facing disruption
4. If the grace retry succeeds, subscription moves back to ACTIVE silently
5. If the grace retry fails, subscription moves to PAST_DUE and full dunning begins

This handles the most common Nigerian failure mode: a card with temporary insufficient funds that clears within 48 hours without any intervention.

### Payday-aligned retry schedule
Day 0   — charge attempt fails, GRACE_PERIOD entered

Day 2   — grace retry attempt

Day 2+  — if grace fails, PAST_DUE, dunning begins

Day 3   — dunning attempt 1 (post-weekend, many salaries arrive Friday)

Day 7   — dunning attempt 2 (end of first week)

Day 14  — dunning attempt 3 (mid-month, second salary window)

Day 21  — dunning attempt 4 (final attempt before exhaustion)

Day 21+ — SUSPENDED if all four attempts failed

### Per-tenant configuration

```go
type DunningConfig struct {
    MaxAttempts        int   `json:"max_attempts"`
    RetryIntervalsDays []int `json:"retry_intervals_days"`
}
```

Each tenant can configure their own max attempts and retry schedule. The default is 4 attempts at Day 3, 7, 14, 21. A termly education platform might configure Day 7, 14, 21, 28 to align with term payment cycles.

---

## 8. Authentication

### 8.1 JWT (Dashboard API)
Algorithm  : HS256

Payload    : { tenant_id, exp, iat }

Access TTL : 15 minutes

Refresh TTL: 7 days

**Startup validation** — the API binary refuses to start if `JWT_SECRET` is shorter than 32 characters. This prevents accidental deployment with weak or empty secrets.

**Token revocation** — on logout, the access token is immediately added to a Redis denylist keyed by `SHA256(token)`. Every authenticated request checks the denylist before proceeding. The denylist entry expires automatically when the token's natural TTL expires, keeping Redis memory bounded.

**Refresh flow** — the frontend maintains a queue of in-flight requests. On a 401 response, one refresh attempt is made. All queued requests are either retried with the new token or rejected with errors if the refresh token is also expired.

### 8.2 API keys (Platform API)
Format   : tori_live_<32 random bytes as hex>

Storage  : SHA-256(key) stored in database — full key never persisted

Hint     : first 12 + last 4 characters stored for dashboard display

Header   : X-API-Key: tori_live_...

API keys are shown exactly once at creation. Tori stores only the hash. If the key is lost, the tenant rotates it — the old key is invalidated immediately and a new one is generated.

### 8.3 Brute force protection
Threshold : 5 failed login attempts

Lockout   : 15 minutes

Storage   : Redis counter keyed by email address

Reset     : on successful login

The counter increments on every failed login. On the first failure, a 15-minute TTL is set. If the counter reaches 5, the account is locked and subsequent attempts return `429 Too Many Requests` until the TTL expires.

### 8.4 Password hashing
Algorithm  : Argon2id

Parameters : time=1, memory=64MB, threads=4, keyLen=32

Salt       : 16 cryptographically random bytes, unique per password

Legacy accounts created before the Argon2id migration used a static salt. These are detected on login by checking the hash prefix and automatically re-hashed with a unique random salt on successful authentication.

---

## 9. Webhooks

### 9.1 Outbound webhook delivery

**Signing**

Every delivery computes:
signature = "sha256=" + hex(HMAC-SHA256(signing_secret, raw_request_body))

The signature is sent in the `X-Tori-Signature` header. The signing secret is stored only as a SHA-256 hash in the database — Tori cannot reveal it after creation. If a tenant loses the secret, they delete the endpoint and create a new one.

**Consumer verification (Node.js example)**:
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

**Retry schedule**
Attempt 1: immediate

Attempt 2: 5 minutes after failure

Attempt 3: 30 minutes after failure

Attempt 4: 2 hours after failure

Attempt 5: 6 hours after failure

**Circuit breaker** — after 10 consecutive failures within 24 hours, the endpoint is automatically disabled. This prevents Tori from hammering a dead server. The tenant can re-enable it from the dashboard once their server is restored.

**Delivery log** — every attempt is recorded: event type, payload, HTTP response status, attempt count, and timestamp. Replayable from the dashboard for debugging.

### 9.2 Supported events
subscription.created     subscription.activated    subscription.paused

subscription.resumed     subscription.cancelled    subscription.suspended

payment.succeeded        payment.failed

dunning.started          dunning.recovered         dunning.exhausted

### 9.3 Inbound webhook (Nomba → Tori)

`POST /v1/nomba/webhook` — receives charge confirmation and card tokenisation result from Nomba. Verified via Nomba's HMAC signature. Pending Nomba API credential provisioning (credentials expected June 23, 2026).

---

## 10. Billing intelligence

### Health scoring

Every active subscription receives a real-time health score from 0 to 100:
Base score: 100
Deductions:

GRACE_PERIOD state    : -10

PAST_DUE state        : -20

DUNNING state         : -40

SUSPENDED state       : -60

Each dunning attempt  : -10 additional (capped at -40)

Subscription < 30 days: -5 (new, limited payment history)

Previous recovery     : -10 (history of failure)
Score bands:

70-100 : Healthy (green)

50-69  : At risk (amber)

0-49   : Critical (red)

### Churn prediction

Five signal levels: `none`, `low`, `medium`, `high`, `critical`.

Signal is computed from:
- Current subscription state
- Number of dunning attempts
- Days until period end (proximity pressure)
- Payment history depth

Each high or critical signal comes with a human-readable reason list and a recommended action for the operator.

### Revenue forecasting

Next month's expected revenue is projected as three estimates:
Low  = active_mrr × (1 - churn_rate) × (1 - failure_rate)

Mid  = active_mrr × (1 - churn_rate) × (1 - failure_rate × (1 - recovery_rate))

High = active_mrr × (1 - churn_rate)

Confidence level is computed from the number of active subscriptions and the amount of historical ledger data available.

---

## 11. Job queue

### Design

The job queue uses PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED`. This gives exactly-once processing semantics without Redis or an external queue:

```sql
SELECT * FROM scheduled_jobs
WHERE status = 'pending'
  AND run_at <= NOW()
ORDER BY run_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED
```

`SKIP LOCKED` means concurrent workers each grab a different job and never block each other. A job locked by one worker is invisible to all others until the lock is released.

### Job types
expire_trial          -- move TRIALING → ACTIVE at trial end

retry_failed_payment  -- dunning retry attempt

grace_retry           -- 48-hour grace period retry

suspend_subscription  -- move DUNNING → SUSPENDED after exhaustion

### Stale lock recovery

If a worker crashes mid-job, the lock is released when the database connection drops. A recovery process runs every 5 minutes and resets jobs that have been locked for more than 10 minutes without a status update.

### Job cancellation

When a subscription is cancelled or manually recovered, all pending jobs for that subscription are cancelled in the same transaction. This prevents a retry job from firing on a subscription that has already been resolved.

---

## 12. Reconciliation

A nightly reconciliation job runs automatically for every tenant when the worker starts.

### What it does

Fetches all successful transactions from Nomba's `/transactions/accounts/{subAccountId}` for the previous 24 hours and matches each one against `ledger_entries` by `merchantTxRef` — which Tori sets to the idempotency key on every charge call.

### Three outcomes per transaction

| Result | Meaning |
|--------|---------|
| `matched` | Nomba transaction found in ledger, amounts agree |
| `missing_in_ledger` | Nomba has the charge but Tori has no ledger entry |
| `amount_mismatch` | Both exist but kobo amounts differ |

### Run summary

Every run writes one row to `reconciliation_runs`:
nomba_tx_count    -- transactions fetched from Nomba

matched_count     -- perfectly matched

missing_count     -- missing from ledger

mismatch_count    -- amount disagreements

total_nomba_kobo  -- total value Nomba processed

total_ledger_kobo -- total value Tori recorded

discrepancies     -- JSON array of flagged items

status            -- ok | discrepancies_found

### Pagination

Tori paginates through all Nomba transaction pages using the cursor field until `HasMore` is false. No transactions are missed regardless of volume.


## 13. Rate limiting

### Per-IP global limiting

Applied to all routes before authentication. Prevents enumeration and DDoS at the network edge.

### Per-tenant authenticated limiting
JWT-authenticated routes  : 300 requests per minute per tenant

API key-authenticated routes : 600 requests per minute per tenant

Platform API clients get double the rate limit because server-to-server traffic is more predictable and higher volume than dashboard usage.

### Body size limit

All request bodies are limited to 1MB. This prevents memory exhaustion from oversized payloads.

---

## 14. Security summary

| Concern | Implementation |
|---------|---------------|
| Password storage | Argon2id, unique random salt per password |
| API key storage | SHA-256 hash only, full key shown once |
| Webhook signing | HMAC-SHA256, secret stored as hash |
| Token revocation | Redis denylist on logout, SHA-256 keyed |
| Brute force | Redis counter, 5 attempts, 15-minute lockout |
| JWT secret | Minimum 32 characters enforced at startup |
| Multi-tenant isolation | tenant_id on every table, every query |
| Concurrent state transitions | Optimistic locking via updated_at |
| Duplicate financial events | Idempotency keys on ledger entries |
| Request size | 1MB body limit on all routes |
| Rate limiting | Per-IP global + per-tenant authenticated |
| CORS | Configured for frontend origin |
| Card data | Never stored — Nomba handles tokenisation |
| Nomba webhook secret | `NOMBA_WEBHOOK_SECRET` env var — HMAC-SHA256 verification enforced on every inbound event |

---

## 15. Infrastructure

### Railway deployment
api      → go build -o bin/api ./cmd/api     → ./bin/api

worker   → go build -o bin/worker ./cmd/worker → ./bin/worker

frontend → next build (Dockerfile, Node 24)  → node server.js

postgres → Railway managed PostgreSQL 17

redis    → Railway managed Redis 7

All services connect to PostgreSQL and Redis via Railway's private network. Public endpoints:
API      : https://api-production-3847.up.railway.app

Frontend : https://frontend-production-e3be.up.railway.app

### Auto-deploy

Every push to the `main` branch triggers an automatic redeploy of all three application services via Railway's GitHub integration.

### Migrations

Database migrations are applied manually via the `db/migrations/` directory using `psql`. Migration files are numbered and sequential. Each migration has a corresponding `.down.sql` for rollback.

---

## 16. Test credentials

| Field | Value |
|-------|-------|
| Dashboard | https://frontend-production-e3be.up.railway.app |
| API base URL | https://api-production-3847.up.railway.app |
| Email | dev@tori.ng |
| Password | tori-dev-2026 |
| Platform API key | Create from Dashboard → API Keys |

**Seeded data**: 20 customers, 5 plans (Basic ₦2,500 to Annual Pro ₦150,000), 20 subscriptions across all 8 states including GRACE_PERIOD and DUNNING, 10 months of backdated ledger history (Sep 2025 to Jun 2026), one webhook endpoint, three goodwill refunds.

---

## 17. Repository structure
cmd/

api/          -- API server entrypoint

worker/       -- Background worker entrypoint

seed/         -- Demo data seed script

internal/

api/

handlers/   -- HTTP handlers (auth, plans, customers, subscriptions,

checkout, portal, ledger, finance, health, webhooks, apikeys)

middleware/ -- Auth, rate limiting, request ID

router.go   -- Route registration, CORS, middleware chain

billing/      -- Job handlers (expire trial, retry payment, grace retry, suspend)

cache/        -- Redis client (token revocation, brute force)

domain/       -- Domain models, repository interfaces, sentinel errors

dunning/      -- Nigerian failure classifier, retry decision engine

ledger/       -- Ledger service (record charge, refund, proration, trial events)

payment/      -- NombaClient interface, mock client, YAML failure classifier

postgres/     -- Repository implementations (sqlc generated + manual)

scheduler/    -- SKIP LOCKED job worker

subscription/ -- State machine (pure Transition function, 28 unit tests)

db/

migrations/   -- SQL migration files

queries/      -- sqlc SQL queries

generated/    -- sqlc generated Go code

frontend/

app/          -- Next.js app router pages

components/   -- Shared UI components

lib/          -- API client, utilities, docs data

config/

failure_codes.yaml -- Nigerian card failure classification

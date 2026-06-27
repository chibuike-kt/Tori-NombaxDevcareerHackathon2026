# Tori | Recurring Billing Infrastructure for Nomba

> The managed subscriptions layer that Nomba does not ship.
> Built for the **Nomba × DevCareer Hackathon 2026** by Kingsley Chibueze ([@chibuike_kt](https://twitter.com/chibuike_kt))

[![Go](https://img.shields.io/badge/Go-1.26-00ADD8?style=flat&logo=go)](https://go.dev)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?style=flat&logo=postgresql)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis)](https://redis.io)
[![Railway](https://img.shields.io/badge/Deployed-Railway-7B2FBE?style=flat)](https://railway.app)

---

## Live demo

| | |
|--|--|
| **Dashboard** | https://frontend-production-e3be.up.railway.app |
| **API base URL** | https://api-production-3847.up.railway.app |
| **Health check** | https://api-production-3847.up.railway.app/v1/status |
| **Email** | dev@tori.ng |
| **Password** | tori-dev-2026 |

---

## What is Tori

Nomba gives you world-class payment primitives: hosted checkout, tokenised cards, direct debit mandates. What Nomba does not give you is the orchestration layer that sits on top the system that decides when to charge, what to do when a charge fails, how to record what happened, and how to surface all of that to the business.

Every Nigerian SaaS product, edtech platform, and creator tool that charges customers monthly has rebuilt this layer from scratch. Tori removes that repeated work permanently.

Tori is **Stripe Billing for Nomba** a fully managed recurring billing engine that any product team can integrate with a single API call.

```
Your product  →  Tori API  →  Nomba  →  Customer bank
```

---

## Judging criteria where to find the evidence

### Problem Relevance (20%)

The problem is real and quantified. Every Nigerian SaaS team on Nomba today rebuilds the same billing layer. The economics are concrete: a 500-subscriber product at ₦10,000/month with 8% card failure rate loses ₦400,000 per billing cycle without a dunning engine. Tori recovers an estimated 65% of that ₦260,000/month through its grace period and payday-aligned retry schedule.

The Nigerian-specific design decisions throughout the codebase show this was not built as a generic billing tool and adapted. GRACE_PERIOD before dunning, payday retry schedule at Day 3, 7, 14, 21, Nigerian Nomba failure code classification, ₦50 trial verification charge these are all decisions made specifically because of how Nigerian cards and salary cycles behave.

### Technical Execution (25%)

**State machine** 9 validated states with full unit test coverage. Pure function with zero side effects. Every valid and invalid transition is tested. The state machine is the authoritative source no direct status updates bypass it.

**Billing worker** PostgreSQL SKIP LOCKED job queue. Exactly-once processing. Stale lock recovery. Six job types: trial expiry, retry failed payment, grace retry, suspend subscription, abandoned checkout detection, nightly reconciliation.

**Ledger** append-only double-entry ledger. Seven entry types. Every charge, refund, and proration writes one immutable row. MRR, ARR, churn rate, and net revenue are computed from ledger aggregations not from subscription state.

**Invoice lifecycle** invoice created first (open), ledger entry written with real invoice ID (FK constraint satisfied), invoice marked paid with Nomba transaction ID. This ordering is enforced in every code path.

**Edge cases handled**:
- Subscription starts as PENDING_PAYMENT activates only after payment_success webhook
- Checkout abandoned after 24 hours moved to PAST_DUE by background worker
- Expired checkout URL regenerate endpoint available
- Duplicate payment_success webhooks Redis requestId dedup, 24-hour TTL
- Trial verification charge (₦50) auto-refunded after tokenisation
- No tokenKey at trial end moved to PAST_DUE
- Reconciliation pagination infinite loop max 20 pages + same-cursor detection
- Nomba amount field as string or float64 both handled

**Tests** full state machine test suite covering valid transitions, invalid transitions, terminal state, error context, dunning loops, and the new PENDING_PAYMENT flow.

### Security & Reliability (20%)

Full detail in [ARCHITECTURE.md](./ARCHITECTURE.md). Summary:

- Argon2id passwords with unique 16-byte random salt per password
- JWT HS256 with Redis denylist on logout tokens are truly revocable
- API keys stored as SHA-256 hash full key shown once, never retrievable
- Brute force protection 5 attempts, 15-minute lockout, Redis counter per email
- CORS locked to specific origins no wildcard
- Security headers on every API response HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy
- Next.js CSP, HSTS, Permissions-Policy on every frontend response
- PII masking in logs customer emails masked in all log output
- Multi-tenant isolation tenant_id on every table, tenant from auth context never from request body
- Nomba inbound webhook HMAC-SHA256 verification with exact field ordering and base64 encoding
- Outbound webhook HMAC-SHA256 signing with timing-safe comparison
- Optimistic locking on state transitions two concurrent workers cannot corrupt the same subscription
- Idempotency keys on every ledger entry unique constraint prevents double-charges on retry
- Railway managed PostgreSQL with AES-256 encryption at rest and daily automated backups

### Product UX & Clarity (15%)

**Dashboard** 8 pages of real data: overview, subscriptions, billing health, customers, plans, invoices, finance (with MRR, ARR, churn, dunning recovery, revenue forecast, monthly trend charts), webhooks, API keys, settings.

**Docs** Nomba-style two-column API reference. HTTP method badges in sidebar. Per-endpoint Headers, Body params, and Response sections. Four tabs: Documentation, API Reference, Developer Resources, Changelog.

**ClassPay demo** a working integration showing the full user journey from a school admin's perspective. Pricing page, signup, Nomba hosted payment, success page, school dashboard with live subscription data from Tori, billing portal link. The entire billing code ClassPay wrote is approximately 60 lines in `classpay/lib/tori.ts`.

**Health endpoint** `GET /v1/status` requires no auth. Returns API status and Nomba connectivity check. Judges can verify the system is running without credentials.

**Customer portal** self-service pause, resume, cancel via portal token. No support ticket needed.

### Nomba Integration Depth (20%)

Every Nomba API that could be integrated has been integrated:

| API | How Tori uses it |
|-----|-----------------|
| `POST /v1/checkout/order` | Every new subscription with `tokenizeCard: true` |
| `POST /v1/checkout/tokenized-card-payment` | Every renewal cycle and every dunning retry |
| `POST /v1/checkout/refund` | Trial verification refund (automatic) and manual operator refunds |
| `GET /v1/transactions/accounts/{id}` | Nightly reconciliation fetches all successful transactions |
| `POST /v1/auth/token/issue` | OAuth2 with token caching and auto-refresh 5 minutes before expiry |
| Direct debit mandate client | Implemented in `internal/payment/mandate_client.go` |
| Inbound webhook verification | HMAC-SHA256 with exact Nomba field ordering verified on every event |

The integration is production-grade:
- OAuth2 token cached in memory, auto-refreshed zero unnecessary auth calls
- `tokenizeCard: true` on every checkout card tokenised at first payment
- `orderReference` set to subscription UUID `payment_success` webhook matched back to subscription without a lookup table
- Trial plans use ₦50 verification charge full plan amount only charged when trial ends
- Nomba amount field handled as both string and float64 sandbox and production behave differently
- Reconciliation paginates through all Nomba transaction pages with loop protection

## The Nigerian billing problem

Generic billing tools are built for Western card infrastructure. Nigeria is different:

- Nigerian bank cards are frequently issued with online transactions blocked by default. A generic retry system wastes attempts on these they will never succeed.
- Salary cycles in Nigeria cluster around specific days. A card that fails on the 3rd can succeed on the 25th when salary arrives. Generic exponential backoff misses this window entirely.
- Bank outages are common. An issuer-unavailable error at 2am is not the same as a stolen card they need different handling.
- Customers avoid contacting support. A self-service portal that lets customers pause or update their subscription without a support ticket is not a nice-to-have.

Tori was designed around all of this.

---

## Problem relevance

Nigerian SaaS teams building on Nomba today face a choice: rebuild the billing engine for every product, or use a foreign tool (Stripe, Chargebee) that does not understand Nigerian card behaviour and does not integrate with Nomba.

Tori solves this at the infrastructure layer. One integration. Every product on Nomba gets:

- Subscription lifecycle management with a 9-state state machine
- Nigerian-aware dunning with grace periods and payday retry windows
- Customer self-service portal
- Real-time billing health scoring and churn prediction
- Revenue forecasting
- Immutable double-entry ledger
- Automatic refunds on trial verification charges
- Manual refund system with ledger tracking
- Webhook delivery to downstream systems
- Full API reference and dashboard

**Example economics**: A SaaS with 500 subscribers at ₦10,000/month with an 8% card failure rate loses ₦400,000 per billing cycle without a dunning engine. Tori's grace period and payday retry schedule recovers an estimated 65% of that ₦260,000/month that would otherwise be lost.

---

## Technical architecture

### Services

```
┌──────────────────────────────────────────────────────────────┐
│                    Product team's app                         │
│         POST /v1/platform/checkout one call                 │
└─────────────────────┬────────────────────────────────────────┘
                      │ HTTPS + X-API-Key
                      ▼
┌──────────────────────────────────────────────────────────────┐
│                    Tori API (Go 1.26)                         │
│    Dashboard API (/v1/) · Platform API (/v1/platform/)        │
│              Customer Portal (/v1/portal/*)                   │
└──────────┬─────────────────────────────┬─────────────────────┘
           │                             │
     State machine               Webhook dispatcher
     Dunning engine              HMAC-SHA256 signed
     Ledger service              Retry + circuit breaker
           │                             │
           ▼                             ▼
┌──────────────────────┐   ┌────────────────────────────┐
│    PostgreSQL 17      │   │  Product server endpoint    │
│  Subscriptions        │   │  (any HTTPS URL)            │
│  Ledger entries       │   └────────────────────────────┘
│  Plans · Customers    │
│  Jobs · Webhooks      │
│  Invoices             │
└──────────────────────┘
┌──────────────────────┐
│       Redis 7         │
│  Token revocation     │
│  Brute force locks    │
│  Webhook dedup        │
│  Job queue locks      │
└──────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│                          Nomba                                │
│   /checkout/order · /checkout/tokenized-card-payment          │
│   /checkout/refund · /auth/token/issue                        │
└──────────────────────────────────────────────────────────────┘
```

### Stack

| Layer | Technology |
|-------|-----------|
| API server | Go 1.26, Chi v5 router |
| Background worker | Go 1.26, PostgreSQL SKIP LOCKED queue |
| Database | PostgreSQL 17 with pgx/v5 driver |
| Cache | Redis 7 |
| Code generation | sqlc 1.31.1 |
| Frontend | Next.js 16.2, Tailwind CSS, React Query |
| Deployment | Railway (3 services + 2 managed databases) |

---

## Nomba integration

Tori integrates Nomba's payment APIs natively:

### 1. Checkout API

**Endpoint**: `POST /v1/checkout/order`

Used when a new subscription starts. Tori creates a hosted checkout session with `tokenizeCard: true`.

For **no-trial plans**: the full plan amount is charged immediately. The subscription starts as `PENDING_PAYMENT` and moves to `ACTIVE` only after Nomba fires `payment_success`.

For **trial plans**: a ₦50 verification charge is created. The customer's card is tokenised. The ₦50 is automatically refunded immediately after the `payment_success` webhook is received. The real charge fires when the trial ends.

```go
payload := map[string]interface{}{
    "order": map[string]interface{}{
        "amount":         "5000.00",
        "currency":       "NGN",
        "orderReference": subscriptionID,
        "customerEmail":  customer.Email,
        "accountId":      subAccountID,
    },
    "tokenizeCard": true,
}
```

### 2. Tokenised Card API

**Endpoint**: `POST /v1/checkout/tokenized-card-payment`

Used for every renewal cycle and every dunning retry. No customer interaction required.

```go
result, err := h.payment.ChargeToken(ctx, payment.ChargeTokenRequest{
    CustomerID:    sub.CustomerID.String(),
    TokenisedCard: sub.TokenKey,
    Amount:        plan.Amount,
    Reference:     fmt.Sprintf("retry-%s-%d", subID, attempt),
})
```

Failure codes from Nomba are classified into retriable and permanent:

| Nomba code | Classification | Action |
|-----------|---------------|--------|
| `51` | `insufficient_funds` | Retry on payday schedule |
| `54` | `card_expired` | Stop immediately |
| `62`, `57` | `card_blocked` | Stop immediately |
| `91`, `96` | `issuer_unavailable` | Retry after backoff |
| `41`, `43` | `stolen_card` | Stop immediately |

### 3. Refund API

**Endpoint**: `POST /v1/checkout/refund`

Used in two scenarios:

**Automatic**: Trial verification charge (₦50) is refunded immediately after tokenisation succeeds. Fires in the `payment_success` webhook handler.

**Manual**: Operators can issue goodwill refunds from the dashboard or via the Platform API. Every refund writes a `REFUND CREDIT` entry to the immutable ledger.

```bash
POST /v1/platform/subscriptions/{id}/refund
{
  "amount": 500000,
  "reason": "Service unavailable prorated refund"
}
```

### 4. Inbound Nomba Webhook

**Endpoint**: `POST /v1/nomba/webhook`

Receives `payment_success` and `payment_failed` events from Nomba. Every event is:
- Verified via Nomba's HMAC-SHA256 signature
- Deduplicated by `requestId` in Redis with 24-hour TTL

On `payment_success` for a `PENDING_PAYMENT` subscription:
1. TokenKey stored
2. Subscription moved to `ACTIVE`
3. Invoice created and marked paid with Nomba transaction ID
4. Ledger `CHARGE` entry recorded

On `payment_failed` for a `PENDING_PAYMENT` subscription:
1. Subscription moved to `PAST_DUE`

### 5. Nightly Reconciliation

Every 24 hours, the worker fetches all successful Nomba transactions and matches them against the ledger by `merchantTxRef`. Discrepancies are flagged and persisted to `reconciliation_runs`.

---

## Billing state machine

Nine validated states with unit tests covering every valid and invalid transition:

```
PENDING_PAYMENT  checkout payment succeeds  ACTIVE
PENDING_PAYMENT  checkout payment fails     PAST_DUE
PENDING_PAYMENT  abandoned after 24hr       PAST_DUE

TRIALING         trial ends, charge ok      ACTIVE
TRIALING         trial ends, charge fails   GRACE_PERIOD
TRIALING         no tokenKey at trial end   PAST_DUE

ACTIVE           renewal fails              GRACE_PERIOD
ACTIVE           paused                     PAUSED
ACTIVE           cancelled                  CANCELLED

GRACE_PERIOD     48hr retry succeeds        ACTIVE
GRACE_PERIOD     48hr retry fails           PAST_DUE

PAST_DUE         retry succeeds             ACTIVE
PAST_DUE         retry fails (retriable)    DUNNING
PAST_DUE         retry fails (permanent)    SUSPENDED

DUNNING          retry succeeds             ACTIVE
DUNNING          retry fails (retriable)    DUNNING
DUNNING          all retries exhausted      SUSPENDED

PAUSED           resumed                    ACTIVE
PAUSED           cancelled                  CANCELLED

SUSPENDED        manual recovery            ACTIVE
SUSPENDED        cancelled                  CANCELLED

CANCELLED        (terminal)
```

### PENDING_PAYMENT the correct checkout flow

When a customer signs up on a no-trial plan, the subscription starts as `PENDING_PAYMENT`. The customer is redirected to Nomba's hosted checkout page. The subscription only moves to `ACTIVE` after Nomba fires `payment_success` and Tori processes it. If payment fails, the subscription moves to `PAST_DUE`. If the customer abandons the checkout for 24 hours, the abandoned checkout worker moves it to `PAST_DUE`.

This ensures a customer never has access to a product they have not paid for.

### GRACE_PERIOD the Nigerian-first differentiator

When an ACTIVE subscription's renewal charge fails, Tori enters a 48-hour silent retry window before dunning. No webhook fires. No customer disruption. This handles the most common Nigerian failure mode: a card with temporary insufficient funds that clears within 48 hours.

### Dunning schedule
```
Day 0   charge fails → GRACE_PERIOD
Day 2   grace retry
Day 3   dunning attempt 1
Day 7   dunning attempt 2
Day 14  dunning attempt 3
Day 21  dunning attempt 4 → SUSPENDED if fails
```

---

## Edge cases handled

| Scenario | Handling |
|----------|---------|
| Customer pays then abandons redirect | `payment_success` webhook activates subscription regardless |
| Checkout abandoned with no payment | Worker moves to `PAST_DUE` after 24 hours |
| Nomba checkout URL expires | `POST /v1/platform/subscriptions/{id}/checkout` regenerates it |
| Duplicate `payment_success` webhooks | Redis requestId dedup, 24-hour TTL |
| Trial verification charge (₦50) | Auto-refunded after tokenisation |
| No tokenKey at trial end | Subscription moved to `PAST_DUE` |
| Invoice FK constraint on ledger | Invoice created first, ledger entry uses real invoice ID |
| Reconciliation pagination loop | Max 20 pages + same-cursor detection |
| Nomba amount as string or float64 | Both handled via `interface{}` |
| Nomba refund Success as string or bool | Both handled via `interface{}` |

---

## Security

| Concern | Implementation |
|---------|---------------|
| Passwords | Argon2id, unique random 16-byte salt per password |
| JWT | HS256, 15-minute access tokens, 7-day refresh tokens |
| Token revocation | Redis denylist on logout, SHA-256 keyed, auto-expiring |
| Brute force | 5 failed attempts → 15-minute lockout per email |
| API keys | SHA-256 hash stored, full key shown once |
| Webhook signing (outbound) | HMAC-SHA256, `X-Tori-Signature` header |
| Webhook verification (inbound) | Nomba HMAC-SHA256 verified on every inbound event |
| Webhook idempotency | Redis dedup on `requestId`, 24-hour TTL |
| CORS | Strict origin allowlist no wildcard |
| Security headers | HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy |
| CSP | Next.js Content-Security-Policy headers |
| PII in logs | Customer emails masked in all log output |
| Multi-tenant isolation | `tenant_id` on every table, every query |
| Concurrent state transitions | Optimistic locking via `updated_at` |
| Duplicate charges | Idempotency keys on every ledger entry |
| Request size | 1MB body limit on all routes |
| Rate limiting | Per-IP global + per-tenant (300/min JWT, 600/min API key) |
| Card data | Never stored Nomba handles tokenisation entirely |

---

## Double-entry ledger

Every financial event appends one immutable row to `ledger_entries`. Nothing is ever updated or deleted.

```
CHARGE         subscription renewal or dunning recovery
REFUND         manual or automatic refund issued
PRORATION      plan change mid-cycle credit or charge
CREDIT         goodwill credit applied to account
TRIAL_START    trial period begins
TRIAL_END      trial converts to paid
ADMIN_OVERRIDE manual adjustment with reason and audit trail
```

All revenue metrics (MRR, ARR, churn rate, dunning recovery, net revenue) are computed directly from ledger aggregations not from subscription state.

---

## API surfaces

### Dashboard API (`/v1/*`) JWT auth
For human operators through the Tori dashboard. Covers auth, plans, customers, subscriptions, invoices, ledger, finance, billing health, webhooks, API keys, refunds.

### Platform API (`/v1/platform/*`) API key auth
For server-to-server integration. One-call checkout, customer management, subscription control, refunds.

```bash
curl -X POST https://api-production-3847.up.railway.app/v1/platform/checkout \
  -H "X-API-Key: tori_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "amaka@startup.ng",
    "plan_id": "plan_...",
    "external_id": "your-user-123",
    "idempotency_key": "signup_your-user-123",
    "callback_url": "https://yourapp.ng/payment/success"
  }'
```

### Customer Portal (`/v1/portal/*`) Portal JWT
Scoped to a single customer. Pause, resume, cancel without contacting support.

---

## Job queue

PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` exactly-once processing without an external queue:

```sql
SELECT * FROM scheduled_jobs
WHERE status = 'pending'
  AND scheduled_at <= NOW()
ORDER BY scheduled_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED
```

Job types: `expire_trial`, `retry_failed_payment`, `grace_retry`, `suspend_subscription`, `checkout_abandoned`, `reconciliation`

---

## Running locally

### Prerequisites

- Docker Desktop
- Go 1.26
- Node.js 24

### Setup

```bash
git clone https://github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026
cd Tori-NombaxDevcareerHackathon2026

cp .env.example .env
# Add your Nomba TEST credentials to .env

docker compose up --build -d

# Apply migrations in order
docker exec -i tori-postgres psql -U app -d subscriptions_engine \
  -f db/migrations/000001_create_schema.up.sql
# ... apply 000002 through 000008

# Frontend
cd frontend && npm install && npm run dev
```

### Test credentials (local)
```
Email:    dev@tori.ng
Password: tori-dev-2026
```

### Nomba test card
```
Card:   5434621074252808
Expiry: 12/30
CVV:    123
PIN:    1234
OTP:    9999 (approve) | 1234 (timeout) | 5464 (invalid)
```

---

## Repository structure

```
cmd/
  api/          API server entrypoint
  worker/       Background worker entrypoint (billing, dunning, reconciliation)
  seed/         Demo data seed script

internal/
  api/
    handlers/   HTTP handlers (auth, plans, customers, subscriptions,
                checkout, portal, ledger, finance, health, webhooks,
                api keys, invoices, nomba webhook, refunds, system health)
    middleware/ JWT auth, API key auth, request ID, PII masking, rate limiting
    respond/    Consistent JSON response helpers
    router.go   Route registration, CORS allowlist, security headers
  billing/      Job handlers (expire trial, retry, grace retry, suspend,
                abandoned checkout, invoice generation)
  domain/       Domain models, repository interfaces, sentinel errors
  dunning/      Nigerian failure classifier, retry decision engine
  finops/       MRR, ARR, churn rate, dunning recovery, revenue reporting
  ledger/       Ledger service (charge, refund, proration, trial events)
  payment/      NombaClient interface, HTTP client, mandate client, mock
  postgres/     Repository implementations (sqlc generated + manual)
  reconciliation/ Nightly reconciliation service and scheduler
  scheduler/    SKIP LOCKED job worker with stale lock recovery
  subscription/ State machine (pure Transition function, unit tests)
  webhook/      Dispatcher with HMAC signing, retry, circuit breaker

db/
  migrations/   SQL migration files (000001 to 000008)
  queries/      sqlc SQL query definitions
  generated/    sqlc generated Go code

frontend/
  app/          Next.js app router pages
  components/   Shared UI components (sidebar, auth nav)
  lib/          API client, utilities, docs data

classpay/       Demo integration ClassPay school management SaaS
                Shows end-to-end Tori integration from a developer's perspective

config/
  failure_codes.yaml  Nigerian card failure classification
```

---

## Submission checklist

- [x] Public GitHub repository with clean commit history
- [x] Working MVP URL https://frontend-production-e3be.up.railway.app
- [x] Nightly reconciliation Nomba transactions vs ledger, discrepancy detection
- [x] Architecture and security note ARCHITECTURE.md
- [x] Test credentials dev@tori.ng / tori-dev-2026
- [x] ClassPay demo integration end-to-end developer integration example
- [x] Full docs with Nomba-style two-column API reference

---

*Built with Go, PostgreSQL, Redis, Next.js, and Nomba by Kingsley Chibueze for the Nomba × DevCareer Hackathon 2026.*

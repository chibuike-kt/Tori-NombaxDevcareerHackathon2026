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

Nomba gives you world-class payment primitives: hosted checkout, tokenised cards, direct debit mandates. What Nomba does not give you is the orchestration layer that sits on top  the system that decides when to charge, what to do when a charge fails, how to record what happened, and how to surface all of that to the business.

Every Nigerian SaaS product, edtech platform, and creator tool that charges customers monthly has rebuilt this layer from scratch. Tori removes that repeated work permanently.

Tori is **Stripe Billing for Nomba**  a fully managed recurring billing engine that any product team can integrate with a single API call.

```
Your product  →  Tori API  →  Nomba  →  Customer bank
```

---

## Judging criteria  where to find the evidence

### Problem Relevance (20%)

The problem is real and quantified. Every Nigerian SaaS team on Nomba today rebuilds the same billing layer from scratch  the same dunning logic, the same state machine, the same invoice generation, the same webhook delivery system. Tori removes that permanently.

The economics are concrete: a 500-subscriber product at ₦10,000/month with an 8% card failure rate loses ₦400,000 per billing cycle without a dunning engine. Tori's grace period and payday-aligned retry schedule recovers an estimated 65% of that  ₦260,000/month that would otherwise be lost to card failures that a smarter system would have recovered.

The Nigerian-specific design decisions throughout the codebase show this was not built as a generic billing tool and adapted. GRACE_PERIOD before dunning, payday retry schedule at Day 3, 7, 14, 21, Nigerian Nomba failure code classification, ₦50 trial verification charge that is automatically refunded, PENDING_PAYMENT state that ensures subscriptions only activate after real payment  these are all decisions made specifically because of how Nigerian cards, bank systems, and salary cycles behave.

### Technical Execution (25%)

**State machine**  9 validated states with full unit test coverage. Pure function with zero side effects. Every valid and invalid transition is tested including the new PENDING_PAYMENT flow. The state machine is the authoritative source  no direct status updates bypass it.

**Correct checkout flow**  subscriptions start as PENDING_PAYMENT. They move to ACTIVE only after Nomba fires payment_success and Tori processes it. If payment fails, the subscription moves to PAST_DUE. If the customer abandons checkout for 24 hours, the abandoned checkout worker moves it to PAST_DUE. This ensures a customer never has access to a product they have not paid for.

**Billing worker pool**  PostgreSQL SKIP LOCKED job queue with 5 concurrent goroutines. Each goroutine independently claims and processes jobs. At 1,000 subscribers with monthly billing, 80 jobs could fire on the same day  the pool processes them in parallel rather than sequentially. Stale lock recovery runs every 5 minutes to handle crashed goroutines.

**Async webhook delivery**  webhook deliveries are enqueued as jobs rather than delivered inline. The request path is never blocked by the developer's endpoint latency. Falls back to synchronous delivery if the job cannot be enqueued, ensuring no event is ever lost.

**Ledger**  append-only double-entry ledger. Seven entry types. Every charge, refund, and proration writes one immutable row. Invoice is always created before the ledger entry so the FK constraint is always satisfied. MRR, ARR, churn rate, and net revenue are computed from ledger aggregations  not from subscription state.

**Email verification**  production-grade tenant onboarding via Resend. 6-digit cryptographically random code generated with `crypto/rand`. 15-minute expiry. Codes are deleted and regenerated on resend. 60-second resend cooldown enforced on the frontend. Welcome email sent after successful verification. Existing tenants auto-verified on migration so they are not disrupted.

**Observability**  request latency middleware logs every request with method, path, status code, latency in milliseconds, and request ID. Enhanced health endpoint exposes database pool stats, goroutine count, heap memory, and job queue depth. Authenticated metrics endpoint exposes subscription counts by state, MRR, gross revenue, charge success rate, failed job count.

**Edge cases handled**:
- Subscription starts as PENDING_PAYMENT  activates only after payment_success webhook confirms real payment
- Checkout abandoned after 24 hours  background worker moves to PAST_DUE, skips seeded subscriptions
- Expired checkout URL  regenerate endpoint at POST /v1/platform/subscriptions/{id}/checkout
- Duplicate payment_success webhooks  Redis requestId dedup with 24-hour TTL
- Trial verification charge (₦50)  auto-refunded after tokenisation via POST /v1/checkout/refund
- No tokenKey at trial end  moved to PAST_DUE
- Reconciliation pagination infinite loop  max 20 pages plus same-cursor detection
- Nomba amount field as string or float64  both handled via interface{}
- Nomba refund Success field as string or bool  both handled via interface{}
- Webhook endpoint blocked  circuit breaker after 10 failures in 24 hours
- Job exhausted all retries  dead letter logged at ERROR with full payload

**Tests**  full state machine test suite, billing job tests, ledger service tests, dunning engine tests, webhook signature tests. All passing.

### Security & Reliability (20%)

Full detail in [ARCHITECTURE.md](./ARCHITECTURE.md). Summary:

- Argon2id passwords with unique 16-byte random salt per password
- JWT HS256 with Redis denylist on logout  tokens are truly revocable
- API keys stored as SHA-256 hash  full key shown once, never retrievable
- Brute force protection  5 attempts, 15-minute lockout, Redis counter per email
- Email verification  6-digit code via Resend, 15-minute expiry, crypto/rand generation
- CORS locked to specific origins  no wildcard
- Security headers on every API response  HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy
- Next.js CSP, HSTS, Permissions-Policy on every frontend response
- PII masking in logs  customer emails masked in all log output
- Multi-tenant isolation  tenant_id on every table, tenant from auth context never from request body
- Nomba inbound webhook HMAC-SHA256 verification with exact field ordering and base64 encoding
- Outbound webhook HMAC-SHA256 signing with timing-safe comparison via hmac.Equal
- Optimistic locking on state transitions  two concurrent workers cannot corrupt the same subscription
- Idempotency keys on every ledger entry  unique constraint prevents double-charges on retry
- Railway managed PostgreSQL with AES-256 encryption at rest and daily automated backups
- Max 5 webhook endpoints per tenant  prevents resource exhaustion
- Request body size limit 1MB  prevents OOM attacks

### Product UX & Clarity (15%)

**Dashboard**  8 pages of real data: overview, subscriptions with PENDING_PAYMENT status and filter, billing health with churn prediction, customers, plans, invoices, finance (MRR, ARR, churn, dunning recovery, revenue forecast, monthly trend charts with Refresh button), webhooks, API keys, settings.

**Docs**  Nomba-style two-column API reference. HTTP method badges in sidebar. Per-endpoint Headers, Body params, and Response sections with status code badges. Four tabs: Documentation, API Reference, Developer Resources, Changelog.

**Signup flow**  2-step: account details then email verification. OTP page with 6-digit individual input boxes, auto-advance on keystroke, auto-submit on sixth digit, paste support, 60-second resend cooldown, expiry handling.

**Dashboard verification banner**  unverified tenants see a yellow banner on every dashboard page with a Verify now button that sends a new code and redirects to the OTP page.

**ClassPay demo**  a working integration showing the full user journey from a school admin's perspective. Pricing page, signup, Nomba hosted payment, success page, school dashboard with live subscription data pulled from Tori, billing portal link. The entire billing code ClassPay wrote is approximately 60 lines in classpay/lib/tori.ts. Everything else is handled by Tori.

**Health endpoint**  GET /v1/status requires no auth. Returns API status, database pool stats, goroutine count, heap memory, and job queue depth. Judges can verify the system is live and healthy without credentials.

**Metrics endpoint**  GET /v1/metrics returns subscription counts by state, MRR, gross revenue this month, charge success rate, failed job count, queue depth. Real operational intelligence in one call.

**Customer portal**  self-service pause, resume, cancel via portal token. No support ticket needed.

### Nomba Integration Depth (20%)

Every Nomba API that could be integrated has been integrated:

| API | How Tori uses it |
|-----|-----------------|
| `POST /v1/checkout/order` | Every new subscription  with `tokenizeCard: true` |
| `POST /v1/checkout/tokenized-card-payment` | Every renewal cycle and every dunning retry |
| `POST /v1/checkout/refund` | Trial verification refund (automatic) and manual operator refunds |
| `GET /v1/transactions/accounts/{id}` | Nightly reconciliation  fetches all successful transactions |
| `POST /v1/auth/token/issue` | OAuth2 with token caching and auto-refresh 5 minutes before expiry |
| Direct debit mandate client | Implemented in `internal/payment/mandate_client.go` |
| Inbound webhook verification | HMAC-SHA256 with exact Nomba field ordering  verified on every event |

The integration is production-grade:
- OAuth2 token cached in memory, auto-refreshed  zero unnecessary auth calls per request
- `tokenizeCard: true` on every checkout  card tokenised at first payment
- `orderReference` set to subscription UUID  payment_success webhook matched back to subscription without a lookup table
- Trial plans use ₦50 verification charge  full plan amount only charged when trial ends via ExpireTrial job
- No-trial plans start as PENDING_PAYMENT  subscription activates only after payment_success webhook confirms real payment
- Nomba amount field handled as both string and float64  sandbox and production behave differently
- Nomba refund Success field handled as both bool and string
- Reconciliation paginates through all Nomba transaction pages with loop protection
- Nomba transaction ID stored on invoice via MarkPaid  available for accurate refund API calls

---

## The Nigerian billing problem

Generic billing tools are built for Western card infrastructure. Nigeria is different:

- Nigerian bank cards are frequently issued with online transactions blocked by default. A generic retry system wastes attempts on these  they will never succeed.
- Salary cycles in Nigeria cluster around specific days. A card that fails on the 3rd can succeed on the 25th when salary arrives. Generic exponential backoff misses this window entirely.
- Bank outages are common. An issuer-unavailable error at 2am is not the same as a stolen card  they need different handling.
- Customers avoid contacting support. A self-service portal that lets customers pause or update their subscription without a support ticket is not a nice-to-have.

Tori was designed around all of this.

---

## Production proof

The following are real log outputs from the live Railway deployment captured on July 1, 2026.

### Real Nomba production webhook — Verve card end to end

A real ₦100 charge on a Verve card. Nomba fired the `payment_success` webhook to Tori's live Railway endpoint. Tori activated the subscription, created the invoice, and recorded the ledger entry — all within the same webhook handler.

```
6:43PM INF nomba: initiating checkout amount_kobo=10000 reference=a0839797-a0dc-44a5-93d4-a846b13ce2fc
6:43PM DBG nomba: outbound request method=POST url=https://api.nomba.com/v1/checkout/order
6:43PM INF nomba: checkout created checkout_url=https://pay.nomba.com/checkout/fb9ddae8-f5af-486e-a658-d9568524af76
6:44PM INF nomba webhook received event_type=payment_success request_id=a64bc178-805e-4bf0-aca3-821c7b0f7a79
6:44PM INF nomba payment_success — card tokenised, ready for recurring billing
        amount=100 card_pan="507872****4811" card_type=Verve
        order_reference=a0839797-a0dc-44a5-93d4-a846b13ce2fc
        token_key=4104486919
6:44PM INF nomba webhook: token key stored on subscription sub_id=a0839797-a0dc-44a5-93d4-a846b13ce2fc
6:44PM INF nomba webhook: subscription activated, period start set to payment confirmation time
6:44PM INF nomba webhook: PENDING_PAYMENT → ACTIVE, invoice created and marked paid
        amount_kobo=10000 invoice_id=3ef83506-6d7d-42cb-bf8c-68cd1ca352df plan=Test
        sub_id=a0839797-a0dc-44a5-93d4-a846b13ce2fc
6:45PM INF processing job job_type=webhook_deliver
6:45PM INF processing job job_type=webhook_deliver
```

### Abandoned checkout — automatic PAST_DUE after 1 hour

A subscription where Nomba sandbox did not deliver the webhook. After 1 hour with no tokenKey, the abandoned checkout worker moved it to PAST_DUE automatically and scheduled a dunning retry at Day 3.

```
worker-1 | INF billing: abandoned checkout — no tokenKey, moving to PAST_DUE
         status=PENDING_PAYMENT age=1h2m
         sub_id=56f40906-8ef7-4fc2-977a-336b75a36f24
worker-1 | INF billing: abandoned checkout moved to PAST_DUE, dunning retry scheduled Day 3
worker-1 | INF billing: abandoned checkout check complete abandoned=1
```

### Trial expiry — automatic charge via tokenised card

A TRIALING subscription at trial end. The worker charged the stored tokenKey for the full plan amount without any customer interaction.

```
worker-1 | INF trial expired — charging card now sub_id=a75c0407-9992-402b-b11a-494229895cc2
worker-1 | INF nomba: charging tokenised card
         amount_kobo=250000 idempotency_key=trial-charge-a75c0407-9992-402b-b11a-494229895cc2
worker-1 | INF nomba: charge succeeded reference=trial-charge-a75c0407-9992-402b-b11a-494229895cc2
worker-1 | INF invoice created, ledger entry recorded, invoice marked paid
         amount_kobo=250000 invoice_id=6a717e90-945f-4198-9219-97b0b7e3897b
worker-1 | INF trial charge succeeded — subscription activated amount=2500.00
```

### Live metrics — Railway production database

```json
{
  "subscriptions": {
    "total": 14,
    "active": 13,
    "by_status": { "ACTIVE": 13, "PAST_DUE": 1 }
  },
  "revenue": {
    "mrr_kobo": 5000,
    "mrr_naira": 50,
    "gross_this_month": 422500,
    "net_this_month": 422500
  },
  "billing": {
    "charge_success_rate_pct": 100,
    "at_risk_count": 0
  },
  "worker": {
    "queue_depth": 0,
    "failed_jobs_count": 0
  }
}
```

### Health endpoint — no authentication required

```json
{
  "status": "ok",
  "checks": { "api": "ok", "database": "ok", "nomba": "connected" },
  "database": { "total_conns": 3, "idle_conns": 3, "max_conns": 20 },
  "worker": { "queue_depth": 0 },
  "runtime": { "goroutines": 6, "heap_alloc_mb": 1.41 }
}
```

### Nightly reconciliation run

```
worker-1 | INF reconciliation: starting run
         from=2026-06-30T00:00:00Z to=2026-07-01T00:00:00Z
worker-1 | INF reconciliation: fetched Nomba transactions count=4
worker-1 | INF reconciliation: run complete
         matched=2 mismatched=0 missing=2 status=discrepancies_found
```

The 2 missing entries are sandbox test transactions where Nomba processed payment but the webhook was not delivered — exactly the discrepancy the reconciliation system is designed to detect.


## Technical architecture

### Services

```
┌──────────────────────────────────────────────────────────────┐
│                    Product team's app                         │
│         POST /v1/platform/checkout  one call                 │
└─────────────────────┬────────────────────────────────────────┘
                      │ HTTPS + X-API-Key
                      ▼
┌──────────────────────────────────────────────────────────────┐
│                    Tori API (Go 1.26)                          │
│    Dashboard API (/v1/) · Platform API (/v1/platform/)        │
│              Customer Portal (/v1/portal/*)                   │
└──────────┬─────────────────────────────┬─────────────────────┘
           │                             │
     State machine               Webhook dispatcher
     Dunning engine              HMAC-SHA256 signed
     Ledger service              Async job queue
     Email service               Circuit breaker
           │                             │
           ▼                             ▼
┌──────────────────────┐   ┌────────────────────────────┐
│    PostgreSQL 17      │   │  Product server endpoint    │
│  11 tables            │   │  (any HTTPS URL)            │
│  Append-only ledger   │   └────────────────────────────┘
│  SKIP LOCKED queue    │
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
| Background worker | Go 1.26, PostgreSQL SKIP LOCKED queue, 5-goroutine pool |
| Database | PostgreSQL 17 with pgx/v5 driver |
| Cache | Redis 7 |
| Code generation | sqlc 1.31.1 |
| Email | Resend (transactional email) |
| Frontend | Next.js 16.2, Tailwind CSS, React Query |
| Deployment | Railway (3 services + 2 managed databases) |

---

## Nomba integration

### Checkout with tokenizeCard

For no-trial plans, the full plan amount is charged immediately. The subscription starts as PENDING_PAYMENT and moves to ACTIVE only after Nomba fires payment_success. For trial plans, a ₦50 verification charge is used  the real charge fires automatically when the trial ends.

### payment_success webhook processing

```
Webhook arrives → HMAC-SHA256 verified → requestId deduplicated
  if PENDING_PAYMENT:
    → subscription moved to ACTIVE
    → invoice created (open)
    → ledger CHARGE entry written (with invoice.ID)
    → invoice marked paid with Nomba transactionId

  if TRIALING and amount ≤ ₦60:
    → POST /v1/checkout/refund (₦50 returned immediately)
```

### Recurring charge

Every renewal and every dunning retry uses the stored tokenKey with a deterministic idempotency reference  no customer interaction required.

### Refund API

Tori stores the Nomba transactionId on every invoice via MarkPaid. The refund endpoint fetches the invoice to get the correct transactionId before calling POST /v1/checkout/refund.

### Nightly reconciliation

Fetches all successful Nomba transactions and matches against the ledger by merchantTxRef. Paginates with max 20 pages and same-cursor loop detection.

---

## Billing state machine

9 validated states, fully unit-tested:

```
PENDING_PAYMENT  payment confirmed    ACTIVE
PENDING_PAYMENT  payment failed       PAST_DUE
PENDING_PAYMENT  abandoned 24hr       PAST_DUE

TRIALING         trial ends ok        ACTIVE
TRIALING         trial ends fails     GRACE_PERIOD
TRIALING         no tokenKey          PAST_DUE

ACTIVE           renewal fails        GRACE_PERIOD
ACTIVE           paused               PAUSED
ACTIVE           cancelled            CANCELLED

GRACE_PERIOD     48hr retry ok        ACTIVE
GRACE_PERIOD     48hr retry fails     PAST_DUE

PAST_DUE         retry ok             ACTIVE
PAST_DUE         retriable failure    DUNNING
PAST_DUE         permanent failure    SUSPENDED

DUNNING          retry ok             ACTIVE
DUNNING          retriable failure    DUNNING
DUNNING          exhausted            SUSPENDED

PAUSED           resumed              ACTIVE
PAUSED           cancelled            CANCELLED

SUSPENDED        manual recovery      ACTIVE
SUSPENDED        cancelled            CANCELLED

CANCELLED        (terminal)
```

---

## Security

| Concern | Implementation |
|---------|---------------|
| Passwords | Argon2id, unique random 16-byte salt per password |
| JWT | HS256, 15-minute access tokens, 7-day refresh tokens |
| Token revocation | Redis denylist on logout, SHA-256 keyed, auto-expiring |
| Brute force | 5 failed attempts → 15-minute lockout per email |
| Email verification | 6-digit code via Resend, crypto/rand, 15-minute expiry |
| API keys | SHA-256 hash stored, full key shown once |
| Webhook signing (outbound) | HMAC-SHA256, `X-Tori-Signature` header |
| Webhook verification (inbound) | Nomba HMAC-SHA256 verified on every inbound event |
| Webhook idempotency | Redis dedup on `requestId`, 24-hour TTL |
| Webhook endpoint limit | Max 5 per tenant |
| CORS | Strict origin allowlist  no wildcard |
| Security headers | HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy |
| CSP | Next.js Content-Security-Policy headers |
| PII in logs | Customer emails masked in all log output |
| Multi-tenant isolation | `tenant_id` on every table, every query |
| Concurrent state transitions | Optimistic locking via `updated_at` |
| Duplicate charges | Idempotency keys on every ledger entry |
| Request size | 1MB body limit on all routes |
| Rate limiting | Per-IP global + per-tenant (300/min JWT, 600/min API key) |
| Card data | Never stored  Nomba handles tokenisation entirely |

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

---

## Job queue

PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED`  exactly-once processing:

```sql
SELECT * FROM scheduled_jobs
WHERE status = 'pending'
  AND scheduled_at <= NOW()
ORDER BY scheduled_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED
```

5 concurrent goroutines run the polling loop. Each claims a different job. Dead letter logging fires at ERROR with full payload when a job exhausts all attempts.

| Job type | When fired | What it does |
|----------|-----------|-------------|
| `expire_trial` | At trial end | Charges tokenKey for full plan amount, activates subscription |
| `retry_failed_payment` | Dunning schedule | Retries charge on payday-aligned day |
| `grace_retry` | 48 hours after first failure | Silent retry before dunning begins |
| `suspend_subscription` | After dunning exhaustion | Moves subscription to SUSPENDED |
| `checkout_abandoned` | Worker startup (daily) | Finds PENDING_PAYMENT/TRIALING subs with no tokenKey after 24 hours |
| `webhook_deliver` | On every billing event | Async webhook delivery to developer endpoint |
| `reconciliation` | Worker startup (nightly) | Fetches Nomba transactions, matches against ledger |

---

## Observability

**Request logger**  every request logged with method, path, status code, latency in milliseconds, response bytes, and request ID. 4xx responses logged at WARN, 5xx at ERROR.

**Health endpoint**  `GET /v1/status` requires no auth:
```json
{
  "status": "ok",
  "database": { "total_conns": 3, "idle_conns": 3, "max_conns": 20 },
  "worker": { "queue_depth": 1 },
  "runtime": { "goroutines": 6, "heap_alloc_mb": 1.25, "num_gc": 0 }
}
```

**Metrics endpoint**  `GET /v1/metrics` (JWT auth):
```json
{
  "subscriptions": { "total": 4, "active": 4, "by_status": {...} },
  "revenue": { "mrr_kobo": 1750000, "gross_this_month": 1750000 },
  "billing": { "charge_success_rate_pct": 100 },
  "worker": { "queue_depth": 1, "failed_jobs_count": 0 }
}
```

---

## Tenant onboarding

Registration triggers a 6-digit email verification flow via Resend:

1. Tenant registers → cryptographically random 6-digit code generated → email sent via Resend
2. `POST /v1/auth/verify-email` with code → tenant marked verified → welcome email sent
3. `POST /v1/auth/resend-verification` → new code generated → old codes deleted
4. Dashboard shows a yellow verification banner until verified
5. Login response always includes `email_verified` flag

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
# Add your Nomba TEST credentials and RESEND_API_KEY to .env

docker compose up --build -d

# Apply migrations in order (000001 through 000009)
docker exec -i tori-postgres psql -U app -d subscriptions_engine \
  -f db/migrations/000001_create_schema.up.sql
# ... apply through 000009

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
PIN:    0000
OTP:    000000 (approve) | 1234 (timeout) | 5464 (invalid)
```

---

## Repository structure

```
cmd/
  api/          API server entrypoint
  worker/       Background worker 5-goroutine pool
  seed/         Demo data seed script

internal/
  api/
    handlers/   auth (with email verification), plans, customers,
                subscriptions, checkout, portal, ledger, finance,
                health, webhooks, api keys, invoices, nomba webhook,
                refunds, system health, metrics
    middleware/ JWT auth, API key auth, request ID, request logger,
                PII masking, rate limiting
    respond/    Consistent JSON response helpers
    router.go   Route registration, CORS allowlist, security headers
  billing/      Job handlers  expire trial, retry, grace retry,
                suspend, abandoned checkout, invoice generation
  domain/       Domain models, repository interfaces, sentinel errors
  dunning/      Nigerian failure classifier, retry decision engine
  email/        Resend client, verification and welcome email templates
  finops/       MRR, ARR, churn rate, dunning recovery, revenue reporting
  ledger/       Ledger service  charge, refund, proration, trial events
  payment/      NombaClient  checkout, tokenised card, refund, reconciliation
  postgres/     Repository implementations
  reconciliation/ Nightly reconciliation service and scheduler
  scheduler/    SKIP LOCKED worker with 5-goroutine RunPool
  subscription/ State machine  9 states, full unit test coverage
  webhook/      Dispatcher  HMAC signing, async job queue, circuit breaker

db/
  migrations/   SQL migration files (000001 to 000009)
  queries/      sqlc SQL query definitions
  generated/    sqlc generated Go code

frontend/
  app/          Next.js app router pages
                signup/ (2-step with OTP)
                verify-email/ (6-digit OTP page)
                dashboard/ (8 pages, verification banner)
  components/   Sidebar, auth nav, email verification banner
  lib/          API client with token refresh, utils, docs data

classpay/       Demo integration  ClassPay school management SaaS

config/
  failure_codes.yaml  Nigerian card failure classification
```

---

## Submission checklist

- [x] Public GitHub repository with clean commit history
- [x] Working MVP URL  https://frontend-production-e3be.up.railway.app
- [x] Nightly reconciliation  Nomba transactions vs ledger, discrepancy detection
- [x] Architecture and security note  ARCHITECTURE.md
- [x] Test credentials  dev@tori.ng / tori-dev-2026
- [x] ClassPay demo integration  end-to-end developer integration example
- [x] Full docs with Nomba-style two-column API reference
- [x] Email verification  production Resend integration, OTP flow, welcome email
- [x] Observability  request logger, health endpoint, metrics endpoint
- [x] Worker concurrency  5-goroutine pool via RunPool
- [x] Async webhook delivery  webhook_deliver job type

---

*Built with Go, PostgreSQL, Redis, Next.js, Resend, and Nomba  by Kingsley Chibueze for the Nomba × DevCareer Hackathon 2026.*

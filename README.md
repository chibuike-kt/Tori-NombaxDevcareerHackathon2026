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

Nomba gives you world-class payment primitives — hosted checkout, tokenised cards, direct debit mandates. What Nomba does not give you is the orchestration layer that sits on top: the system that decides *when* to charge, *what to do when a charge fails*, *how to record what happened*, and *how to surface all of that to the business*.

Every Nigerian SaaS product, edtech platform, and creator tool that charges customers monthly has rebuilt this layer from scratch. Tori removes that repeated work permanently.

Tori is **Stripe Billing for Nomba** — a fully managed recurring billing engine that any product team can integrate with a single API call.
Your product → Tori API → Nomba → Customer bank

---

## The Nigerian billing problem

Generic billing tools are built for Western card infrastructure. Nigeria is different:

- **Nigerian Bank** cards are frequently issued blocked for online transactions. A generic retry system wastes attempts on these — they will never succeed.
- **Salary cycles** in Nigeria cluster around specific days. A card that fails on the 3rd can succeed on the 25th when salary arrives. Generic exponential backoff misses this window.
- **Bank outages** are common. An issuer-unavailable error at 2am is not the same as a stolen card — they need different handling.
- **Customers avoid contacting support**. A self-service portal that lets customers pause or update their subscription without a support ticket is not a nice-to-have.

Tori was designed around all of this.

---

## Problem relevance

Nigerian SaaS teams building on Nomba today face a choice: rebuild the billing engine for every product, or use a foreign tool (Stripe, Chargebee) that doesn't understand Nigerian card behaviour and doesn't integrate with Nomba.

Tori solves this at the infrastructure layer. One integration. Every product on Nomba gets:

- Subscription lifecycle management
- Nigerian-aware dunning with grace periods and payday retry windows
- Customer self-service portal
- Real-time billing health scoring and churn prediction
- Revenue forecasting
- Immutable double-entry ledger
- Webhook delivery to downstream systems
- Full API reference and dashboard

**Example economics**: A SaaS with 500 subscribers at ₦10,000/month with an 8% card failure rate loses ₦400,000 per billing cycle without a dunning engine. Tori's grace period and payday retry schedule recovers an estimated 65% of that — ₦260,000/month that would otherwise be lost.

---

## Technical architecture

### Services
┌─────────────────────────────────────────────────────────────────┐

│                      Product team's app                          │

│            POST /v1/platform/checkout — one call                 │

└──────────────────────┬──────────────────────────────────────────┘

│ HTTPS + X-API-Key

▼

┌─────────────────────────────────────────────────────────────────┐

│                       Tori API (Go 1.26)                         │

│          Dashboard API (/v1/) · Platform API (/v1/platform/)   │

│                   Customer Portal (/v1/portal/*)                 │

└──────────┬───────────────────────────┬───────────────────────────┘

│                           │

State machine               Webhook dispatcher

Dunning engine              HMAC-SHA256 signed

Ledger service              Retry + circuit breaker

│                           │

▼                           ▼

┌──────────────────────┐   ┌───────────────────────────┐

│    PostgreSQL 17      │   │  Product server endpoint   │

│  Subscriptions        │   │  (any HTTPS URL)           │

│  Ledger entries       │   └───────────────────────────┘

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

┌─────────────────────────────────────────────────────────────────┐

│                          Nomba                                    │

│    /checkout/order · /checkout/tokenized-card-payment            │

│    /direct-debits · /auth/token/issue                            │

└─────────────────────────────────────────────────────────────────┘

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

Tori integrates all three primary Nomba payment APIs:

### 1. Checkout API

**Endpoint**: `POST /v1/checkout/order`

Used when a new subscription starts. Tori creates a hosted checkout session with `tokenizeCard: true` and redirects the customer to Nomba's hosted payment page.

```go
// internal/payment/nomba_client.go
payload := map[string]interface{}{
    "order": map[string]interface{}{
        "amount":         "5000.00",
        "currency":       "NGN",
        "orderReference": subscriptionID, // used to match webhook to subscription
        "customerEmail":  customer.Email,
        "accountId":      subAccountID,
    },
    "tokenizeCard": true, // critical — enables recurring billing
}
```

When payment succeeds, Nomba fires a `payment_success` webhook containing `tokenizedCardData.tokenKey`. Tori stores this on the subscription record for all future charges.

### 2. Tokenised Card API (Recurring billing)

**Endpoint**: `POST /v1/checkout/tokenized-card-payment`

Used for every renewal cycle and every dunning retry. No customer interaction required.

```go
// Called by the billing worker on every renewal
result, err := h.payment.ChargeToken(ctx, payment.ChargeTokenRequest{
    CustomerID:     sub.CustomerID.String(),
    TokenisedCard:  sub.TokenKey, // stored from initial checkout webhook
    Amount:         plan.Amount,
    Currency:       plan.Currency,
    Reference:      fmt.Sprintf("retry-%s-%d", subID, attempt),
})
```

Failure codes from Nomba are mapped to the Nigerian dunning classifier:

| Nomba code | Classification | Action |
|-----------|---------------|--------|
| `51` | `insufficient_funds` | Retry on payday schedule |
| `54` | `card_expired` | Stop immediately |
| `62`, `57` | `card_blocked` | Stop immediately |
| `91`, `96` | `issuer_unavailable` | Retry after backoff |
| `41`, `43` | `stolen_card` | Stop immediately |

### 3. Direct Debit Mandates

**Endpoints**: `POST /v1/direct-debits`, `POST /v1/direct-debits/{id}/debit`, `GET /v1/direct-debits/{id}`

Alternative payment method for customers who prefer bank account debit over card. More reliable for Nigerian bank accounts — not subject to card blocking issues.

```go
// internal/payment/mandate_client.go
mandate, err := c.CreateMandate(ctx, MandateRequest{
    CustomerName:   customer.Name,
    AccountNumber:  "0123456789",
    BankCode:       "058", // GTBank
    Amount:         plan.Amount,
    Frequency:      "MONTHLY",
    StartDate:      time.Now(),
    EndDate:        time.Now().AddDate(1, 0, 0),
    MaxDebitAmount: plan.Amount * 2,
})
```

### 4. Inbound Nomba Webhook

**Endpoint**: `POST /v1/nomba/webhook`

Receives `payment_success` and `payment_failed` events from Nomba.

**Signature verification** — every inbound webhook is verified using Nomba's HMAC-SHA256 scheme:

```go
hashPayload := strings.Join([]string{
    payload.EventType,
    payload.RequestID,
    data.Merchant.UserID,
    data.Merchant.WalletID,
    data.Transaction.TransactionID,
    data.Transaction.Type,
    data.Transaction.Time,
    responseCode,
    timestamp,
}, ":")

mac := hmac.New(sha256.New, []byte(secret))
mac.Write([]byte(hashPayload))
expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))
```

**Idempotency** — every inbound webhook is deduplicated by `requestId` using Redis with a 24-hour TTL. Nomba's retry logic cannot cause double-processing.
First delivery  → processed

Second delivery → duplicate (idempotent)

---

## Billing state machine

Eight validated states with 28 unit tests covering every valid and invalid transition:
TRIALING ──trial_end──► ACTIVE ──renewal_failed──► GRACE_PERIOD

│                              │

pause                    48hr silent retry

│                              │

PAUSED              ┌── retry_success ──► ACTIVE

│                 └── retry_failed ──► PAST_DUE

resume                            │

│                           dunning

└──────────────────────► DUNNING

│

payday retry schedule

Day 3, 7, 14, 21

│

┌── recovered ──► ACTIVE

└── exhausted ──► SUSPENDED

│

CANCELLED (terminal)

### GRACE_PERIOD — the Nigerian-first differentiator

When an ACTIVE subscription's renewal charge fails for the first time, Tori does **not** immediately enter dunning. Instead:

1. Subscription moves to `GRACE_PERIOD`
2. A silent retry job is scheduled 48 hours later
3. No webhook fires — no customer-facing disruption
4. If the grace retry succeeds → back to `ACTIVE` silently
5. If it fails → `PAST_DUE` → full dunning schedule begins

This handles the most common Nigerian failure mode: a card with temporary insufficient funds that clears within 48 hours.

### Dunning engine
Day 0   — charge fails → GRACE_PERIOD

Day 2   — grace retry

Day 2+  — grace fails → PAST_DUE → dunning begins

Day 3   — dunning attempt 1

Day 7   — dunning attempt 2

Day 14  — dunning attempt 3

Day 21  — dunning attempt 4

Day 21+ — SUSPENDED if all attempts failed

Failure classification is loaded from `config/failure_codes.yaml`. Permanently blocked cards are stopped immediately — no wasted attempts.

---

## Security

| Concern | Implementation |
|---------|---------------|
| Passwords | Argon2id, unique random 16-byte salt per password |
| JWT | HS256, 15-minute access tokens, 7-day refresh tokens |
| Token revocation | Redis denylist on logout, SHA-256 keyed, auto-expiring |
| Brute force | 5 failed attempts → 15-minute lockout per email in Redis |
| JWT secret | Minimum 32 characters enforced at API startup |
| API keys | SHA-256 hash stored, full key shown once, hint displayed |
| Webhook signing (outbound) | HMAC-SHA256, `X-Tori-Signature` header, secret stored as hash |
| Webhook verification (inbound) | Nomba HMAC-SHA256 verified on every inbound event |
| Webhook idempotency | Redis dedup on `requestId`, 24-hour TTL |
| Multi-tenant isolation | `tenant_id` on every table, every query — cross-tenant access architecturally impossible |
| Concurrent state transitions | Optimistic locking via `updated_at` version check |
| Duplicate charges | Idempotency keys on every ledger entry and charge call |
| Request size | 1MB body limit on all routes |
| Rate limiting | Per-IP global + per-tenant authenticated (300/min JWT, 600/min API key) |
| Card data | Never stored — Nomba handles tokenisation |
| Nomba credentials | Environment variables only, never in source |

---

## Double-entry ledger

Every financial event appends one immutable row to `ledger_entries`. Nothing is ever updated or deleted.
CHARGE         — subscription renewal or dunning recovery

REFUND         — manual refund issued via dashboard

PRORATION      — plan change mid-cycle credit or charge

CREDIT         — goodwill credit applied to account

TRIAL_START    — trial period begins

TRIAL_END      — trial converts to paid

ADMIN_OVERRIDE — manual adjustment with audit trail

All revenue metrics (MRR, ARR, churn rate, dunning recovery, net revenue) are computed directly from ledger aggregations — not from subscription state. The ledger is the source of truth.

---

## Billing intelligence

### Health scoring (0-100 per subscription)
Base: 100

GRACE_PERIOD state    → -10

PAST_DUE state        → -20

DUNNING state         → -40

SUSPENDED state       → -60

Each dunning attempt  → -10 (capped at -40)

Subscription < 30 days → -5

Previous recovery     → -10

### Churn prediction (5 signal levels)

`none` → `low` → `medium` → `high` → `critical`

Each high or critical signal comes with a human-readable reason and a recommended operator action.

### Revenue forecasting
Low  = active_mrr × (1 - churn_rate) × (1 - failure_rate)

Mid  = active_mrr × (1 - churn_rate) × (1 - failure_rate × (1 - recovery_rate))

High = active_mrr × (1 - churn_rate)

Confidence level is computed from active subscription count and historical ledger depth.

---

## API surfaces

### Dashboard API (`/v1/*`) — JWT auth
For human operators. Covers auth, plans, customers, subscriptions, invoices, ledger, finance, billing health, webhooks, API keys.

### Platform API (`/v1/platform/*`) — API key auth
For server-to-server integration. One-call checkout, customer management, subscription control.

```bash
# One call to start a subscription
curl -X POST https://api-production-3847.up.railway.app/v1/platform/checkout \
  -H "X-API-Key: tori_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "amaka@startup.ng",
    "plan_id": "plan_...",
    "external_id": "your-user-123"
  }'
```

### Customer Portal (`/v1/portal/*`) — Portal JWT
Scoped to a single customer. Pause, resume, cancel — without contacting support.

---

## Job queue

PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` — exactly-once processing without an external queue:

```sql
SELECT * FROM scheduled_jobs
WHERE status = 'pending'
  AND run_at <= NOW()
ORDER BY run_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED
```

Job types: `expire_trial`, `retry_failed_payment`, `grace_retry`, `suspend_subscription`

Stale lock recovery runs every 5 minutes. Cancelled subscriptions cancel all pending jobs in the same transaction.

---

## Seeded demo data

The production database is pre-seeded with realistic data for judges:

- **5 plans**: Basic (₦2,500) → Starter (₦5,000) → Pro (₦15,000) → Business (₦50,000) → Annual Pro (₦150,000)
- **20 customers** with Nigerian names and `.ng` email addresses
- **20 subscriptions** across all 8 states including GRACE_PERIOD and DUNNING
- **10 months of backdated ledger history** (Sep 2025 → Jun 2026) with real revenue charts
- **20 invoices** across paid, open, and void statuses
- **1 webhook endpoint** pre-registered

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

# Copy and configure environment
cp .env.example .env
# Add your Nomba TEST credentials to .env

# Start all services
docker compose up --build -d

# Apply migrations
docker exec -i tori-postgres psql -U app -d subscriptions_engine \
  -f db/migrations/000001_create_schema.up.sql
# ... apply remaining migrations in order

# Seed demo data
docker build -f Dockerfile.seed -t tori-seed .
docker run --rm --env-file .env tori-seed

# Frontend
cd frontend && npm install && npm run dev
```

### Test credentials (local)
Email:    dev@tori.ng

Password: tori-dev-2026

---

## Repository structure
cmd/

api/          — API server entrypoint

worker/       — Background worker entrypoint

seed/         — Demo data seed script

internal/

api/

handlers/   — HTTP handlers (auth, plans, customers, subscriptions,

checkout, portal, ledger, finance, health, webhooks,

api keys, invoices, nomba webhook, system health)

middleware/ — JWT auth, API key auth, request ID, rate limiting

respond/    — Consistent JSON response helpers

router.go   — Route registration, CORS, middleware chain

billing/      — Job handlers (expire trial, retry, grace retry, suspend)

Invoice generation on successful charge

cache/        — Redis client (token revocation, brute force, webhook dedup)

domain/       — Domain models, repository interfaces, sentinel errors

dunning/      — Nigerian failure classifier, retry decision engine

finops/       — MRR, ARR, churn rate, dunning recovery, revenue reporting

ledger/       — Ledger service (charge, refund, proration, trial events)

payment/      — NombaClient interface, HTTP client, mandate client, mock

postgres/     — Repository implementations (sqlc generated + manual)

scheduler/    — SKIP LOCKED job worker with stale lock recovery

subscription/ — State machine (pure Transition function, 28 unit tests)

webhook/      — Dispatcher with HMAC signing, retry, circuit breaker

db/

migrations/   — SQL migration files (000001 → 000007)

queries/      — sqlc SQL query definitions

generated/    — sqlc generated Go code

frontend/

app/          — Next.js app router pages

components/   — Shared UI components (sidebar, auth nav, live chat)

lib/          — API client with token refresh queue, utilities, docs data

config/

failure_codes.yaml — Nigerian card failure classification

---

## Architecture and security note

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full architecture and security note covering:

- System architecture and service inventory
- Database schema and key design decisions
- API surfaces (Dashboard, Platform, Portal)
- Billing state machine with full transition map
- Nigerian dunning engine with failure classification
- Authentication (JWT, API keys, brute force protection)
- Outbound and inbound webhook security
- Data handling and tenant isolation
- Infrastructure and deployment
- Nigerian market context

---

## Submission checklist

- [x] Public GitHub repository with commit history within hackathon dates
- [x] Working MVP URL — https://frontend-production-e3be.up.railway.app
- [] Demo video (2-3 minutes)
- [x] Architecture and security note — ARCHITECTURE.md
- [x] Test credentials — dev@tori.ng / tori-dev-2026

---

*Built with Go, PostgreSQL, Redis, Next.js, and Nomba — by Kingsley Chibueze for the Nomba × DevCareer Hackathon 2026.*

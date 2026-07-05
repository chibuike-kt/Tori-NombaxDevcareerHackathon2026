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

API keys: create, get hint, rotate, revoke — separate live and test keys, `POST /v1/api-keys/test` creates the sandbox-routed one.

Email templates: list all 7 supported billing events with current configuration, update one to custom or default copy, send a test send to the tenant's own address.

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

## Promo codes

In plain terms: a promo code is a discount a tenant can hand out to specific customers without touching the plan's price for everyone else.

A promo code belongs to exactly one tenant and, optionally, to one plan. Two discount types:

- `percentage` — 1 to 100. Applied against the plan's full price.
- `fixed` — a kobo amount subtracted from the plan's full price. Minimum 100 kobo.

When `promo_code` is passed to `POST /v1/platform/checkout`, Tori runs this validation chain in order:

1. Code exists for this tenant, looked up by `tenant_id` plus the code normalized to uppercase
2. `is_active` is true
3. `expires_at` is null or still in the future
4. `use_count` is below `max_uses`, if `max_uses` is set
5. The code's `plan_id` is null (applies to every plan) or matches the plan being checked out

If any check fails, checkout returns 400 with a specific error code (`invalid_promo_code`, `promo_code_inactive`, `promo_code_expired`, `promo_code_depleted`, `promo_code_plan_mismatch`) rather than silently ignoring the code and charging full price.

The discount is computed against the plan's full price and applied to the checkout-time charge, floored at 100 kobo so a subscription is never checked out for free. `use_count` increments only after the subscription is successfully created, not merely on validation.

Deactivating a code (`DELETE /v1/promo-codes/{id}`) is a soft delete: `is_active` flips to false, the row and its `use_count` history stay. There is no hard delete from the API or the dashboard.

See the Known behaviors section below for the trial-plan edge case: the discount is validated and the redemption is counted against `use_count`, but the ₦1 trial verification charge itself is never discounted, because that charge was never the real price to begin with. The real, discounted price would need to apply at trial end, and that is not wired up yet.

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

## Subscription transition audit trail

In plain terms: every time a subscription's status changes, Tori writes down what it was, what it became, why, and when, so the full history of any subscription can be reconstructed without digging through logs.

The `subscription_transitions` table records one row per status change: `subscription_id`, `tenant_id`, `from_status`, `to_status`, `reason`, `actor`, `created_at`. It is written automatically inside the repository layer, not by each individual handler, so a state change made through `UpdateStatus` or `UpdateAfterRenewal` is recorded no matter which code path triggered it: a webhook, a background job, or an operator action.

`reason` is `status_update` for a direct status change and `renewal` for a billing cycle renewal. `actor` is `system` for anything triggered by a webhook or a background job. There is no operator-attributed actor yet, since most transitions happen without a human in the loop.

`GET /v1/subscriptions/{id}/transitions` returns this history, newest first. The dashboard's subscription detail page renders it as a timeline. History only exists from the day this feature shipped forward; older transitions were never backfilled.

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

When a customer accidentally pays by bank transfer, there is no card to tokenise, so the `payment_success` webhook arrives with no `tokenKey`. Tori still activates the subscription and records the invoice and ledger entry — the customer paid, so they get access. This is important: a transfer-paying customer is never left stuck in PENDING_PAYMENT.

However, because there is no stored token, Tori cannot silently charge the customer when the subscription renews. At the next billing cycle the tokenised charge has nothing to charge against, so the renewal fails and the subscription enters the normal dunning flow. The `dunning.started` webhook fires to the developer's server, which is the signal to prompt the customer to pay again — either by generating a fresh checkout link via `POST /v1/platform/subscriptions/{id}/checkout` or by asking them to add a card.

### Design rationale

This is deliberate. Forcing card-only payment would exclude the large segment of Nigerian customers who prefer bank transfer. Allowing transfer payment but being honest that it cannot auto-renew is better than silently failing or refusing the payment. The dunning flow already exists to handle "we could not charge this customer" — a transfer-paid renewal is just another instance of that, and the developer is notified through the same webhook they already handle.

For products that require guaranteed auto-renewal, the recommendation is to enable only card payments on the checkout by passing `allowedPaymentMethods: ["Card"]` when creating the checkout, so every subscriber has a tokenised card from the start.

---

## Test/live mode

In plain terms: every tenant gets two API keys. One talks to real Nomba and moves real money. The other talks to Nomba's sandbox and never does, no matter what.

Each tenant has at most one `live` key and one `test` key at a time, stored as separate rows in the `api_keys` table (`tenant_id`, `mode`, `key_hash`, `key_hint`). `APIKeyAuth` middleware resolves the tenant from whichever key hash matches and stamps the request context with that key's `mode`.

`ModeAwareClient` wraps two underlying Nomba HTTP clients: one built against production credentials (`NOMBA_CLIENT_ID` / `NOMBA_CLIENT_SECRET`), and one built against sandbox credentials (`NOMBA_TEST_CLIENT_ID` / `NOMBA_TEST_CLIENT_SECRET`) with the base URL forced to Nomba's sandbox regardless of the server's own `NOMBA_ENV` setting. Every call through `payment.NombaClient`, checkout, charge, refund, transaction listing, is routed to whichever underlying client matches the mode on the request context. A `tori_test_...` key on `X-API-Key` always resolves to `mode: test` and always hits `sandbox.nomba.com`. A `tori_live_...` key always resolves to `mode: live` and always hits `api.nomba.com`. JWT-authenticated dashboard requests and background jobs carry no API key, so they default to `live`.

Both keys are generated automatically at tenant registration. Revoking one (`DELETE /v1/api-keys/{mode}`) does not affect the other. The dashboard's Live/Test toggle in the header only changes what the operator dashboard displays. It has no effect on which key a deployed server actually uses, since that is determined entirely by which key is present on the request, not by any flag in the request body.

### Sandbox webhook simulation

In plain terms: Nomba's sandbox does not reliably fire a `payment_success` webhook back to Tori, so without help a test-mode checkout would sit in `PENDING_PAYMENT` forever and a developer could never actually see their integration activate.

When a checkout is created with a `tori_test_` key, the checkout handler enqueues a `simulate_webhook` job scheduled 3 seconds in the future, right after the real Nomba sandbox checkout session is created. The job carries `subscription_id`, `tenant_id`, `amount_kobo`, `plan_name`, and `customer_email` — the same fields a real `payment_success` webhook would need. `Handlers.SimulateWebhook` then runs the identical activation path a real webhook would trigger: it generates a fake `tok_test_<8 random hex bytes>` token via `crypto/rand`, stores it on the subscription, moves the subscription from `PENDING_PAYMENT` to `ACTIVE`, creates the invoice, records the ledger `CHARGE` entry, and fires the same `subscription.activated` and `payment.succeeded` outbound webhooks a live tenant integration would receive.

This only runs when the checkout's API key resolves to `mode: test` on the request context — a `tori_live_` checkout never enqueues this job, and nothing distinguishes a simulated activation from a real one in the database except the `tok_test_` prefix on the stored token. The worker logs the fixed message `billing: simulating payment_success webhook for test mode checkout` so this behavior is always visible and searchable in logs, not a silent shortcut.

---

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

## Recovery ladder

In plain terms: when a charge fails, Tori does not retry the same card forever. It tries the card a couple of times, then tries a bank mandate if the customer has one, then stops automating and asks a human to collect payment manually.

The escalation is tracked per subscription in the `recovery_rail` column (`card`, `mandate`, or `manual`):

1. **Card, dunning attempts 1 and 2.** Retry the stored `tokenKey` on the normal payday-aligned schedule (Day 3, Day 7).
2. **Direct debit mandate, attempt 3 onward, only if a mandate exists on the subscription.** The worker type-asserts the payment client against `payment.MandateCharger` and calls `DebitMandate` instead of the card charge. If no mandate exists, the schedule keeps retrying the card.
3. **Manual pay link, once card and mandate retries are exhausted, or as a direct operator action.** `recovery_rail` flips to `manual`, and Tori fires a `payment.action_required` webhook carrying a fresh checkout link. The subscription stops auto-retrying; recovery now depends on the customer paying through that link or the developer prompting them directly.

An operator can short-circuit this from the Recovery Command Center: `POST /v1/subscriptions/{id}/retry-now` queues an immediate retry instead of waiting for the next scheduled attempt, and `POST /v1/subscriptions/{id}/send-pay-link` jumps straight to the manual rail regardless of attempt count.

`GET /v1/finance/recovery-center` aggregates every non-healthy subscription into three buckets: `at_risk` (GRACE_PERIOD or PAST_DUE), `recovering` (DUNNING), and `recovered` (came back to ACTIVE within the reporting window), each with the amount at stake and the current recovery rail.

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

## Session management

In plain terms: every login is tracked as a session with a device fingerprint. Kicking a session out kills it immediately, not whenever its token happens to expire on its own.

A random session ID is generated at login and embedded in both the access token and the refresh token as a JWT claim (`session_id`). Session metadata (`ip_address`, `user_agent`, `created_at`, `last_seen_at`) is stored in Redis under a per-tenant key, alongside a Redis set index (`session_index:{tenant_id}`) so all of a tenant's sessions can be listed without scanning the whole keyspace.

`JWTAuth` middleware checks session liveness on every request, not just at login: it extracts `session_id` from the token and rejects the request if that session no longer exists in Redis, even if the token itself has not expired yet. The same check runs on `POST /v1/auth/refresh`. This is what makes revocation instant instead of "instant once the 15-minute access token expires."

Tokens issued before this feature existed carry no `session_id` claim. Those are let through rather than force-logging out every existing session on deploy.

`GET /v1/auth/sessions` lists a tenant's active sessions, newest-active first, with the caller's own session flagged `is_current`. `DELETE /v1/auth/sessions/{id}` deletes the session record; the next request that presents that session's tokens finds it gone and is rejected.

---

## Team management

In plain terms: an account is no longer just one login. A tenant can invite teammates, give each one a role, and see everything they do.

Three tables: `members` (one row per person who can log into a tenant's workspace, with a `role` of `owner`, `admin`, `developer`, or `viewer`), `invitations` (pending invites with a random token and a 72-hour expiry), and `audit_log` (one row per admin action: invite sent, role changed, member removed).

The tenant's own account is itself a `members` row with role `owner`, backfilled automatically for tenants that existed before this feature shipped. `POST /v1/team/members/invite` creates an invitation row and emails a link to `/accept-invite?token=...`. Accepting the invite (`POST /v1/team/invitations/accept`, public, no auth required) creates the `members` row, hashes the submitted password, and marks the invitation used.

Login checks the `tenants` table first, the account owner path. If no tenant matches the email, it falls back to a cross-tenant lookup on `members` by email, and issues a JWT scoped to that member's `tenant_id`. An invited teammate logs in through the exact same `POST /v1/auth/login` endpoint as the owner; there is no separate member login endpoint.

Every invite, role change, and removal writes a row to `audit_log` with the actor's email, the action, the target, the IP address, and a timestamp, surfaced at `GET /v1/team/audit-log`.

---

## Merchant email templates

In plain terms: a merchant's own customers get billing emails too — a welcome email when their subscription activates, a receipt when a charge succeeds, a warning when one fails — branded to the merchant's product, not Tori's.

The `email_templates` table (one row per `tenant_id` + `event_type`, unique together) lets a tenant either accept Tori's default copy for an event or write their own subject and HTML body. Seven event types are supported: `subscription.activated`, `payment.succeeded`, `payment.failed`, `dunning.started`, `payment.action_required`, `subscription.cancelled`, and `trial.ending_soon`. Each row also carries `is_enabled`, so a merchant can turn an event's email off entirely without deleting their customization.

Default templates live in `internal/email/merchant_templates.go` as Go functions, not database rows — a tenant who never touches this feature still gets branded, correctly-formatted emails from day one. All seven share a `merchantShell` wrapper that headers the email with the *tenant's own product name*, not "Tori", and footers it "Powered by Tori" — the customer receiving the email should recognize the product they signed up for, not the billing infrastructure behind it. Custom templates support six placeholders via `strings.NewReplacer`: `{{customer_email}}`, `{{plan_name}}`, `{{amount}}`, `{{next_billing_date}}`, `{{pay_link}}`, `{{product_name}}`.

`GET /v1/email-templates` returns all seven events with their current configuration in one call — customized events show `use_default: false` with the tenant's own subject/body, everything else shows Tori's default rendered with sample data so the response is always preview-ready. `PUT /v1/email-templates/{event_type}` saves a customization or reverts to default. `POST /v1/email-templates/{event_type}/test` sends whichever version is currently active to the tenant's own account email, so they can proof it before it goes out to a real customer.

Delivery is wired into the same place every other outbound side effect lives: `webhook.Dispatcher.Dispatch()`. A `WithMerchantEmail(...)` builder method (mirroring the `WithEmailTemplates(...)` pattern on `billing.Handlers`) adds customer/subscription/plan/tenant lookups and an email client to the dispatcher without changing its required constructor signature. After every dispatch, `maybeSendMerchantEmail` checks whether the event type is one of the six dispatcher-driven events (`trial.ending_soon` is excluded — it has no webhook event and is handled entirely by its own scheduled job, described below), extracts `customer_id` from the event's generic payload via a JSON round-trip, and sends the configured or default template if the tenant hasn't disabled that event.

### Trial ending soon notification

A trial subscription enqueues a `trial_ending_soon` job at checkout time, scheduled for exactly 3 days before `trial_end` — right alongside the existing `expire_trial` job that fires the real charge at `trial_end` itself. If a trial is shorter than 3 days, the warn time lands in the past and the job simply runs on the worker's next poll instead of waiting.

`Handlers.TrialEndingSoon` looks up the tenant's `trial.ending_soon` template configuration once, before doing anything else, and captures the result in a `hasCustomTemplate` bool immediately — this was deliberate after a bug caught by `go vet` during development, where reusing the same `err` variable across several subsequent `GetByID` calls meant the template lookup's error state was silently overwritten by the time it was checked, and a tenant with no customization (the common case) would nil-pointer panic. It sends the tenant's custom copy or Tori's default warning the customer their trial is ending and a real charge is coming, using the same `MerchantEmailVars` and `DefaultMerchantTemplate`/`RenderMerchantTemplate` machinery as every other merchant email.

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
| `simulate_webhook` | 3 seconds after a test-mode checkout | Simulates Nomba's payment_success webhook — activates subscription, creates invoice, records ledger entry, fires outbound webhooks, exactly like a real webhook would |
| `trial_ending_soon` | 3 days before trial_end | Sends the tenant's configured (or default) trial-ending-soon email to the customer |

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
## Known behaviors and design decisions

Every system has boundaries. These are the deliberate design decisions and known limitations in Tori, documented so operators and reviewers understand exactly how the system behaves at its edges.

### Cancellation is always at period end for customers

When a customer cancels — whether through the self-service portal or when a developer calls the cancel endpoint without `immediate: true` — the subscription is flagged `cancel_at_period_end` and keeps ACTIVE status until `current_period_end`. Access continues for the period the customer already paid for. A scheduled job moves the subscription to CANCELLED at period end, and no renewal charge fires. This matches how Stripe, Paddle, and every mature billing platform handle cancellation. Only an explicit `immediate: true` (operator force-cancel) revokes access immediately.

When a cancellation is scheduled, all pending dunning and grace-retry jobs for that subscription are skipped — a cancelling customer is never charged again.

### Bank transfer payments cannot auto-renew

Nomba's hosted checkout accepts both card and bank transfer. Card payments return a `tokenKey` that Tori stores for automatic recurring charging. Bank transfer payments have no token. Tori still activates the subscription and records the payment — the customer paid, so they get access — but at renewal there is no token to charge. The renewal fails into the normal dunning flow, and the `dunning.started` webhook signals the developer to prompt the customer for a card. Products requiring guaranteed auto-renewal should restrict checkout to card only via `allowedPaymentMethods: ["Card"]`.

### Trial verification uses a ₦1 non-refundable charge

Trial plans tokenise the customer's card with a ₦1 verification charge rather than the full plan amount. The card is tokenised so the full amount can be charged automatically when the trial ends. The ₦1 charge is intentionally non-refundable — Nomba's refund API does not currently support card transaction refunds, and ₦1 is a negligible, industry-standard verification cost. The value that matters is the stored token, not the ₦1.

### Proration assumes same-interval plan changes

Mid-cycle plan changes are prorated by computing the daily rate of both the old and new plan against the current billing period, crediting unused days on the old plan and charging remaining days on the new plan. This is exact for plan changes within the same billing interval (monthly to monthly, annual to annual), which is the overwhelming majority of real plan changes. Cross-interval changes (monthly to annual) are a known edge case where the simplification slightly understates the annual plan's daily value; for those, starting a fresh billing period is the cleaner approach.

### Nomba webhook verification is fail-open without a configured secret

Inbound Nomba webhook signature verification is enforced only when `NOMBA_WEBHOOK_SECRET` is configured. If the secret is not set, signatures are not checked and webhooks are accepted — a fail-open design chosen so local development and sandbox testing are not blocked by signature setup. In production the secret is always configured, so every inbound webhook is cryptographically verified with HMAC-SHA256 and exact Nomba field ordering. Duplicate webhooks are rejected by `requestId` deduplication with a 24-hour Redis TTL regardless of signature configuration.

### Portal tokens expire after one hour with no refresh

Customer self-service portal tokens are scoped JWTs valid for one hour. There is no refresh mechanism — a customer whose token expires mid-session must be issued a new one by the developer. For a hackathon demo this is acceptable; a production deployment would add a refresh flow or lengthen the token lifetime.

### Resend's sandbox restricts merchant emails to the account owner's address

Merchant email templates, trial-ending-soon notices, and test-mode webhook simulation all send real emails through Resend. Until a tenant verifies their own sending domain with Resend, Resend's API only delivers to the email address that owns the Resend account — sending to an arbitrary customer address returns a 403. This is a Resend account restriction, not a Tori bug: in production, a merchant who verifies their domain can send merchant emails to any customer address. During development and demos, this surfaces as merchant emails "succeeding" on the Tori side (the send was attempted and logged) but not actually landing for test customer addresses outside the verified domain.

### Promo codes on trial plans are validated but not applied to the ₦1 verification charge

A promo code passed to checkout is validated and its redemption is counted against `use_count` even for a trial plan. What it does not do is discount the ₦1 trial verification charge, because that charge was never the real price, it exists only to tokenise the card. The real, discounted price would need to apply when the trial ends and the full plan amount is charged via the `ExpireTrial` job, and that job does not currently know a discount was ever redeemed for this subscription. Wiring the discount through to that later charge would need the subscription to persist its own discounted amount, which is a schema change beyond what shipped. For no-trial plans, where checkout is the real first charge, the discount applies in full.

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
| Session tracking | session_id claim in every JWT, Redis-backed record with IP/user agent, instant revocation checked on every request |
| API key storage | SHA-256 hash only, full key shown once, separate live and test keys per tenant |
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

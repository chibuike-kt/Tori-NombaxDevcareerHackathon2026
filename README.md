# Tori

A recurring billing engine built natively on Nomba's payment infrastructure. One API call starts a subscription. Everything after that (tokenized renewals, Nigerian-aware dunning, recovery escalation, a provable financial ledger) runs without another line of billing code on the integrator's side.

> Built for the **Nomba × DevCareer Hackathon 2026** by Kingsley Chibueze ([@chibuike_kt](https://twitter.com/chibuike_kt))

[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Go](https://img.shields.io/badge/Go-1.26-00ADD8?style=flat&logo=go)](https://go.dev)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?style=flat&logo=postgresql)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis)](https://redis.io)
[![Railway](https://img.shields.io/badge/Deployed-Railway-7B2FBE?style=flat)](https://railway.app)
[![Built on Nomba](https://img.shields.io/badge/built%20on-Nomba-00B37E?style=flat)](https://nomba.com)

---

## What this is

Every Nigerian SaaS product that charges customers monthly rebuilds the same layer: a state machine for subscription status, a retry system for failed charges, an invoice and ledger to prove what was billed, and a webhook system to tell the rest of the product what happened. None of that is specific to any one business, and all of it is easy to get subtly wrong. Card failures in Nigeria are not the exception either. A meaningful share of renewal charges decline on the first attempt, for reasons that have nothing to do with whether the customer still wants the product: the salary that funds the card hasn't landed yet, the bank blocked online transactions on the card by default, or the issuer's systems are down for an hour. A billing system that treats all three the same way, retrying on a fixed schedule regardless of cause, either gives up on customers who would have paid three days later or keeps hammering a card that will never work.

Tori is that layer, built once, on top of Nomba. A product calls `POST /v1/platform/checkout` with a customer email and a plan ID and gets back a Nomba hosted checkout URL. From that point, Tori owns the subscription's entire lifecycle: it tokenizes the card on first payment, charges that token automatically on every renewal, classifies why a charge failed using the same failure codes Nomba returns, and escalates recovery through a ladder (card retry, then a direct debit mandate if one exists, then a manual pay link) instead of retrying blindly. Every charge, refund, and adjustment writes one row to an append-only ledger that MRR, ARR, and churn are computed from directly, not estimated from whatever the subscription table currently says. The integrating product gets subscription lifecycle management, Nigerian-aware dunning, tokenized recurring charging, and a ledger it can hand to an accountant, for the cost of one API call and a webhook handler.

---

## Live demo

| | |
|---|---|
| **Dashboard** | https://frontend-production-e3be.up.railway.app |
| **API base URL** | https://api-production-3847.up.railway.app |
| **Demo login** | `dev@tori.ng` / `tori-dev-2026` |
| **Docs** | https://frontend-production-e3be.up.railway.app/docs |
| **OpenAPI spec** | https://frontend-production-e3be.up.railway.app/openapi.json |
| **Health check** | https://api-production-3847.up.railway.app/v1/status (no auth required) |
| **ClassPay demo** | Not publicly deployed. It's a real, separate integration app; see [ClassPay integration demo](#classpay-integration-demo) below for the actual code and how to run it locally. |

---

## The billing problem in Nigeria

A card renewal failing is the normal case, not the edge case, and it fails for reasons a generic Stripe-style retry loop does not model.

**Salaries land on specific days, and cards decline until they do.** A customer whose subscription renews on the 3rd of the month, three days before payday, will decline on the first attempt every single cycle, not because they churned but because the money isn't in the account yet. A retry schedule built for the US market (exponential backoff: retry in 1 day, then 2, then 4, then 8) will have exhausted all four attempts before the salary even lands. Tori's dunning schedule retries on Day 3, 7, 14, and 21 specifically because those days straddle the payday windows most Nigerian salaries (civil service and private sector alike) land on. The Day 3 retry catches early-month pay. The Day 21 retry catches the stragglers who get paid at month end.

**A blocked card and an empty account are not the same failure, and treating them the same wastes retries.** Nigerian bank cards are commonly issued with online and international transactions disabled by default; a decline from one of these will never succeed no matter how many times it's retried, because nothing about the card's state changes between attempts. Nomba (like the wider ISO-8583 card network standard) returns a numeric response code that distinguishes this from a temporary decline: code 51 (insufficient funds) is fundamentally different from code 62 or 57 (card blocked) or 41/43 (stolen or lost card). Tori classifies every failure through `config/failure_codes.yaml` at startup and only retries the ones that can plausibly resolve on their own. A blocked card moves straight to `SUSPENDED`. Insufficient funds gets four scheduled chances, aligned to payday.

**The arithmetic makes the cost of getting this wrong concrete.** Take a product with 1,000 subscribers on a ₦10,000/month plan and a 10% renewal failure rate, which is a realistic number for a market where card failures are structural rather than exceptional. That is ₦1,000,000 in monthly recurring revenue, and ₦100,000 of it fails to collect on the first attempt every cycle. A system with no grace period and no payday alignment writes that off as churn. A system that retries once, silently, 48 hours later and then again on the actual payday windows recovers a meaningful share of it automatically, with no support ticket and no manual chasing. That gap, between "wrote it off" and "collected it three days later," is the entire reason Tori's dunning engine exists.

---

## What Tori ships

### Subscription lifecycle

The subscription lifecycle is governed by a 9-state machine: `PENDING_PAYMENT`, `TRIALING`, `ACTIVE`, `GRACE_PERIOD`, `PAST_DUE`, `DUNNING`, `PAUSED`, `SUSPENDED`, `CANCELLED`. The implementation is a single pure function in `internal/subscription/state_machine.go`:

```go
func Transition(current domain.SubscriptionStatus, event Event) (domain.SubscriptionStatus, error)
```

It takes the current status and a named event (`renewal_failed`, `grace_retry_succeeded`, `retries_exhausted`, and 16 others), and returns the next status or an error if that transition isn't valid from that state. It has no database calls, no HTTP calls, and no side effects; it's a lookup against a `map[SubscriptionStatus]map[Event]SubscriptionStatus` defined once at the top of the file. Every handler that changes a subscription's status calls `Transition` first and aborts the write if it returns an error, so an invalid transition (a `CANCELLED` subscription being charged, an `ACTIVE` subscription jumping straight to `TRIALING`) is caught before anything touches the database, not after. The function is covered by 50 passing test cases across 6 test functions: every valid transition, every invalid transition, terminal-state behavior (nothing transitions out of `CANCELLED`), the full dunning retry loop, error-context population, and the `PENDING_PAYMENT` checkout flow specifically.

Every status change is also written to a `subscription_transitions` table (`from_status`, `to_status`, `reason`, `actor`, `created_at`), and this happens inside the repository layer rather than in each individual handler, so it fires no matter which code path triggered the change: a webhook, a background job, or an operator clicking a button in the dashboard. `GET /v1/subscriptions/{id}/transitions` returns the full history for a subscription, newest first.

Cancellation defaults to end-of-period, not immediate. When a customer cancels through the self-service portal, or a developer calls the cancel endpoint without `immediate: true`, the subscription is flagged `cancel_at_period_end` and stays `ACTIVE` until `current_period_end`, at which point a scheduled job completes the cancellation. No renewal charge fires in that window, and every pending dunning or grace-retry job for that subscription is skipped the moment the flag is set, because a customer who has already cancelled should never see another charge attempt.

Every entry in the transition map below is a real key in the `transitions` map in `state_machine.go`. There is no state or event combination reachable in the running system that isn't one of these rows:

| From | Event | To |
|---|---|---|
| `PENDING_PAYMENT` | `checkout_payment_succeeded` | `ACTIVE` |
| `PENDING_PAYMENT` | `checkout_payment_failed` | `PAST_DUE` |
| `PENDING_PAYMENT` | `checkout_abandoned` | `PAST_DUE` |
| `PENDING_PAYMENT` | `customer_cancelled` / `tenant_cancelled` | `CANCELLED` |
| `TRIALING` | `trial_payment_succeeded` | `ACTIVE` |
| `TRIALING` | `trial_payment_failed` | `PAST_DUE` |
| `TRIALING` | `trial_cancelled` | `CANCELLED` |
| `ACTIVE` | `renewal_failed` | `GRACE_PERIOD` |
| `ACTIVE` | `customer_paused` | `PAUSED` |
| `ACTIVE` | `customer_cancelled` / `tenant_cancelled` | `CANCELLED` |
| `GRACE_PERIOD` | `grace_retry_succeeded` | `ACTIVE` |
| `GRACE_PERIOD` | `grace_retry_failed` / `grace_expired` | `PAST_DUE` |
| `GRACE_PERIOD` | `customer_cancelled` / `tenant_cancelled` | `CANCELLED` |
| `PAST_DUE` | `retry_succeeded` | `ACTIVE` |
| `PAST_DUE` | `retry_failed_retriable` | `DUNNING` |
| `PAST_DUE` | `retry_failed_non_retriable` | `SUSPENDED` |
| `DUNNING` | `retry_succeeded` | `ACTIVE` |
| `DUNNING` | `retry_failed_retriable` | `DUNNING` (stays, next attempt scheduled) |
| `DUNNING` | `retries_exhausted` | `SUSPENDED` |
| `PAUSED` | `customer_resumed` | `ACTIVE` |
| `PAUSED` | `customer_cancelled` | `CANCELLED` |
| `SUSPENDED` | `manual_recovery` | `ACTIVE` |
| `SUSPENDED` | `customer_cancelled` / `tenant_cancelled` | `CANCELLED` |
| `CANCELLED` | (none) | terminal, every event returns `ErrTerminalState` |

Any event not listed for a given state returns a `TransitionError` carrying the current state, the attempted event, and the list of events that *were* valid from there, which is what a developer actually needs to debug a rejected transition rather than a bare "invalid transition" string.

### Nigerian dunning engine

When a renewal charge fails on an `ACTIVE` subscription for the first time, Tori does not immediately start dunning. It enters a 48-hour `GRACE_PERIOD` and retries once, silently: no webhook to the developer, no email to the customer, no visible disruption. This one design decision (in `internal/dunning/engine.go`, `Decide()`) exists because the single most common Nigerian card failure, insufficient funds, frequently clears on its own within two days without the customer doing anything. Retrying silently first means the majority of "failures" never become visible dunning events at all.

If the grace retry also fails, the subscription moves to `PAST_DUE` and the payday-aligned schedule takes over: retries at Day 3, 7, 14, and 21. This is not exponential backoff. It's a schedule built around when Nigerian salaries actually land, and it's configurable per tenant via `PATCH /v1/dunning-config` (`retry_intervals_days`, `max_attempts`, `suspension_action`).

Every failure is classified before Tori decides whether to retry at all. `config/failure_codes.yaml` maps Nomba/ISO-8583 response codes into `RETRIABLE` or `NON_RETRIABLE`:

| Code | Meaning | Category |
|---|---|---|
| `insufficient_funds` (51) | Funds not yet available | RETRIABLE |
| `issuer_unavailable` (91, 96) | Bank system outage | RETRIABLE |
| `processing_error` (06, 12, 34) | Transient processor fault | RETRIABLE |
| `timeout` (68) | Network timeout | RETRIABLE |
| `card_blocked` (62, 57, 36) | Card disabled for this transaction type | NON_RETRIABLE |
| `card_expired` (54) | Past expiry | NON_RETRIABLE |
| `stolen_card` (41, 43) | Fraud indicator | NON_RETRIABLE |

A `NON_RETRIABLE` code moves the subscription straight to `SUSPENDED`, regardless of attempt count. Retrying a stolen card is not just wasted effort; it's a fraud signal Tori chooses not to ignore.

### Recovery ladder

A failed retry doesn't keep hitting the same card forever. `Handlers.attemptRecoveryCharge` in `internal/billing/handlers.go` escalates through three rails, tracked per subscription in a `recovery_rail` column (`card`, `mandate`, or `manual`):

1. **Attempts 1 and 2: the tokenized card.** Same `ChargeToken` call used for every normal renewal.
2. **Attempt 3 onward: a direct debit mandate, if one exists.** The handler type-asserts the payment client against a `payment.MandateCharger` interface and calls `DebitMandate` instead of the card charge. If no mandate was ever created for this subscription, the schedule keeps retrying the card rather than failing outright.
3. **Manual pay link, once both automatic rails are exhausted.** `recovery_rail` flips to `manual`, Tori generates a fresh Nomba checkout URL, and fires a `payment.action_required` webhook carrying that link. Automatic recovery stops here; the developer (or the customer, directly) has to act.

An operator can short-circuit any of this from the dashboard: `POST /v1/subscriptions/{id}/retry-now` queues an immediate retry instead of waiting for the next scheduled attempt, and `POST /v1/subscriptions/{id}/send-pay-link` jumps straight to the manual rail regardless of attempt count. `GET /v1/finance/recovery-center` (the Recovery Command Center) buckets every non-healthy subscription into `at_risk` (`PAST_DUE`, not yet retrying), `recovering` (`DUNNING` with a retry scheduled), and `recovered` (back to `ACTIVE` with dunning history), each with the amount at stake and the current rail.

### Financial ledger

`ledger_entries` is append-only. There is no `UPDATE` and no `DELETE` query against this table anywhere in the codebase, on purpose: financial history that can be silently edited isn't auditable, and a bug that corrupts a subscription's status should never be able to corrupt the record of what was actually charged. Seven entry types cover every money movement: `CHARGE`, `REFUND`, `PRORATION`, `CREDIT`, `TRIAL_START`, `TRIAL_END`, `ADMIN_OVERRIDE`.

Every entry carries an `idempotency_key` with a `UNIQUE NOT NULL` constraint enforced by PostgreSQL, not just checked in application code. A job handler retried after a crash, or a webhook delivered twice by Nomba, generates the same deterministic key (`retry-card-{sub_id}-{attempt}`, `trial-charge-{sub_id}`) and the second write hits a unique constraint violation instead of silently duplicating the charge. Double-billing a customer because a job retried is not a bug class Tori can have, because the database itself refuses the write.

MRR, ARR, churn rate, and net revenue are computed by aggregating this ledger (`internal/finops/service.go`), not by reading whatever the `subscriptions` table currently reports. If the ledger and the subscription state ever disagree, the ledger is correct by construction, because it's the only thing nothing ever edits.

### Nomba integration

Every Nomba API relevant to recurring billing is integrated, not just the checkout call:

| Nomba endpoint | Used for |
|---|---|
| `POST /v1/checkout/order` | Every new subscription, with `tokenizeCard: true` |
| `POST /v1/checkout/tokenized-card-payment` | Every renewal and every dunning retry |
| `POST /v1/checkout/refund` | Manual operator refunds |
| `POST /v1/direct-debits` | Creating a mandate (recovery ladder rail 2) |
| `POST /v1/direct-debits/{id}/debit` | Charging an existing mandate |
| `GET /v1/transactions/accounts/{id}` | Nightly reconciliation |
| `POST /v1/auth/token/issue` | OAuth2, cached in memory, refreshed 5 minutes before expiry |

The OAuth2 token is fetched once and reused across every request until it's within 5 minutes of expiring, so a busy worker doesn't re-authenticate on every single API call. `orderReference` on every checkout is set to the subscription's own UUID, which means the `payment_success` webhook can be matched back to the exact subscription it belongs to with a direct lookup, no separate mapping table required.

Inbound webhooks are verified with HMAC-SHA256 using Nomba's exact field ordering (`eventType:requestId:userId:walletId:transactionId:type:time:responseCode:timestamp`, joined with colons, base64-encoded), and deduplicated by `requestId` through a 24-hour Redis TTL, so a webhook Nomba retries doesn't get processed twice.

Test and live traffic are routed by key prefix, not by an environment flag. A `tori_test_` key always resolves to Nomba's sandbox; a `tori_live_` key always resolves to production. `payment.ModeAwareClient` wraps two fully separate `NombaClient` instances (one built against `NOMBA_CLIENT_ID`/`NOMBA_CLIENT_SECRET`, one against `NOMBA_TEST_CLIENT_ID`/`NOMBA_TEST_CLIENT_SECRET`) and picks between them per request based on which key authenticated it:

```go
func (c *ModeAwareClient) pick(ctx context.Context) NombaClient {
    if c.mode(ctx) == "test" {
        return c.test
    }
    return c.live
}
```

Every method on the client (`InitiateCheckout`, `ChargeToken`, `RefundPayment`, `ListTransactions`) delegates through `pick`, so there's no branching in any handler; the handler calls the interface, and the correct environment is already resolved by the time the call reaches it. A developer testing an integration with a `tori_test_` key can never accidentally hit production, no matter what the server's own `NOMBA_ENV` is set to.

Nightly reconciliation fetches every successful Nomba transaction for the account and matches it against the ledger by `merchantTxRef`, paginating with a hard cap of 20 pages and same-cursor detection to guarantee the loop terminates even if Nomba's pagination misbehaves. Each run writes one `reconciliation_runs` row: `matched`, `missing_in_ledger` (Nomba has a charge with no corresponding ledger entry, usually a webhook that never arrived), and `amount_mismatch` (both exist, kobo amounts differ).

Inbound signature verification reconstructs Nomba's exact signed string and compares it with a constant-time comparison, not a naive `==`, so a timing attack against the comparison itself isn't a viable way to forge a webhook:

```go
hashPayload := strings.Join([]string{
    payload.EventType, payload.RequestID,
    data.Merchant.UserID, data.Merchant.WalletID,
    data.Transaction.TransactionID, data.Transaction.Type,
    data.Transaction.Time, responseCode, timestamp,
}, ":")

mac := hmac.New(sha256.New, []byte(secret))
mac.Write([]byte(hashPayload))
expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))
return hmac.Equal([]byte(expected), []byte(signature))
```

Verification is enforced whenever `NOMBA_WEBHOOK_SECRET` is set, which is always true in production. If it's unset (local development, before a developer has bothered to configure a webhook secret), verification is skipped rather than blocking every inbound webhook, a deliberate fail-open chosen so sandbox testing isn't gated on signature setup. `requestId` deduplication through Redis runs regardless of whether a secret is configured, so a duplicate webhook is never processed twice either way.

### Platform API

`POST /v1/platform/checkout` is the entire integration surface for a new signup: an email, a plan ID, and Tori finds or creates the customer, starts the subscription, opens a Nomba checkout session, and returns the URL to redirect to. It's idempotent via an `idempotency_key` field, so a network retry on the integrator's side returns the original subscription instead of creating a duplicate. Every mutating Platform API call follows the same idempotency pattern.

Promo codes attach to checkout with a single `promo_code` field: percentage or fixed-kobo discounts, optionally scoped to one plan, with `max_uses` and `expires_at`. Validation runs as an explicit chain (code exists → active → not expired → under its use limit → applies to this plan) and returns a specific error code for whichever check fails, rather than silently charging full price if something doesn't match.

`GET /v1/platform/customers/{id}/portal-token` issues a one-hour scoped JWT that lets a customer view, pause, resume, or cancel their own subscription through `/v1/portal/*` without a support ticket and without the integrator building any of that UI.

### Team management

An account stops being a single login the moment a tenant invites someone. Three tables back this: `members` (role of `owner`, `admin`, `developer`, or `viewer`), `invitations` (a random token with a 72-hour expiry), and `audit_log` (one row per invite, role change, or removal, with the actor's email, the target, and the IP address). `POST /v1/team/members/invite` creates the invitation and emails the accept link; accepting it (`POST /v1/team/invitations/accept`, public, no auth) creates the member row and hashes the submitted password. An invited teammate logs in through the same `POST /v1/auth/login` every owner uses; there's no separate member login path.

Every login is tracked as a session in Redis (`ip_address`, `user_agent`, `created_at`, `last_seen_at`), keyed by a random `session_id` embedded in both the access and refresh JWTs. `JWTAuth` middleware checks session liveness on every single request, not just at login, so revoking a session from `GET/DELETE /v1/auth/sessions` is instant: the very next request bearing that session's token is rejected, even though the JWT itself hasn't expired yet.

**Role permissions enforced at both API and UI layer:**

| Capability | Owner | Admin | Developer | Viewer |
|------------|-------|-------|-----------|--------|
| View subscriptions, customers, invoices, finance | ✓ | ✓ | ✓ | ✓ |
| Cancel, pause, resume subscriptions | ✓ | ✓ | ✗ | ✗ |
| Manage plans and promo codes | ✓ | ✓ | ✗ | ✗ |
| Manage webhooks and API keys | ✓ | ✓ | ✓ | ✗ |
| Manage team members | ✓ | ✗ | ✗ | ✗ |

Role is embedded in the JWT at login — no database hit required on the request path. `RequireRole` middleware enforces permissions on every sensitive route. The frontend gates all mutating buttons with the same permission matrix via `lib/permissions.ts`.

### Outbound webhooks

Every billing event fires a signed webhook: HMAC-SHA256 over the raw payload, sent in an `X-Tori-Signature` header, verified with a timing-safe comparison (`hmac.Equal`) rather than a naive string comparison that would leak timing information. Delivery is enqueued as a job rather than sent inline from the request path, so a slow or dead endpoint on the integrator's side never blocks the request that triggered the event; if the job can't be enqueued for some reason, delivery falls back to synchronous rather than silently dropping the event.

Failed deliveries retry at 5 minutes, 30 minutes, 2 hours, and 6 hours. After 10 consecutive failures inside 24 hours, the endpoint is automatically disabled, so a dead integration doesn't get hammered indefinitely; the tenant can re-enable it from the dashboard once it's fixed. 16 event types, defined once in `internal/domain/models.go`, cover the full lifecycle:

| Event | Fires when |
|---|---|
| `subscription.created` | A subscription starts, before any payment clears |
| `subscription.activated` | `PENDING_PAYMENT` or `TRIALING` moves to `ACTIVE` |
| `subscription.paused` / `subscription.resumed` | Customer or operator pause/resume |
| `subscription.cancelled` | Scheduled or immediate cancellation completes |
| `subscription.suspended` | Recovery ladder exhausted with no automatic rail left |
| `payment.succeeded` / `payment.failed` | Any charge attempt, renewal or dunning retry |
| `payment.retrying` | A retry has been scheduled but not yet attempted |
| `payment.action_required` | The recovery ladder reached the manual pay-link rail |
| `invoice.generated` / `invoice.paid` / `invoice.voided` | Invoice lifecycle, mirrors the ledger |
| `dunning.started` | First scheduled retry (post grace period) fires |
| `dunning.recovered` | A dunning retry succeeds and the subscription returns to `ACTIVE` |
| `dunning.exhausted` | All configured attempts failed |

### Merchant email templates

A merchant's own customers get billing emails too, branded to the merchant's product, not to Tori. Seven event types are configurable (`subscription.activated`, `payment.succeeded`, `payment.failed`, `dunning.started`, `payment.action_required`, `subscription.cancelled`, `trial.ending_soon`), each with a default template built into `internal/email/merchant_templates.go` and an optional per-tenant override stored in the `email_templates` table. Every default shares a `merchantShell` wrapper that headers the email with the *tenant's own product name* and footers it "Powered by Tori," because the customer receiving the email should recognize the product they signed up for, not the infrastructure behind it. `POST /v1/email-templates/{event_type}/test` sends whichever version is currently active to the tenant's own address before it ever goes to a real customer.

---

## Judging criteria evidence

### State-machine completeness

| Evidence | Detail |
|---|---|
| 9 states | `PENDING_PAYMENT → TRIALING → ACTIVE → GRACE_PERIOD → PAST_DUE → DUNNING → PAUSED → SUSPENDED → CANCELLED`, defined once in `internal/domain/models.go` |
| Pure function | `internal/subscription/state_machine.go`, `Transition(status, event)`. No database calls, no HTTP calls, no side effects. A single map lookup. |
| Unit tested | 50 passing test cases across 6 functions: every valid transition, every invalid transition, terminal-state rejection, error-context population, the dunning retry loop, and the `PENDING_PAYMENT` flow specifically |
| Transition audit trail | `subscription_transitions` table, written at the repository layer so it fires regardless of which code path triggers the change; `GET /v1/subscriptions/{id}/transitions` exposes it |
| `PENDING_PAYMENT` correctness | A no-trial subscription starts `PENDING_PAYMENT`, not `ACTIVE`. It only moves to `ACTIVE` after Nomba's `payment_success` webhook is received and verified, so a customer is never granted access before the charge actually clears |

The state machine is not a helper that handlers sometimes bypass. Every status change in the codebase, whether it originates from an inbound Nomba webhook, a scheduled job, or an operator action in the dashboard, calls `Transition` first, and the write is aborted if it returns an error. There is no direct `UPDATE subscriptions SET status = ...` anywhere outside the repository methods that `Transition` gates.

### Dunning sophistication

| Evidence | Detail |
|---|---|
| Grace period | A first renewal failure on `ACTIVE` gets a silent 48-hour retry before any dunning event becomes visible to the developer or the customer |
| Payday alignment | Retry schedule at Day 3, 7, 14, 21, chosen to straddle Nigerian salary disbursement windows rather than following generic exponential backoff |
| Failure classification | ISO-8583/Nomba response codes mapped to `RETRIABLE` or `NON_RETRIABLE` in `config/failure_codes.yaml`, loaded at startup, changeable without a code deploy |
| Recovery ladder | Card (attempts 1-2) → direct debit mandate (attempt 3+, if one exists) → manual pay link with a `payment.action_required` webhook. Current rail tracked per subscription in `recovery_rail` |
| Recovery Command Center | `GET /v1/finance/recovery-center`, live in the dashboard at `/dashboard/recovery`: at-risk, recovering, and recovered subscriptions with amounts at stake |
| Per-tenant configuration | `PATCH /v1/dunning-config`: retry days, max attempts, and what happens after exhaustion are all tenant-configurable, not hardcoded |

This is not a generic retry loop with Nigerian labels on it. A card blocked for online transactions and a card with insufficient funds hit completely different code paths from the first failure: one goes straight to `SUSPENDED`, the other gets four scheduled chances timed to when the money is actually likely to arrive. A judge who has run a Nigerian payments product will recognize the difference immediately, because it's the difference between a system that was designed for this market and one that was built elsewhere and localized after the fact.

### Multi-tenant cleanliness

| Evidence | Detail |
|---|---|
| `tenant_id` scoping | Every one of the 18 tables carries `tenant_id`. Every query filters on it. The tenant ID is read from the authenticated JWT or API key context (`middleware.GetTenantID`), never from the request body, so a request can't claim to act on another tenant's data by passing a different ID in JSON |
| Test/live isolation | Separate rows per mode in `api_keys` (`tenant_id`, `mode`, `key_hash`, `key_hint`). `ModeAwareClient` routes every Nomba call to sandbox or production based on which key authenticated the request, with no environment-flag branching in handler code |
| Team roles | `owner`, `admin`, `developer`, `viewer`, enforced per tenant, with every invite, role change, and removal writing to a tenant-scoped `audit_log` |
| Session tracking | Redis-backed, keyed per tenant, with a `session_index:{tenant_id}` set so a tenant's sessions can be listed without scanning the whole keyspace. Revoking one tenant's session touches nothing belonging to any other tenant |
| API key hashing | SHA-256 hash stored, full key shown exactly once at creation. The plaintext key is never persisted, never logged |

Single-schema multi-tenancy (one `tenant_id` column per table, rather than a separate PostgreSQL schema per tenant) was a deliberate tradeoff, not an oversight; it's documented as ADR-005 in [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md). It keeps migrations and connection pooling simple at the cost of a slightly weaker isolation guarantee than schema-per-tenant, and that gap is closed by sqlc-generated queries encoding the tenant scope at compile time rather than trusting each handler to remember the `WHERE` clause.

### API ergonomics

| Evidence | Detail |
|---|---|
| One-call checkout | `POST /v1/platform/checkout`: email and plan ID in, a Nomba checkout URL out. Idempotent via `idempotency_key` |
| ClassPay integration | A real, separate Next.js app whose entire billing integration is 90 lines in `lib/tori.ts`, shown in full below, not a summary of one |
| Promo codes | A single `promo_code` field on checkout. Validated as a chain, with a specific error code per failure rather than a silent full-price fallback |
| Signed webhooks | HMAC-SHA256, `X-Tori-Signature`, documented in `/docs` with a working Node.js verification snippet a developer can paste directly into their handler |
| OpenAPI spec | `/openapi.json`, every endpoint in `router.go` documented (summary, request schema, response schema per status code, security requirement), importable straight into Postman or Insomnia |
| Customer portal token | `GET /v1/platform/customers/{id}/portal-token`: one call, one-hour scoped JWT, self-service pause/resume/cancel with zero UI the integrator has to build |

The ClassPay integration is the strongest piece of this evidence precisely because it's boring. There's no clever wrapper library, no SDK to install, just three `fetch` calls and a webhook handler that reads an event type and updates a database row. That's what "one API call" is supposed to feel like from the outside, and the 90-line file proves it rather than asserting it.

---

## Production proof

The following are real log outputs from the live Railway deployment, captured on July 1, 2026.

### Real Nomba production webhook: Verve card end to end

A real ₦100 charge on a Verve card. Nomba fired the `payment_success` webhook to Tori's live Railway endpoint. Tori activated the subscription, created the invoice, and recorded the ledger entry, all within the same webhook handler.

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

### Abandoned checkout: automatic PAST_DUE after 1 hour

A subscription where the sandbox did not deliver a webhook. After 1 hour with no `tokenKey`, the abandoned-checkout worker moved it to `PAST_DUE` and scheduled a dunning retry at Day 3.

```
worker-1 | INF billing: abandoned checkout — no tokenKey, moving to PAST_DUE
         status=PENDING_PAYMENT age=1h2m
         sub_id=56f40906-8ef7-4fc2-977a-336b75a36f24
worker-1 | INF billing: abandoned checkout moved to PAST_DUE, dunning retry scheduled Day 3
worker-1 | INF billing: abandoned checkout check complete abandoned=1
```

### Trial expiry: automatic charge via tokenized card

A `TRIALING` subscription at trial end. The worker charged the stored token for the full plan amount with zero customer interaction.

```
worker-1 | INF trial expired — charging card now sub_id=a75c0407-9992-402b-b11a-494229895cc2
worker-1 | INF nomba: charging tokenised card
         amount_kobo=250000 idempotency_key=trial-charge-a75c0407-9992-402b-b11a-494229895cc2
worker-1 | INF nomba: charge succeeded reference=trial-charge-a75c0407-9992-402b-b11a-494229895cc2
worker-1 | INF invoice created, ledger entry recorded, invoice marked paid
         amount_kobo=250000 invoice_id=6a717e90-945f-4198-9219-97b0b7e3897b
worker-1 | INF trial charge succeeded — subscription activated amount=2500.00
```

### Nightly reconciliation run

```
worker-1 | INF reconciliation: starting run
         from=2026-06-30T00:00:00Z to=2026-07-01T00:00:00Z
worker-1 | INF reconciliation: fetched Nomba transactions count=4
worker-1 | INF reconciliation: run complete
         matched=2 mismatched=0 missing=2 status=discrepancies_found
```

The 2 missing entries were sandbox transactions where Nomba processed payment but the webhook never arrived, which is exactly the discrepancy reconciliation exists to catch, not a false positive.

### Health endpoint, no authentication required

```json
{
  "status": "ok",
  "checks": { "api": "ok", "database": "ok", "nomba": "connected" },
  "database": { "total_conns": 3, "idle_conns": 3, "max_conns": 20 },
  "worker": { "queue_depth": 0 },
  "runtime": { "goroutines": 6, "heap_alloc_mb": 1.41 }
}
```

---

## Architecture

### Stack

| Layer | Technology |
|---|---|
| API server | Go 1.26, Chi v5 router |
| Background worker | Go 1.26, PostgreSQL `SKIP LOCKED` queue, 5-goroutine pool |
| Database | PostgreSQL 17, pgx/v5 driver, sqlc-generated queries |
| Cache | Redis 7 (session tracking, brute-force locks, webhook dedup) |
| Email | Resend (verification, welcome, invite, and merchant billing emails) |
| Frontend | Next.js 16.2, Tailwind CSS, React Query |
| Deployment | Railway (API, worker, frontend, managed PostgreSQL, managed Redis) |

### Services

```
Product's app
     │  HTTPS + X-API-Key
     ▼
Tori API (Go, Chi v5)
  Dashboard API (/v1/*)  ·  Platform API (/v1/platform/*)  ·  Customer Portal (/v1/portal/*)
     │                                    │
State machine                    Webhook dispatcher
Dunning engine                   HMAC-SHA256 signed
Ledger service                   Async job queue, circuit breaker
     │                                    │
     ▼                                    ▼
PostgreSQL 17                    Product's webhook endpoint
  18 tables, append-only ledger
  SKIP LOCKED job queue
Redis 7
  Sessions, brute-force locks, webhook dedup
     │
     ▼
Nomba
  /checkout/order · /checkout/tokenized-card-payment
  /checkout/refund · /direct-debits · /auth/token/issue
```

### Database

18 tables, every one carrying `tenant_id`:

```
tenants                    one row per business: name, email, dunning_config, email_verified
plans                      pricing templates: amount in kobo, interval, trial_period_days
customers                  subscribers: email, external_id (integrator's own user ID)
subscriptions              the billing relationship: customer + plan + status + token_key + recovery_rail
subscription_transitions   audit trail of every status change: from_status, to_status, reason, actor
invoices                   invoice records with the Nomba transaction reference
ledger_entries             append-only financial log, no UPDATE or DELETE path exists
scheduled_jobs             PostgreSQL-backed job queue, claimed via SKIP LOCKED
webhook_endpoints          registered delivery targets, max 5 per tenant
webhook_deliveries         delivery attempt log: payload, response, status, attempt count
reconciliation_runs        nightly Nomba-vs-ledger summaries
email_verifications        6-digit OTP codes with expiry and single-use tracking
api_keys                   one live and one test key per tenant, SHA-256 hashed
members                    team accounts: owner, admin, developer, viewer
invitations                pending team invites, 72-hour token expiry
audit_log                  one row per administrative action
promo_codes                percentage or fixed discounts, plan-scoped, use-limited
email_templates            per-tenant override of the 7 merchant billing emails
```

Amounts are `BIGINT` kobo everywhere in the schema. There is no floating-point arithmetic anywhere in the billing path; ₦15,000 is stored as `1500000`, which removes an entire class of rounding bugs before they can exist.

### Why PostgreSQL for the job queue instead of Redis or BullMQ

Trial expiry, dunning retries, webhook delivery, and reconciliation all need a durable job queue. The default choice for a lot of stacks is Redis-backed (BullMQ, Sidekiq); Tori uses PostgreSQL's `SELECT ... FOR UPDATE SKIP LOCKED` instead, on the `scheduled_jobs` table:

```sql
SELECT * FROM scheduled_jobs
WHERE status = 'pending' AND scheduled_at <= NOW()
ORDER BY scheduled_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED
```

Tori already depends on PostgreSQL for the ledger and every other piece of financial state. Adding Redis purely to run a job queue would mean a second stateful dependency with its own failure modes, its own backup story, and its own thing to monitor, for a workload (hundreds of jobs a minute, not millions) that doesn't need Redis's throughput ceiling. `SKIP LOCKED` gives exactly-once job claiming through the same row-level locking PostgreSQL already provides, and because the job queue lives in the same database as the data it operates on, a job claim and the write it produces can be reasoned about transactionally instead of as two systems that might disagree. Five goroutines poll the table concurrently (`worker.RunPool(ctx, 5)`); each one claims a different row because `SKIP LOCKED` means a locked row is invisible to competing claimants rather than something they wait on. This is documented as ADR-001 in [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md), including the tradeoff it accepts: a lower throughput ceiling than a dedicated queue, which is fine here because billing jobs are not a high-frequency workload.

10 job types are registered against the worker pool:

| Job | Fires | Does |
|---|---|---|
| `expire_trial` | At `trial_end` | Charges the stored token for the full plan amount, activates the subscription |
| `retry_failed_payment` | Payday-aligned schedule | Escalates through the recovery ladder |
| `grace_retry` | 48 hours after first failure | The silent pre-dunning retry |
| `suspend_subscription` | Dunning exhausted | Moves the subscription to `SUSPENDED` |
| `checkout_abandoned` | Daily, on worker startup | Moves stale `PENDING_PAYMENT`/`TRIALING` subs with no token to `PAST_DUE` |
| `webhook_deliver` | Every billing event | Async delivery so the request path is never blocked |
| `cancel_at_period_end` | At `current_period_end` | Completes a customer-requested cancellation |
| `simulate_webhook` | 3 seconds after a test-mode checkout | See below |
| `trial_ending_soon` | 3 days before `trial_end` | Sends the configured trial-ending-soon email |
| `reconciliation` | Nightly, on worker startup | Nomba transactions vs. ledger |

### Sandbox webhook simulation

Nomba's sandbox does not reliably fire a `payment_success` webhook back to a test integration, which without help would leave every test-mode checkout stuck in `PENDING_PAYMENT` forever. When a checkout is created with a `tori_test_` key, the checkout handler enqueues a `simulate_webhook` job 3 seconds out, carrying the same fields a real webhook would. `Handlers.SimulateWebhook` then runs the identical activation path a real webhook triggers: generates a fake `tok_test_` token, activates the subscription, creates the invoice, records the ledger charge, and fires the same outbound webhooks a live integration would receive. It only ever fires for a `tori_test_` key; a `tori_live_` checkout never enqueues this job, and nothing in the resulting database rows distinguishes a simulated activation from a real one except the `tok_test_` prefix on the stored token.

### Observability

`GET /v1/status` requires no authentication at all, on purpose, so a judge or a monitoring probe can confirm the system is actually alive without needing credentials first:

```json
{
  "status": "ok",
  "checks": { "api": "ok", "database": "ok", "nomba": "connected" },
  "database": { "total_conns": 3, "idle_conns": 3, "max_conns": 20 },
  "worker": { "queue_depth": 0 },
  "runtime": { "goroutines": 6, "heap_alloc_mb": 1.25, "num_gc": 0 }
}
```

`GET /v1/metrics`, JWT-authenticated, returns the operational picture for the calling tenant specifically: subscription counts by state, MRR, this month's gross and net revenue, charge success rate, and job queue health, in one call rather than five separate dashboard requests:

```json
{
  "subscriptions": { "total": 14, "active": 13, "by_status": { "ACTIVE": 13, "PAST_DUE": 1 } },
  "revenue": { "mrr_kobo": 5000, "gross_this_month": 422500, "net_this_month": 422500 },
  "billing": { "charge_success_rate_pct": 100, "at_risk_count": 0 },
  "worker": { "queue_depth": 0, "failed_jobs_count": 0 }
}
```

Every HTTP request is logged with method, path, status code, latency in milliseconds, response size, and a request ID, with 4xx responses at WARN and 5xx at ERROR, so a slow or failing endpoint shows up in the logs without anyone having to add instrumentation after the fact. A job that exhausts every retry attempt is logged at ERROR with its full payload rather than silently dropped, because a failed billing job that nobody sees is worse than one that's loud about failing.

---

## ClassPay integration demo

ClassPay is a real, working demo integration: a fictional Nigerian school-management SaaS wired against the live Tori API. It is not part of this repository; it lives as a separate Next.js app, built specifically to prove the integration story with real code rather than a description of one.

This is the entire billing integration ClassPay wrote, in full, 90 lines including comments (`lib/tori.ts`):

```typescript
// ClassPay's Tori integration — this is the ONLY billing code ClassPay wrote.
// Everything else (charging, retrying, dunning, reconciliation) is handled by Tori.

const TORI_API_URL = process.env.TORI_API_URL || "http://localhost:8080";
const TORI_API_KEY = process.env.TORI_API_KEY || "";

// Start a subscription for a new ClassPay school.
// Returns checkout_url to redirect the school to Nomba payment page.
export async function startSubscription(params: {
  email: string;
  name: string;
  schoolId: string;
  plan: "basic" | "pro";
  callbackUrl: string;
}) {
  const planId =
    params.plan === "pro"
      ? process.env.TORI_PLAN_PRO
      : process.env.TORI_PLAN_BASIC;

  const res = await fetch(`${TORI_API_URL}/v1/platform/checkout`, {
    method: "POST",
    headers: {
      "X-API-Key": TORI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      plan_id: planId,
      name: params.name,
      external_id: params.schoolId,
      idempotency_key: `signup_${params.schoolId}`,
      callback_url: params.callbackUrl,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to start subscription");
  }

  const { data } = await res.json();
  return {
    subscriptionId: data.subscription.id,
    checkoutUrl: data.checkout_url,
    customerCreated: data.customer_created,
    status: data.subscription.status,
  };
}

// Get a school's subscription status from Tori.
export async function getSubscription(subscriptionId: string) {
  const res = await fetch(
    `${TORI_API_URL}/v1/platform/subscriptions/${subscriptionId}`,
    { headers: { "X-API-Key": TORI_API_KEY } },
  );
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

// Generate a Tori portal token so the school can manage their billing.
export async function getPortalToken(customerId: string) {
  const res = await fetch(
    `${TORI_API_URL}/v1/platform/customers/${customerId}`,
    { headers: { "X-API-Key": TORI_API_KEY } },
  );
  if (!res.ok) return null;
  const { data: customer } = await res.json();

  const tokenRes = await fetch(
    `${TORI_API_URL}/v1/platform/customers/${customer.id}/portal-token`,
    { headers: { "X-API-Key": TORI_API_KEY } },
  );
  if (!tokenRes.ok) return null;
  const { data } = await tokenRes.json();
  return data.token;
}
```

Three functions. No retry logic, no state machine, no invoice generation, no dunning schedule, because none of that is ClassPay's problem to solve. The webhook handler that receives Tori's events and updates a school's access level is equally short:

```typescript
// ClassPay's Tori webhook handler. Tori calls this URL whenever a billing
// event happens. ClassPay reads the event and updates the school's access level.

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-tori-signature") || "";
  const secret = process.env.TORI_WEBHOOK_SECRET || "";

  if (secret && signature) {
    const expected =
      "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const { event_type, data } = JSON.parse(rawBody);
  const school = getSchoolBySubscriptionId(data?.id);
  if (!school) return NextResponse.json({ status: "school_not_found" });

  const accessMap: Record<string, string> = {
    "subscription.activated": "full",
    "dunning.recovered": "full",
    "payment.succeeded": "full",
    "dunning.started": "restricted",
    "dunning.exhausted": "suspended",
    "subscription.cancelled": "none",
  };

  if (accessMap[event_type]) {
    updateSchool(school.id, { access: accessMap[event_type] as typeof school.access });
  }

  return NextResponse.json({ status: "processed" });
}
```

Signup, pricing, checkout redirect, a success page, and a dashboard gated on the school's Tori-reported access level round out the rest of the demo app. None of it touches a card number, computes a retry schedule, or writes a ledger entry, because Tori already did.

To run it: it needs its own `.env.local` (`TORI_API_KEY`, `TORI_PLAN_BASIC`, `TORI_PLAN_PRO`, `TORI_WEBHOOK_SECRET`, `TORI_API_URL` pointing at a running Tori instance), `npm install`, `npm run dev`, and a webhook endpoint registered against that Tori tenant pointing at `/api/webhook`.

---

## Quick start

### Dashboard

Visit the [live dashboard](https://frontend-production-e3be.up.railway.app) and log in with `dev@tori.ng` / `tori-dev-2026`. The seeded account has real subscribers across every billing state, a populated ledger, and live Nomba sandbox integration, so there's nothing to configure before looking around.

### API integration

The entire signup call, using the live production API:

```bash
curl https://api-production-3847.up.railway.app/v1/platform/checkout \
  -H "X-API-Key: tori_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "amaka@startup.ng",
    "plan_id": "plan_...",
    "callback_url": "https://yourapp.ng/payment/success"
  }'
```

The response includes a `checkout_url`. Redirect the customer there, even during a free trial, so the card gets tokenized immediately. Everything after that (renewals, retries, recovery, the ledger) runs without another call from the integrating product.

### Local development

```bash
git clone https://github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026
cd Tori-NombaxDevcareerHackathon2026

cp .env.example .env
# fill in Nomba TEST credentials, a JWT_SECRET (32+ chars), and a RESEND_API_KEY

make docker-up      # Postgres, Redis, API, worker, frontend
make migrate-up      # applies all 16 migrations in order
make seed            # creates dev@tori.ng / tori-dev-2026 with sample data
make dev              # frontend at localhost:3001, or: cd frontend && npm run dev
```

Other Makefile targets worth knowing: `make smoke` runs `scripts/smoke_test.sh` against a running instance (defaults to production; set `BASE_URL` to point it at `localhost:8080` instead), `make test` runs the full Go test suite with `-race`, and `make docker-logs-worker` tails the background worker specifically, which is where dunning, trial expiry, and reconciliation activity actually shows up.

Nomba sandbox test card: `5434621074252808`, expiry `12/30`, PIN `0000`, OTP `9999` to approve.

The variables that actually gate whether the API starts, from `.env.example`:

| Variable | Required for |
|---|---|
| `DATABASE_URL` | Everything. The API refuses to start without a working PostgreSQL connection |
| `REDIS_URL` | Sessions, brute-force locks, webhook dedup |
| `JWT_SECRET` | Dashboard auth. Must be 32+ characters or the binary exits at startup |
| `NOMBA_CLIENT_ID` / `NOMBA_CLIENT_SECRET` | Live-mode Nomba calls (`tori_live_` keys) |
| `NOMBA_TEST_CLIENT_ID` / `NOMBA_TEST_CLIENT_SECRET` | Sandbox calls (`tori_test_` keys), used by `ModeAwareClient` |
| `NOMBA_WEBHOOK_SECRET` | Inbound webhook signature verification. Fail-open (skipped, not rejected) if unset |
| `RESEND_API_KEY` | Verification, welcome, invite, and merchant billing emails |
| `APP_URL` | Used to build invite links in team-invitation emails |

Every one of these is read directly by name (`os.Getenv`) in the handler or client that needs it; there's no config abstraction layer sitting between the environment and the code that uses it.

---

## Repository structure

```
cmd/
  api/              API server entrypoint
  worker/           Background worker entrypoint, registers all 10 job handlers
  seed/             Database seed script (make seed)

internal/
  api/
    handlers/       HTTP handlers: auth, plans, customers, subscriptions, checkout,
                    portal, ledger, finance, webhooks, api keys, invoices, nomba
                    webhook, refunds, team, promo codes, email templates, health
    middleware/     JWT auth, API key auth, request ID, request logger, PII masking,
                    rate limiting
    router.go       Every route: Dashboard API, Platform API, Customer Portal
  billing/          Job handlers: trial expiry, dunning retry, grace retry,
                    recovery ladder escalation, sandbox webhook simulation
  domain/           Domain models, repository interfaces, sentinel errors
  dunning/          Failure classifier and the grace-period/payday retry engine
  email/            Resend client, verification/welcome emails, the 7 merchant
                    billing email templates
  finops/           MRR, ARR, churn, revenue reports, the Recovery Command Center
  ledger/           The append-only ledger service: charge, refund, proration, credit
  payment/          NombaClient, ModeAwareClient (test/live routing), mandate client
  postgres/         Repository implementations (sqlc-generated queries underneath)
  reconciliation/   Nightly Nomba-vs-ledger reconciliation
  scheduler/        The SKIP LOCKED worker pool
  subscription/     The pure state machine. Nothing else lives in this package.
  webhook/          Outbound dispatcher: HMAC signing, async delivery, circuit breaker

db/
  migrations/       16 sequential migrations, each with a paired .down.sql
  queries/          sqlc query definitions
  generated/        sqlc-generated Go code (committed, not built at deploy time)

frontend/           Next.js dashboard, docs site, and landing page
config/
  failure_codes.yaml  Nigerian/ISO-8583 failure code classification
scripts/
  smoke_test.sh       Exercises every public, JWT, and API-key-protected endpoint
```

---

## Engineering decisions

The reasoning behind the decisions that most shape how Tori behaves is written up in full in [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md): why the job queue is PostgreSQL rather than Redis (ADR-001), why the ledger is append-only with no update path at all (ADR-002), why idempotency is enforced with a database-level `UNIQUE` constraint rather than an application-level check (ADR-003), why the state machine is a pure function with zero dependencies (ADR-004), and why multi-tenancy is a `tenant_id` column rather than a schema per tenant (ADR-005). The wider set of deliberate tradeoffs and known edges (cancellation semantics, why bank-transfer payments can't auto-renew, the ₦1 non-refundable trial verification charge, why proration assumes same-interval plan changes) is documented in [ARCHITECTURE.md](./ARCHITECTURE.md)'s "Known behaviors and design decisions" section.

## Testing

```
internal/subscription   50 test cases   the state machine: every transition, valid and invalid
internal/billing        12 test cases   job handlers: trial expiry, dunning, recovery ladder
internal/dunning         7 test cases   failure classification and retry decisions
internal/ledger          5 test cases   append-only writes, idempotency, summaries
internal/webhook         4 test cases   HMAC signing and verification
```

78 test cases across 5 packages, run with `go test ./... -race`. The state machine and the ledger, the two places where a bug would either corrupt a subscription's status or misstate what a customer was actually charged, carry the deepest coverage on purpose.

## Security

| Concern | Implementation |
|---|---|
| Passwords | Argon2id, unique random 16-byte salt per password |
| JWT | HS256, 15-minute access tokens, 7-day refresh tokens |
| Token revocation | Redis denylist on logout, keyed by `SHA256(token)`, auto-expiring |
| Session tracking | `session_id` embedded in every JWT, Redis-backed, checked on every request, not just at login |
| Brute force | 5 failed login attempts, 15-minute lockout, Redis counter per email |
| API key storage | SHA-256 hash only, full key shown once, separate live and test keys per tenant |
| Outbound webhook signing | HMAC-SHA256, `X-Tori-Signature`, timing-safe comparison |
| Inbound webhook verification | Nomba HMAC-SHA256, exact field ordering, base64 encoding |
| Webhook dedup | Redis `requestId`, 24-hour TTL |
| Multi-tenant isolation | `tenant_id` on every table and every query, sourced from auth context only |
| Concurrent writes | Optimistic locking on subscriptions via `updated_at` |
| Duplicate charges | Idempotency keys, `UNIQUE` constraint at the database level |
| Request size | 1MB body limit on all routes |
| Rate limiting | 100/min per IP (global), 300/min per tenant (JWT), 600/min per tenant (API key) |
| CORS | Named origin allowlist, no wildcard |
| Card data | Never stored. Nomba handles tokenization entirely; Tori keeps only the `tokenKey` string |

Full detail, including transport (HSTS, security headers, CSP), encryption at rest, and data retention windows per table, is in [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Known behaviors and edges

Every system has boundaries, and pretending otherwise is how a demo breaks in front of a judge. These are deliberate, not bugs waiting to be found:

**Cancellation is always end-of-period for customer-initiated requests.** A force-cancel exists (`immediate: true`) for operator use, but the default, and the only path a customer's own portal action can take, keeps access until the period they already paid for ends. This matches how every mature billing platform handles it, and it means a customer who cancels never feels like they paid for nothing.

**Bank transfer payments cannot auto-renew.** Nomba's hosted checkout accepts card or transfer. A card payment returns a `tokenKey` Tori can charge automatically forever. A transfer payment has no token, so Tori still activates the subscription (the customer paid, they get access) but the next renewal has nothing to charge against, and falls into the normal dunning flow with a `dunning.started` webhook telling the integrator to prompt for a card. Products that need guaranteed auto-renewal should restrict checkout to card only via `allowedPaymentMethods: ["Card"]`.

**Proration assumes same-interval plan changes.** Mid-cycle upgrades and downgrades are prorated by daily rate against the current period, which is exact for monthly-to-monthly or annual-to-annual changes, the overwhelming majority of real plan changes. A monthly-to-annual switch mid-cycle is a known edge where the simplification slightly understates the annual plan's daily value; starting a fresh period is the cleaner move for that specific case, and nothing currently automates it.

**Resend's sandbox restricts merchant emails to the account owner's address.** Until a tenant verifies their own sending domain with Resend, Resend itself (not Tori) only delivers to the address that owns the Resend account. Merchant emails, trial-ending-soon notices, and test-mode simulated webhooks all attempt the send and log it correctly; they just don't land for arbitrary customer addresses until domain verification happens on Resend's side.

**Portal tokens expire in one hour with no refresh.** A customer whose session outlives that window needs a new token issued by the integrator, not a client-side refresh. For a hackathon deployment this is a fine tradeoff; a production deployment serving long browsing sessions would add a refresh path.

---

## Submission checklist

- [x] Public GitHub repository, clean commit history
- [x] Live, working deployment: dashboard, API, and worker all running on Railway
- [x] Test credentials that work right now: `dev@tori.ng` / `tori-dev-2026`
- [x] Unauthenticated health check: `GET /v1/status`
- [x] OpenAPI spec covering every route in `router.go`: `/openapi.json`
- [x] Full API reference with request/response examples per endpoint, not a route list
- [x] Real ClassPay integration, real code, real line count
- [x] Production proof: real Nomba webhook logs from a live Verve card charge
- [x] Nightly reconciliation against real Nomba transaction data
- [x] 78 passing test cases across the state machine, billing, dunning, ledger, and webhook packages
- [x] Architecture, security, and ADR documentation separate from this README, linked from it
- [x] Smoke test script exercising every public, JWT, and API-key-protected endpoint

---

*Built with Go, PostgreSQL, Redis, Next.js, Resend, and Nomba, by Kingsley Chibueze for the Nomba × DevCareer Hackathon 2026.*

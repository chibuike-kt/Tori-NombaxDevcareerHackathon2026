# Architecture Decision Records

Engineering decisions made while building Tori, with context and tradeoffs.

---

## ADR-001: PostgreSQL SKIP LOCKED over Redis/BullMQ for the job queue

**Status:** Accepted

**Context:**
Tori needs a reliable job queue for billing operations: trial expiry charges, dunning retries, webhook delivery, reconciliation. The standard choice for a Node.js stack is BullMQ backed by Redis. Since Tori runs on Go with PostgreSQL already in the stack, adding Redis purely for a job queue introduces a second stateful dependency.

**Decision:**
Use PostgreSQL's `SELECT FOR UPDATE SKIP LOCKED` to implement a job queue on the `scheduled_jobs` table. Workers claim jobs by locking rows; other workers skip locked rows without blocking. Stale locks are recovered by a periodic cleanup job.

**Consequences:**
- No additional infrastructure dependency — PostgreSQL already handles persistence, transactions, and durability
- Exactly-once processing guaranteed by the database's row-level locking
- Simpler operational model — one thing to back up, one thing to monitor
- Lower throughput ceiling than Redis-backed queues — acceptable for billing workloads (hundreds of jobs per minute, not millions)
- Cannot do pub/sub patterns — not needed here

---

## ADR-002: Append-only double-entry ledger

**Status:** Accepted

**Context:**
Financial data needs to be auditable and tamper-evident. A standard mutable table allows UPDATE and DELETE, which means a bug or a bad actor can silently alter financial history. Regulatory and accounting requirements expect that every money movement is recorded and preserved.

**Decision:**
The `ledger_entries` table has no UPDATE or DELETE queries anywhere in the codebase. Every money movement (charge, refund, proration, credit) writes a new row. The `idempotency_key` column has a UNIQUE constraint enforced at the database level, making duplicate writes a hard error rather than a soft application check.

**Consequences:**
- Financial history is immutable — no bug can silently alter past entries
- MRR, ARR, and revenue figures are computed from ledger aggregations, not guessed from subscription state
- Slightly more complex reporting queries (must aggregate entries rather than read a running balance)
- Storage grows monotonically — acceptable for billing data volumes

---

## ADR-003: Idempotency keys with UNIQUE constraint at the database level

**Status:** Accepted

**Context:**
Billing operations are triggered by jobs that can be retried on failure. A network timeout during a Nomba charge call could result in the charge succeeding on Nomba's side but the response never reaching Tori. Without idempotency, a retry would charge the customer twice.

**Decision:**
Every charge, refund, and proration carries a deterministic idempotency key derived from the subscription ID and billing period (e.g. `retry-card-{sub_id}-{attempt}`). The `ledger_entries` and `invoices` tables have `idempotency_key TEXT UNIQUE NOT NULL` enforced at the PostgreSQL level. A duplicate key causes a unique constraint violation, not a silent duplicate write.

**Consequences:**
- Double charges are impossible at the database level, not just the application level
- Job handlers can be safely retried without idempotency logic in the handler code
- Idempotency keys must be chosen carefully — they encode assumptions about what constitutes a "same operation"

---

## ADR-004: Pure state machine with zero side effects

**Status:** Accepted

**Context:**
Subscription lifecycle is complex — 9 states, 15+ events, many invalid transitions. A naive implementation would scatter status-update logic across handlers, making it easy to reach invalid states (e.g. a CANCELLED subscription being charged, or an ACTIVE subscription entering TRIALING).

**Decision:**
`subscription.Transition(currentStatus, event)` is a pure function — it takes a status and an event, returns the next status or an error. It has no database calls, no side effects, and no dependencies. Every handler calls Transition before any status update and aborts if it returns an error. The function and all valid/invalid transitions are unit tested.

**Consequences:**
- Invalid transitions are caught before any database write
- The state machine is independently testable without a database
- Adding a new state requires updating one map, one test file, and one handler — nothing can be missed
- Slightly more verbose handlers (must call Transition explicitly) — acceptable

---

## ADR-005: Single-schema multi-tenancy over schema-per-tenant

**Status:** Accepted

**Context:**
Multi-tenant billing systems can isolate tenants by giving each one a separate PostgreSQL schema (Stripe's internal model, Duro's approach) or by scoping every table with a `tenant_id` column. Schema-per-tenant gives stronger isolation but is operationally complex: migrations must run against every schema, connection pooling is harder, and adding a new tenant requires DDL.

**Decision:**
Every table has a `tenant_id uuid NOT NULL` column. Every query includes `WHERE tenant_id = $N`. The tenant ID always comes from the authenticated JWT or API key — never from the request body. This is enforced by code review convention and verified during the security review.

**Consequences:**
- Single migration applies to all tenants simultaneously
- Standard connection pooling (pgxpool) works without modification
- Slightly weaker isolation guarantee than schema-per-tenant — a bug in a query could theoretically leak cross-tenant data if `tenant_id` is omitted
- The risk is mitigated by sqlc-generated queries (which encode the tenant scope at compile time) and 23 tenant-scoped queries verified in the security review

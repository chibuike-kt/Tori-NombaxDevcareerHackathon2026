-- name: CreateLedgerEntry :one
INSERT INTO ledger_entries (
    tenant_id, subscription_id, invoice_id, customer_id,
    entry_type, direction, amount, currency,
    description, idempotency_key, metadata, mode
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING *;

-- name: GetLedgerEntryByID :one
SELECT * FROM ledger_entries WHERE id = $1 AND tenant_id = $2;

-- name: GetLedgerEntryByIdempotencyKey :one
SELECT * FROM ledger_entries WHERE idempotency_key = $1;

-- name: ListLedgerEntriesByTenant :many
SELECT * FROM ledger_entries
WHERE tenant_id = $1 AND mode = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: ListLedgerEntriesBySubscription :many
SELECT * FROM ledger_entries
WHERE tenant_id = $1 AND subscription_id = $2 AND mode = $3
ORDER BY created_at DESC
LIMIT $4 OFFSET $5;

-- name: ListLedgerEntriesByCustomer :many
SELECT * FROM ledger_entries
WHERE tenant_id = $1 AND customer_id = $2 AND mode = $3
ORDER BY created_at DESC
LIMIT $4 OFFSET $5;

-- name: ListLedgerEntriesByDateRange :many
SELECT * FROM ledger_entries
WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3 AND mode = $4
ORDER BY created_at DESC
LIMIT $5 OFFSET $6;

-- name: ListLedgerEntriesByTypeAndDateRange :many
SELECT * FROM ledger_entries
WHERE tenant_id = $1
  AND entry_type = ANY($2::text[])
  AND created_at >= $3
  AND created_at <= $4
  AND mode = $5
ORDER BY created_at DESC
LIMIT $6 OFFSET $7;

-- name: GetLedgerSummary :one
SELECT
    COALESCE(SUM(amount) FILTER (WHERE direction = 'DEBIT'), 0)  AS total_debits,
    COALESCE(SUM(amount) FILTER (WHERE direction = 'CREDIT'), 0) AS total_credits,
    COALESCE(SUM(amount) FILTER (WHERE entry_type = 'CHARGE'), 0)  AS total_charged,
    COALESCE(SUM(amount) FILTER (WHERE entry_type = 'REFUND'), 0)  AS total_refunded,
    COALESCE(SUM(amount) FILTER (WHERE entry_type = 'CREDIT'), 0)  AS total_credits_applied,
    COUNT(*) AS entry_count
FROM ledger_entries
WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3 AND mode = $4;

-- name: GetMRR :one
-- MRR = sum of all CHARGE entries in the given month, normalised to monthly.
-- Annual charges are divided by 12. Custom intervals handled in application layer.
SELECT COALESCE(SUM(amount), 0) AS mrr
FROM ledger_entries
WHERE tenant_id = $1
  AND entry_type = 'CHARGE'
  AND created_at >= $2
  AND created_at < $3
  AND mode = $4;

-- name: GetRevenueByPlan :many
SELECT
    p.id   AS plan_id,
    p.name AS plan_name,
    COALESCE(SUM(l.amount), 0) AS total_charged,
    COUNT(DISTINCT l.subscription_id) AS subscription_count
FROM ledger_entries l
JOIN subscriptions s ON s.id = l.subscription_id
JOIN plans p ON p.id = s.plan_id
WHERE l.tenant_id = $1
  AND l.entry_type = 'CHARGE'
  AND l.created_at >= $2
  AND l.created_at < $3
  AND l.mode = $4
GROUP BY p.id, p.name
ORDER BY total_charged DESC;

-- name: GetBalanceSettlement :one
-- T+1 settlement: charges/refunds before today's midnight are settled
-- (available); charges today are pending settlement.
-- PAYOUT is subtracted with no created_at filter, unlike CHARGE/REFUND: a
-- payout debits real money the instant it completes, it doesn't wait a day
-- to "settle" the way an inbound charge does under T+1.
SELECT
  (COALESCE(SUM(amount) FILTER (WHERE entry_type = 'CHARGE' AND created_at < $2), 0)
  - COALESCE(SUM(amount) FILTER (WHERE entry_type = 'REFUND' AND created_at < $2), 0)
  - COALESCE(SUM(amount) FILTER (WHERE entry_type = 'PAYOUT'), 0))::BIGINT AS available_kobo,
    COALESCE(SUM(amount) FILTER (WHERE entry_type = 'CHARGE' AND created_at >= $2), 0)::BIGINT AS pending_kobo
FROM ledger_entries
WHERE tenant_id = $1 AND mode = $3;

-- name: GetMonthlyRevenue :many
SELECT
  DATE_TRUNC('month', created_at)::TIMESTAMPTZ AS month,
  SUM(CASE WHEN direction = 'DEBIT' AND entry_type = 'CHARGE' THEN amount ELSE 0 END)::BIGINT AS charged,
  SUM(CASE WHEN direction = 'CREDIT' AND entry_type = 'REFUND' THEN amount ELSE 0 END)::BIGINT AS refunded
FROM ledger_entries
WHERE tenant_id = $1
  AND created_at >= $2
  AND created_at <= $3
  AND mode = $4
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month ASC;

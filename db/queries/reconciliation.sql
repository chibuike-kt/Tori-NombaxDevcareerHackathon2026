-- name: CreateReconciliationRun :one
INSERT INTO reconciliation_runs (
    tenant_id, period_from, period_to,
    nomba_tx_count, matched_count, missing_count, mismatch_count,
    total_nomba_kobo, total_ledger_kobo, discrepancies, status
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
) RETURNING *;

-- name: ListReconciliationRuns :many
SELECT * FROM reconciliation_runs
WHERE tenant_id = $1
ORDER BY run_at DESC
LIMIT $2 OFFSET $3;

-- name: GetLatestReconciliationRun :one
SELECT * FROM reconciliation_runs
WHERE tenant_id = $1
ORDER BY run_at DESC
LIMIT 1;

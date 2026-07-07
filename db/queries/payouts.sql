-- name: CreatePayout :one
INSERT INTO payouts (tenant_id, mode, amount_kobo, currency, bank_code, bank_name, account_number, account_name)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetPayoutByID :one
SELECT * FROM payouts WHERE id = $1 AND tenant_id = $2;

-- name: GetPayoutByIDNoTenant :one
SELECT * FROM payouts WHERE id = $1;

-- name: ListPayouts :many
SELECT * FROM payouts WHERE tenant_id = $1 AND mode = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4;

-- name: MarkPayoutProcessing :one
UPDATE payouts SET status = 'processing', updated_at = NOW() WHERE id = $1 RETURNING *;

-- name: MarkPayoutCompleted :one
UPDATE payouts SET status = 'completed', nomba_reference = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *;

-- name: MarkPayoutFailed :one
UPDATE payouts SET status = 'failed', failure_reason = $2, updated_at = NOW() WHERE id = $1 RETURNING *;

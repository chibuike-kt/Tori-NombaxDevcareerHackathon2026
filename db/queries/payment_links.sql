-- name: CreatePaymentLink :one
INSERT INTO payment_links (tenant_id, mode, title, description, amount_kobo, currency, max_uses)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetPaymentLinkByID :one
SELECT * FROM payment_links WHERE id = $1 AND tenant_id = $2;

-- name: GetPaymentLinkByIDNoTenant :one
SELECT * FROM payment_links WHERE id = $1;

-- name: ListPaymentLinks :many
SELECT * FROM payment_links WHERE tenant_id = $1 AND mode = $2 ORDER BY created_at DESC;

-- name: DeactivatePaymentLink :one
UPDATE payment_links SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *;

-- name: IncrementPaymentLinkUseCount :exec
UPDATE payment_links SET use_count = use_count + 1, updated_at = NOW() WHERE id = $1;

-- name: CreateInvoice :one
INSERT INTO invoices (
    tenant_id, subscription_id, customer_id,
    amount, currency, status, due_date,
    line_items, idempotency_key, mode
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: GetInvoiceByID :one
SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2;

-- name: GetInvoiceByIdempotencyKey :one
SELECT * FROM invoices WHERE idempotency_key = $1;

-- name: ListInvoicesBySubscription :many
SELECT * FROM invoices WHERE subscription_id = $1 ORDER BY created_at DESC;

-- name: ListInvoicesByTenant :many
SELECT * FROM invoices
WHERE tenant_id = $1 AND mode = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: ListInvoicesByStatus :many
SELECT * FROM invoices
WHERE tenant_id = $1 AND status = $2 AND mode = $3
ORDER BY created_at DESC
LIMIT $4 OFFSET $5;

-- name: MarkInvoicePaid :one
UPDATE invoices
SET status = 'paid', paid_at = NOW(), nomba_charge_ref = $3
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: MarkInvoiceVoid :one
UPDATE invoices
SET status = 'void'
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: MarkInvoiceUncollectible :one
UPDATE invoices
SET status = 'uncollectible'
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: UpdateInvoiceProration :one
UPDATE invoices
SET proration_details = $3, line_items = $4
WHERE id = $1 AND tenant_id = $2
RETURNING *;

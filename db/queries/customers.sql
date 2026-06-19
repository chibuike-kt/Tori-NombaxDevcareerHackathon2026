-- name: CreateCustomer :one
INSERT INTO customers (tenant_id, external_id, email, name, nomba_customer_id, metadata)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetCustomerByID :one
SELECT * FROM customers WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE;

-- name: GetCustomerByEmail :one
SELECT * FROM customers WHERE tenant_id = $1 AND email = $2 AND is_deleted = FALSE;

-- name: GetCustomerByExternalID :one
SELECT * FROM customers WHERE tenant_id = $1 AND external_id = $2 AND is_deleted = FALSE;

-- name: ListCustomers :many
SELECT * FROM customers
WHERE tenant_id = $1 AND is_deleted = FALSE
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateCustomer :one
UPDATE customers
SET name = $3, email = $4, metadata = $5
WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE
RETURNING *;

-- name: UpdateCustomerTokenisedCard :one
UPDATE customers
SET tokenised_card = $3, nomba_customer_id = $4
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: ArchiveCustomer :exec
UPDATE customers SET is_deleted = TRUE WHERE id = $1 AND tenant_id = $2;

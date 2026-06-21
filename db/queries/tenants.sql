-- name: CreateTenant :one
INSERT INTO tenants (name, email, api_key_hash, webhook_secret, dunning_config)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetTenantByID :one
SELECT * FROM tenants WHERE id = $1;

-- name: GetTenantByEmail :one
SELECT * FROM tenants WHERE email = $1;

-- name: GetTenantByAPIKeyHash :one
SELECT * FROM tenants WHERE api_key_hash = $1 AND is_active = TRUE;

-- name: UpdateTenantDunningConfig :one
UPDATE tenants SET dunning_config = $2 WHERE id = $1 RETURNING *;

-- name: UpdateTenant :one
UPDATE tenants SET name = $2, email = $3 WHERE id = $1 RETURNING *;

-- name: DeactivateTenant :exec
UPDATE tenants SET is_active = FALSE WHERE id = $1;

-- name: ListTenants :many
SELECT * FROM tenants ORDER BY created_at DESC;

-- name: UpdateTenantPassword :exec
UPDATE tenants SET password_hash = $2 WHERE id = $1;

-- name: SetTenantPassword :exec
UPDATE tenants SET password_hash = $2 WHERE id = $1;

-- name: UpdateTenantAPIKeyHash :exec
UPDATE tenants
SET api_key_hash = @api_key_hash
WHERE id = @id;

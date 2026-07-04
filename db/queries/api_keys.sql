-- name: UpsertAPIKey :one
INSERT INTO api_keys (tenant_id, mode, key_hash, key_hint)
VALUES ($1, $2, $3, $4)
ON CONFLICT (tenant_id, mode) DO UPDATE
    SET key_hash = EXCLUDED.key_hash,
        key_hint = EXCLUDED.key_hint,
        created_at = NOW(),
        last_used_at = NULL
RETURNING *;

-- name: GetAPIKeyByHash :one
SELECT * FROM api_keys WHERE key_hash = $1;

-- name: GetAPIKeyByTenantAndMode :one
SELECT * FROM api_keys WHERE tenant_id = $1 AND mode = $2;

-- name: ListAPIKeysByTenant :many
SELECT * FROM api_keys WHERE tenant_id = $1 ORDER BY mode;

-- name: TouchAPIKeyLastUsed :exec
UPDATE api_keys SET last_used_at = NOW() WHERE id = $1;

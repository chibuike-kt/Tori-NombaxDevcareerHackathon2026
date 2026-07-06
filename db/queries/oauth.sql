-- name: CreateOAuthClient :one
INSERT INTO oauth_clients (tenant_id, client_id, client_secret_hash, client_secret_hint, name, mode)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetOAuthClientByClientID :one
SELECT * FROM oauth_clients WHERE client_id = $1;

-- name: ListOAuthClients :many
SELECT * FROM oauth_clients WHERE tenant_id = $1 ORDER BY created_at DESC;

-- name: RevokeOAuthClient :one
UPDATE oauth_clients SET is_active = false WHERE id = $1 AND tenant_id = $2 RETURNING *;

-- name: TouchOAuthClientLastUsed :exec
UPDATE oauth_clients SET last_used_at = NOW() WHERE id = $1;

-- name: CreateOAuthToken :one
INSERT INTO oauth_tokens (tenant_id, client_id, token_hash, mode, expires_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetOAuthTokenByHash :one
SELECT * FROM oauth_tokens WHERE token_hash = $1;

-- name: DeleteExpiredTokens :exec
DELETE FROM oauth_tokens WHERE expires_at < NOW();

-- name: RevokeOAuthToken :exec
DELETE FROM oauth_tokens WHERE token_hash = $1;

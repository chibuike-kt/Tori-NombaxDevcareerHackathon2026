-- name: GetIdempotencyKey :one
SELECT * FROM idempotency_keys
WHERE tenant_id = $1 AND idempotency_key = $2 AND expires_at > now();

-- name: CreateIdempotencyKey :one
INSERT INTO idempotency_keys
    (tenant_id, idempotency_key, request_path, request_method, response_status, response_body, mode)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
RETURNING *;

-- name: DeleteExpiredIdempotencyKeys :exec
DELETE FROM idempotency_keys WHERE expires_at <= now();

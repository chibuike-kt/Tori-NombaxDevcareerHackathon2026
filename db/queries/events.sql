-- name: CreateEvent :one
INSERT INTO events (tenant_id, mode, event_type, resource_type, resource_id, description, metadata)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListEvents :many
SELECT * FROM events WHERE tenant_id = $1 AND mode = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4;

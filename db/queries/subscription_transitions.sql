-- name: CreateSubscriptionTransition :one
INSERT INTO subscription_transitions (subscription_id, tenant_id, from_status, to_status, reason, actor)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListSubscriptionTransitions :many
SELECT * FROM subscription_transitions
WHERE subscription_id = $1 AND tenant_id = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

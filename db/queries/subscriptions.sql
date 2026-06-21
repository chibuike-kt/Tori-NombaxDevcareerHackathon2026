-- name: CreateSubscription :one
INSERT INTO subscriptions (
    tenant_id, customer_id, plan_id, status,
    current_period_start, current_period_end,
    trial_end, idempotency_key, metadata
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetSubscriptionByID :one
SELECT * FROM subscriptions WHERE id = $1 AND tenant_id = $2;

-- name: GetSubscriptionByIDNoTenant :one
SELECT * FROM subscriptions WHERE id = $1;

-- name: GetSubscriptionByIdempotencyKey :one
SELECT * FROM subscriptions WHERE idempotency_key = $1 AND tenant_id = $2;

-- name: ListSubscriptions :many
SELECT * FROM subscriptions
WHERE tenant_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListSubscriptionsByStatus :many
SELECT * FROM subscriptions
WHERE tenant_id = $1 AND status = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: ListSubscriptionsByCustomer :many
SELECT * FROM subscriptions
WHERE tenant_id = $1 AND customer_id = $2
ORDER BY created_at DESC;

-- name: UpdateSubscriptionStatus :one
UPDATE subscriptions
SET status = $3, updated_at = NOW()
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: UpdateSubscriptionAfterRenewal :one
UPDATE subscriptions
SET
    status = $3,
    current_period_start = $4,
    current_period_end = $5,
    dunning_attempt = 0,
    next_retry_at = NULL,
    updated_at = NOW()
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: UpdateSubscriptionDunning :one
UPDATE subscriptions
SET
    status = $3,
    dunning_attempt = $4,
    next_retry_at = $5,
    updated_at = NOW()
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: UpdateSubscriptionPlan :one
UPDATE subscriptions
SET plan_id = $3, updated_at = NOW()
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: CancelSubscription :one
UPDATE subscriptions
SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: PauseSubscription :one
UPDATE subscriptions
SET status = 'PAUSED', paused_at = NOW(), updated_at = NOW()
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: ResumeSubscription :one
UPDATE subscriptions
SET status = 'ACTIVE', paused_at = NULL, updated_at = NOW()
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: ListActiveSubscriptionsDue :many
-- Billing clock: find ACTIVE subs whose period has ended and need renewal.
SELECT * FROM subscriptions
WHERE status = 'ACTIVE' AND current_period_end <= $1
ORDER BY current_period_end ASC
LIMIT $2;

-- name: ListTrialingSubscriptionsDue :many
-- Find TRIALING subs whose trial has ended and need conversion.
SELECT * FROM subscriptions
WHERE status = 'TRIALING' AND trial_end <= $1
ORDER BY trial_end ASC
LIMIT $2;

-- name: ListSubscriptionsDueForRetry :many
SELECT * FROM subscriptions
WHERE status IN ('PAST_DUE', 'DUNNING') AND next_retry_at <= $1
ORDER BY next_retry_at ASC
LIMIT $2;

-- name: UpdateSubscriptionStatusOptimistic :one
UPDATE subscriptions
SET status = $3
WHERE id = $1
  AND tenant_id = $2
  AND updated_at = $4
  AND status != 'CANCELLED'
RETURNING *;

-- name: ListSubscriptionsByCustomerNoTenant :many
SELECT * FROM subscriptions
WHERE customer_id = $1
  AND status != 'CANCELLED'
ORDER BY created_at DESC;

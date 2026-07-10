-- name: CreateSubscription :one
INSERT INTO subscriptions (
    tenant_id, customer_id, plan_id, status,
    current_period_start, current_period_end,
    trial_end, idempotency_key, metadata, discount_kobo, mode
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: GetSubscriptionByID :one
-- LEFT JOIN, not INNER — a subscription with a missing/cross-mode plan_id
-- must still return the subscription row (with null plan_* fields) rather
-- than silently disappearing.
SELECT s.*, p.name AS plan_name, p.amount AS plan_amount, p.currency AS plan_currency, p.interval AS plan_interval
FROM subscriptions s
LEFT JOIN plans p ON p.id = s.plan_id
WHERE s.id = $1 AND s.tenant_id = $2;

-- name: GetSubscriptionByIDNoTenant :one
SELECT * FROM subscriptions WHERE id = $1;

-- name: GetSubscriptionByIdempotencyKey :one
SELECT * FROM subscriptions WHERE idempotency_key = $1 AND tenant_id = $2;

-- name: ListSubscriptions :many
SELECT s.*, p.name AS plan_name, p.amount AS plan_amount, p.currency AS plan_currency, p.interval AS plan_interval
FROM subscriptions s
LEFT JOIN plans p ON p.id = s.plan_id
WHERE s.tenant_id = $1 AND s.mode = $2
ORDER BY s.created_at DESC
LIMIT $3 OFFSET $4;

-- name: ListSubscriptionsByStatus :many
SELECT s.*, p.name AS plan_name, p.amount AS plan_amount, p.currency AS plan_currency, p.interval AS plan_interval
FROM subscriptions s
LEFT JOIN plans p ON p.id = s.plan_id
WHERE s.tenant_id = $1 AND s.status = $2 AND s.mode = $3
ORDER BY s.created_at DESC
LIMIT $4 OFFSET $5;

-- name: ListSubscriptionsByCustomer :many
SELECT s.*, p.name AS plan_name, p.amount AS plan_amount, p.currency AS plan_currency, p.interval AS plan_interval
FROM subscriptions s
LEFT JOIN plans p ON p.id = s.plan_id
WHERE s.tenant_id = $1 AND s.customer_id = $2 AND s.mode = $3
ORDER BY s.created_at DESC;

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

-- name: SetSubscriptionCancelReason :one
-- Merges cancel_reason into existing metadata rather than overwriting it,
-- so any other metadata the subscription carries survives.
UPDATE subscriptions
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('cancel_reason', sqlc.arg(reason)::text),
    updated_at = NOW()
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: UpdateSubscriptionAfterRenewalOptimistic :one
UPDATE subscriptions
SET
    status = $3,
    current_period_start = $4,
    current_period_end = $5,
    dunning_attempt = 0,
    next_retry_at = NULL,
    updated_at = NOW()
WHERE id = $1
  AND tenant_id = $2
  AND updated_at = $6
  AND status != 'CANCELLED'
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
SET status = 'PAUSED', paused_at = NOW(), pause_credit_kobo = $3, updated_at = NOW()
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: ResumeSubscription :one
UPDATE subscriptions
SET status = 'ACTIVE', paused_at = NULL, pause_credit_kobo = 0, updated_at = NOW()
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

-- name: CancelSubscriptionAtPeriodEnd :one
UPDATE subscriptions
SET cancel_at_period_end = true, updated_at = NOW()
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: UpdateSubscriptionStatusOptimistic :one
UPDATE subscriptions
SET status = $3
WHERE id = $1
  AND tenant_id = $2
  AND updated_at = $4
  AND status != 'CANCELLED'
RETURNING *;

-- name: ClaimDunningAttempt :one
-- Optimistic lock: only increments if dunning_attempt still matches the
-- value the caller last read. A second worker racing on the same job finds
-- zero rows matched and knows to skip rather than double-charge.
UPDATE subscriptions
SET dunning_attempt = dunning_attempt + 1, updated_at = NOW()
WHERE id = $1
  AND tenant_id = $2
  AND dunning_attempt = $3
RETURNING *;

-- name: ListSubscriptionsByCustomerNoTenant :many
SELECT * FROM subscriptions
WHERE customer_id = $1
  AND status != 'CANCELLED'
ORDER BY created_at DESC;

-- name: UpdateSubscriptionTokenKey :one
UPDATE subscriptions
SET token_key = $3, updated_at = NOW()
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: SetSubscriptionMandate :one
UPDATE subscriptions
SET mandate_id = $3, updated_at = NOW()
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: UpdateSubscriptionRecoveryRail :one
UPDATE subscriptions
SET recovery_rail = $3, updated_at = NOW()
WHERE id = $1 AND tenant_id = $2
RETURNING *;

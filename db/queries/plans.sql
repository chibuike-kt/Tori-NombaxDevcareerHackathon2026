-- name: CreatePlan :one
INSERT INTO plans (tenant_id, name, description, amount, currency, interval, interval_count, trial_period_days, metadata, mode)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: GetPlanByID :one
SELECT * FROM plans WHERE id = $1 AND tenant_id = $2;

-- name: ListPlans :many
SELECT * FROM plans WHERE tenant_id = $1 AND is_active = TRUE AND mode = $2 ORDER BY created_at DESC;

-- name: ListAllPlans :many
SELECT * FROM plans WHERE tenant_id = $1 AND mode = $2 ORDER BY created_at DESC;

-- name: UpdatePlan :one
UPDATE plans
SET name = $3, description = $4, amount = $5, trial_period_days = $6, metadata = $7
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: DeactivatePlan :exec
UPDATE plans SET is_active = FALSE WHERE id = $1 AND tenant_id = $2;

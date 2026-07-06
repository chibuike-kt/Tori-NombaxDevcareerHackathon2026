-- name: CreatePromoCode :one
INSERT INTO promo_codes (tenant_id, code, description, discount_type, discount_value, plan_id, max_uses, expires_at, mode)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetPromoCodeByCode :one
SELECT * FROM promo_codes WHERE tenant_id = $1 AND code = $2;

-- name: GetPromoCodeByID :one
SELECT * FROM promo_codes WHERE id = $1 AND tenant_id = $2;

-- name: ListPromoCodes :many
SELECT * FROM promo_codes WHERE tenant_id = $1 AND is_active = true AND mode = $2 ORDER BY created_at DESC;

-- name: ListAllPromoCodes :many
SELECT * FROM promo_codes WHERE tenant_id = $1 AND mode = $2 ORDER BY created_at DESC;

-- name: IncrementPromoUseCount :exec
UPDATE promo_codes SET use_count = use_count + 1, updated_at = NOW() WHERE id = $1;

-- name: DeactivatePromoCode :one
UPDATE promo_codes SET is_active = false, updated_at = NOW()
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: DeletePromoCode :exec
DELETE FROM promo_codes WHERE id = $1 AND tenant_id = $2;

-- name: CreateWebhookEndpoint :one
INSERT INTO webhook_endpoints (tenant_id, url, events, secret, api_version)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetWebhookEndpointByID :one
SELECT * FROM webhook_endpoints WHERE id = $1 AND tenant_id = $2;

-- name: ListWebhookEndpoints :many
SELECT * FROM webhook_endpoints WHERE tenant_id = $1 AND is_active = TRUE;

-- name: UpdateWebhookEndpoint :one
UPDATE webhook_endpoints
SET url = $3, events = $4, is_active = $5
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: DeleteWebhookEndpoint :exec
UPDATE webhook_endpoints SET is_active = FALSE WHERE id = $1 AND tenant_id = $2;

-- name: CreateWebhookDelivery :one
INSERT INTO webhook_deliveries (endpoint_id, tenant_id, event_type, api_version, payload, status)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetWebhookDeliveryByID :one
SELECT * FROM webhook_deliveries WHERE id = $1 AND tenant_id = $2;

-- name: ListWebhookDeliveries :many
SELECT * FROM webhook_deliveries
WHERE tenant_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: MarkDeliverySuccess :exec
UPDATE webhook_deliveries
SET status = 'delivered', response_status = $2, response_body = $3, attempt_count = attempt_count + 1
WHERE id = $1;

-- name: MarkDeliveryFailed :exec
UPDATE webhook_deliveries
SET status = 'failed', response_status = $2, response_body = $3,
    attempt_count = attempt_count + 1, next_retry_at = $4
WHERE id = $1;

-- name: ListFailedDeliveriesDue :many
SELECT * FROM webhook_deliveries
WHERE status = 'failed' AND next_retry_at <= NOW()
ORDER BY next_retry_at ASC
LIMIT $1;

-- name: ListDeliveriesByEventTypeAndDateRange :many
-- Used by the replay endpoint.
SELECT * FROM webhook_deliveries
WHERE tenant_id = $1
  AND event_type = ANY($2::text[])
  AND created_at >= $3
  AND created_at <= $4
ORDER BY created_at ASC;

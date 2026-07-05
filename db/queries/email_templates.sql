-- name: GetEmailTemplate :one
SELECT * FROM email_templates WHERE tenant_id = $1 AND event_type = $2;

-- name: ListEmailTemplates :many
SELECT * FROM email_templates WHERE tenant_id = $1;

-- name: UpsertEmailTemplate :one
INSERT INTO email_templates (tenant_id, event_type, subject, html_body, is_enabled, use_default)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (tenant_id, event_type) DO UPDATE
    SET subject = EXCLUDED.subject,
        html_body = EXCLUDED.html_body,
        is_enabled = EXCLUDED.is_enabled,
        use_default = EXCLUDED.use_default,
        updated_at = NOW()
RETURNING *;

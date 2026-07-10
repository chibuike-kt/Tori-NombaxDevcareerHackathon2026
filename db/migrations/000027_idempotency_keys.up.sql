CREATE TABLE idempotency_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    idempotency_key text NOT NULL,
    request_path text NOT NULL,
    request_method text NOT NULL,
    response_status int NOT NULL,
    response_body jsonb NOT NULL,
    mode text NOT NULL DEFAULT 'live',
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT now() + INTERVAL '24 hours',
    UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX idx_idempotency_keys_tenant ON idempotency_keys(tenant_id, idempotency_key);
CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys(expires_at);

-- Merchant-configurable email templates sent to a tenant's own customers at
-- key billing events.

CREATE TABLE IF NOT EXISTS email_templates (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type   text NOT NULL CHECK (event_type IN (
                   'subscription.activated',
                   'payment.succeeded',
                   'payment.failed',
                   'dunning.started',
                   'payment.action_required',
                   'subscription.cancelled',
                   'trial.ending_soon'
                 )),
    subject      text NOT NULL,
    html_body    text NOT NULL,
    is_enabled   boolean NOT NULL DEFAULT true,
    use_default  boolean NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_tenant ON email_templates(tenant_id);

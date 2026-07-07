-- Activity feed: a generic, mode-scoped log of significant actions across
-- the account (subscription lifecycle, payouts, payment links, OAuth
-- clients), distinct from the tenant-team audit_log (which covers
-- member/admin actions only).
CREATE TABLE events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('test', 'live')),
    event_type text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid,
    description text NOT NULL,
    metadata jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_tenant ON events(tenant_id, mode, created_at DESC);

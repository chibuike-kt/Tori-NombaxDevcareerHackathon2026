-- Team management: members, invitations, and an audit log per tenant.

-- Members: people who can access a tenant's workspace.
CREATE TABLE IF NOT EXISTS members (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email         text NOT NULL,
    name          text,
    role          text NOT NULL DEFAULT 'developer'
                  CHECK (role IN ('owner', 'admin', 'developer', 'viewer')),
    status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'invited', 'suspended')),
    password_hash text,
    last_login_at timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_members_tenant ON members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);

-- Invitations: pending invites awaiting acceptance.
CREATE TABLE IF NOT EXISTS invitations (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email       text NOT NULL,
    role        text NOT NULL DEFAULT 'developer'
                CHECK (role IN ('owner', 'admin', 'developer', 'viewer')),
    token       text NOT NULL UNIQUE,
    invited_by  uuid REFERENCES members(id) ON DELETE SET NULL,
    expires_at  timestamptz NOT NULL,
    accepted_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);

-- Audit log: administrative activity in a workspace.
CREATE TABLE IF NOT EXISTS audit_log (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    actor_id    uuid,
    actor_email text,
    action      text NOT NULL,
    target      text,
    ip_address  text,
    metadata    jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id, created_at DESC);

-- Backfill: make every existing tenant's own account the owner member.
INSERT INTO members (tenant_id, email, name, role, status, password_hash, created_at)
SELECT id, email, name, 'owner', 'active', password_hash, created_at
FROM tenants
ON CONFLICT (tenant_id, email) DO NOTHING;

-- OAuth 2.0 client credentials flow for the Platform API, as a
-- production-grade alternative to raw X-API-Key auth. Both auth methods
-- work side by side — a bearer token minted here carries the same
-- tenant_id + mode that an API key would.

CREATE TABLE oauth_clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id text NOT NULL UNIQUE,
    client_secret_hash text NOT NULL,
    client_secret_hint text NOT NULL,
    name text NOT NULL,
    mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('test', 'live')),
    is_active bool NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz
);
CREATE INDEX idx_oauth_clients_tenant ON oauth_clients(tenant_id);
CREATE INDEX idx_oauth_clients_client_id ON oauth_clients(client_id);

CREATE TABLE oauth_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    mode text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_oauth_tokens_hash ON oauth_tokens(token_hash);

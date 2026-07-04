-- Test/live API key modes: each tenant can hold one live key and one test
-- key simultaneously, mirroring Stripe's test/live split.

CREATE TABLE IF NOT EXISTS api_keys (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    mode         text NOT NULL CHECK (mode IN ('test', 'live')),
    key_hash     text NOT NULL,
    key_hint     text NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz,
    UNIQUE (tenant_id, mode),
    UNIQUE (key_hash)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- Backfill: existing tenants' single key becomes their live key.
INSERT INTO api_keys (tenant_id, mode, key_hash, key_hint, created_at)
SELECT id, 'live', api_key_hash, api_key_hint, created_at
FROM tenants
WHERE api_key_hash IS NOT NULL
ON CONFLICT DO NOTHING;

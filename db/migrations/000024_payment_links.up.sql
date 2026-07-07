-- Payment links: a merchant-created, reusable checkout link for a fixed
-- amount, independent of any plan or subscription (e.g. a one-time fee).
CREATE TABLE payment_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('test', 'live')),
    title text NOT NULL,
    description text,
    amount_kobo int8 NOT NULL CHECK (amount_kobo > 0),
    currency text NOT NULL DEFAULT 'NGN',
    max_uses int4,
    use_count int4 NOT NULL DEFAULT 0,
    is_active bool NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_links_tenant ON payment_links(tenant_id, mode);

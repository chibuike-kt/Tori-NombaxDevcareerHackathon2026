-- Promo codes: tenant-defined discounts applied at checkout.

CREATE TABLE IF NOT EXISTS promo_codes (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code           text NOT NULL,
    description    text,
    discount_type  text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value bigint NOT NULL, -- percentage: 0-100, fixed: kobo amount
    plan_id        uuid REFERENCES plans(id) ON DELETE SET NULL, -- null = applies to all plans
    max_uses       integer, -- null = unlimited
    use_count      integer NOT NULL DEFAULT 0,
    expires_at     timestamptz,
    is_active      boolean NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_tenant ON promo_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(tenant_id, code, is_active);

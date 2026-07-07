-- Async payout requests: operators request a payout of their available
-- (T+1-settled) balance to a Nigerian bank account. Requests are processed
-- asynchronously by the worker via the Nomba transfer API.
CREATE TABLE payouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('test', 'live')),
    amount_kobo int8 NOT NULL,
    currency text NOT NULL DEFAULT 'NGN',
    bank_code text NOT NULL,
    bank_name text NOT NULL,
    account_number text NOT NULL,
    account_name text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    nomba_reference text,
    failure_reason text,
    requested_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payouts_tenant ON payouts(tenant_id, mode);

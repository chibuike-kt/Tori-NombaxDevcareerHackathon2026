-- Test/live mode data isolation. Every tenant-scoped resource that can be
-- created via a test-mode vs live-mode API key or dashboard toggle carries
-- its own mode, so test data and live data never mix in list views or
-- finance aggregates.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('test', 'live'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('test', 'live'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('test', 'live'));
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('test', 'live'));
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('test', 'live'));
ALTER TABLE plans ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('test', 'live'));
ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('test', 'live'));
ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('test', 'live'));

CREATE INDEX IF NOT EXISTS idx_subscriptions_mode ON subscriptions(tenant_id, mode);
CREATE INDEX IF NOT EXISTS idx_customers_mode ON customers(tenant_id, mode);
CREATE INDEX IF NOT EXISTS idx_invoices_mode ON invoices(tenant_id, mode);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_mode ON ledger_entries(tenant_id, mode);
CREATE INDEX IF NOT EXISTS idx_plans_mode ON plans(tenant_id, mode);
CREATE INDEX IF NOT EXISTS idx_promo_codes_mode ON promo_codes(tenant_id, mode);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_mode ON webhook_endpoints(tenant_id, mode);

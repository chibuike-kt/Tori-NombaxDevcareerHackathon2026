DROP INDEX IF EXISTS idx_subscriptions_mode;
DROP INDEX IF EXISTS idx_customers_mode;
DROP INDEX IF EXISTS idx_invoices_mode;
DROP INDEX IF EXISTS idx_ledger_entries_mode;
DROP INDEX IF EXISTS idx_plans_mode;
DROP INDEX IF EXISTS idx_promo_codes_mode;
DROP INDEX IF EXISTS idx_webhook_endpoints_mode;

ALTER TABLE subscriptions DROP COLUMN IF EXISTS mode;
ALTER TABLE customers DROP COLUMN IF EXISTS mode;
ALTER TABLE invoices DROP COLUMN IF EXISTS mode;
ALTER TABLE ledger_entries DROP COLUMN IF EXISTS mode;
ALTER TABLE promo_codes DROP COLUMN IF EXISTS mode;
ALTER TABLE plans DROP COLUMN IF EXISTS mode;
ALTER TABLE webhook_endpoints DROP COLUMN IF EXISTS mode;
ALTER TABLE scheduled_jobs DROP COLUMN IF EXISTS mode;

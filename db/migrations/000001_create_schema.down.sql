-- =============================================================================
-- Migration 000001: Rollback
-- Drops all tables in reverse dependency order (FK constraints respected).
-- Indexes are dropped automatically when their tables are dropped.
-- =============================================================================

DROP TABLE IF EXISTS webhook_deliveries;
DROP TABLE IF EXISTS webhook_endpoints;
DROP TABLE IF EXISTS scheduled_jobs;
DROP TABLE IF EXISTS ledger_entries;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS plans;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS tenants;

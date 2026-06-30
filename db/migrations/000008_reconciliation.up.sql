CREATE TABLE IF NOT EXISTS reconciliation_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    period_from     TIMESTAMPTZ NOT NULL,
    period_to       TIMESTAMPTZ NOT NULL,
    nomba_tx_count  INT NOT NULL DEFAULT 0,
    matched_count   INT NOT NULL DEFAULT 0,
    missing_count   INT NOT NULL DEFAULT 0,
    mismatch_count  INT NOT NULL DEFAULT 0,
    total_nomba_kobo BIGINT NOT NULL DEFAULT 0,
    total_ledger_kobo BIGINT NOT NULL DEFAULT 0,
    discrepancies   JSONB NOT NULL DEFAULT '[]',
    status          TEXT NOT NULL DEFAULT 'ok',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reconciliation_runs_tenant ON reconciliation_runs(tenant_id);
CREATE INDEX idx_reconciliation_runs_run_at ON reconciliation_runs(run_at);

-- Subscription transition audit trail: every status change is recorded here
-- in addition to the current status living on subscriptions itself.

CREATE TABLE IF NOT EXISTS subscription_transitions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    from_status     text NOT NULL,
    to_status       text NOT NULL,
    reason          text,
    actor           text NOT NULL DEFAULT 'system',
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_transitions_subscription
  ON subscription_transitions(subscription_id, created_at DESC);

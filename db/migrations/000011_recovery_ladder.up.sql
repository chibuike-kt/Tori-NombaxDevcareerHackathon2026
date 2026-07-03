-- Recovery ladder: subscriptions can fall back from card to direct-debit mandate
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS mandate_id text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS recovery_rail text NOT NULL DEFAULT 'card';
-- recovery_rail tracks the current best rail: 'card', 'mandate', or 'manual'

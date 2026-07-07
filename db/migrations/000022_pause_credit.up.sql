-- Pause proration: when a subscription is paused, the unused portion of its
-- current billing period is credited and applied to the charge when it
-- resumes, instead of silently discarding the customer's remaining paid time.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pause_credit_kobo int8 NOT NULL DEFAULT 0;

-- Add GRACE_PERIOD to the subscription status check constraint.
-- GRACE_PERIOD sits between ACTIVE and PAST_DUE.
-- When a renewal charge fails, the subscription enters GRACE_PERIOD
-- for 48 hours before moving to PAST_DUE and triggering full dunning.

ALTER TABLE subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE subscriptions
ADD CONSTRAINT subscriptions_status_check
CHECK (status IN (
  'TRIALING',
  'ACTIVE',
  'GRACE_PERIOD',
  'PAST_DUE',
  'DUNNING',
  'PAUSED',
  'SUSPENDED',
  'CANCELLED'
));

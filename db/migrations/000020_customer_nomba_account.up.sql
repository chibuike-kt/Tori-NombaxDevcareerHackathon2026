-- Stores the customer's own Nomba wallet account ID, captured from the
-- payment_success webhook's data.merchant.walletId. Lets the recovery
-- waterfall check wallet balance before falling back to card/mandate.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS nomba_account_id text;

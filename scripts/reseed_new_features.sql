-- Demo data for the 7 new builds (OAuth clients, wallet recovery rail,
-- T+1 settlement balance, payouts) — run against Railway with the tenant_id
-- substituted in.

DO $$
DECLARE
  tid uuid := :'tenant_id';
  cust_id uuid;
  dunning_sub_id uuid;
  active_sub_id uuid;
  charge_entry_id uuid;
BEGIN
  -- ============ OAuth client (live) — dashboard demo ============
  INSERT INTO oauth_clients (id, tenant_id, client_id, client_secret_hash, client_secret_hint, name, mode, is_active)
  VALUES (
    gen_random_uuid(), tid,
    'oauth_client_demo0000000001',
    encode(sha256('oauth_secret_demo0000000000000000000000000000000000000000000001'::bytea), 'hex'),
    'oauth_secret_de...0001',
    'ClassPay integration',
    'live', true
  );

  -- ============ Payouts: one pending, one completed ============
  INSERT INTO payouts (id, tenant_id, mode, amount_kobo, currency, bank_code, bank_name, account_number, account_name, status, requested_at)
  VALUES (
    gen_random_uuid(), tid, 'live', 15000000, 'NGN', '058', 'Guaranty Trust Bank', '0123456789', 'ClassPay Ltd',
    'pending', now() - interval '2 hours'
  );

  INSERT INTO payouts (id, tenant_id, mode, amount_kobo, currency, bank_code, bank_name, account_number, account_name, status, nomba_reference, requested_at, completed_at)
  VALUES (
    gen_random_uuid(), tid, 'live', 32000000, 'NGN', '044', 'Access Bank', '0987654321', 'ClassPay Ltd',
    'completed', 'demo-transfer-ref-0001', now() - interval '3 days', now() - interval '3 days' + interval '10 minutes'
  );

  -- ============ Wallet recovery rail demo ============
  -- Give one live customer a Nomba wallet ID and flip a DUNNING subscription's
  -- recovery_rail to "wallet" so the Recovery Center shows the new badge.
  SELECT s.id, s.customer_id INTO dunning_sub_id, cust_id
  FROM subscriptions s WHERE s.tenant_id = tid AND s.status = 'DUNNING' AND s.mode = 'live' LIMIT 1;

  IF cust_id IS NOT NULL THEN
    UPDATE customers SET nomba_account_id = 'wallet_acc_classpay_demo' WHERE id = cust_id;
    UPDATE subscriptions SET recovery_rail = 'wallet' WHERE id = dunning_sub_id;
  END IF;

  -- ============ Settled balance for the finance page ============
  -- Every ledger charge from the original reseed was created "now", so
  -- available_kobo (T+1 settled) was always 0. Backdate one live CHARGE so
  -- the Finance page shows a real available balance, not just pending.
  SELECT l.id INTO charge_entry_id
  FROM ledger_entries l
  WHERE l.tenant_id = tid AND l.mode = 'live' AND l.entry_type = 'CHARGE'
  ORDER BY l.created_at ASC LIMIT 1;

  IF charge_entry_id IS NOT NULL THEN
    UPDATE ledger_entries SET created_at = now() - interval '2 days' WHERE id = charge_entry_id;
  END IF;
END $$;

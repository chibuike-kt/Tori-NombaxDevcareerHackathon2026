-- Dual-mode reseed for test/live data isolation verification.
-- Run with: psql <connection> -v tenant_id="'<uuid>'" -f scripts/reseed_mode_isolation.sql
--
-- Clears and reseeds only the mode-scoped resource tables (plans, customers,
-- subscriptions, invoices, ledger_entries, promo_codes, webhook_endpoints).
-- Tenant, API keys, members, and email templates are left untouched so login
-- and the existing demo tenant identity keep working.

TRUNCATE TABLE customers, plans, subscriptions, invoices, ledger_entries, promo_codes, webhook_endpoints CASCADE;

DO $$
DECLARE
  tid uuid := :tenant_id;

  -- Plans (live + test)
  plan_basic_live uuid; plan_pro_live uuid; plan_starter_live uuid; plan_annual_live uuid;
  plan_basic_test uuid; plan_pro_test uuid; plan_starter_test uuid; plan_annual_test uuid;

  -- Live customers
  cust_live_1 uuid; cust_live_2 uuid; cust_live_3 uuid; cust_live_4 uuid; cust_live_5 uuid; cust_live_6 uuid;
  -- Test customers
  cust_test_1 uuid; cust_test_2 uuid; cust_test_3 uuid; cust_test_4 uuid;

  now_ts timestamptz := now();
  sub_id uuid;
  inv_id uuid;
BEGIN
  -- ============ PLANS ============
  INSERT INTO plans (id, tenant_id, name, amount, currency, interval, interval_count, trial_period_days, is_active, mode)
  VALUES (gen_random_uuid(), tid, 'Basic', 250000, 'NGN', 'monthly', 1, 0, true, 'live') RETURNING id INTO plan_basic_live;
  INSERT INTO plans (id, tenant_id, name, amount, currency, interval, interval_count, trial_period_days, is_active, mode)
  VALUES (gen_random_uuid(), tid, 'Pro', 500000, 'NGN', 'monthly', 1, 0, true, 'live') RETURNING id INTO plan_pro_live;
  INSERT INTO plans (id, tenant_id, name, amount, currency, interval, interval_count, trial_period_days, is_active, mode)
  VALUES (gen_random_uuid(), tid, 'Starter', 150000, 'NGN', 'monthly', 1, 7, true, 'live') RETURNING id INTO plan_starter_live;
  INSERT INTO plans (id, tenant_id, name, amount, currency, interval, interval_count, trial_period_days, is_active, mode)
  VALUES (gen_random_uuid(), tid, 'Annual', 2500000, 'NGN', 'annual', 1, 0, true, 'live') RETURNING id INTO plan_annual_live;

  INSERT INTO plans (id, tenant_id, name, amount, currency, interval, interval_count, trial_period_days, is_active, mode)
  VALUES (gen_random_uuid(), tid, 'Basic', 250000, 'NGN', 'monthly', 1, 0, true, 'test') RETURNING id INTO plan_basic_test;
  INSERT INTO plans (id, tenant_id, name, amount, currency, interval, interval_count, trial_period_days, is_active, mode)
  VALUES (gen_random_uuid(), tid, 'Pro', 500000, 'NGN', 'monthly', 1, 0, true, 'test') RETURNING id INTO plan_pro_test;
  INSERT INTO plans (id, tenant_id, name, amount, currency, interval, interval_count, trial_period_days, is_active, mode)
  VALUES (gen_random_uuid(), tid, 'Starter', 150000, 'NGN', 'monthly', 1, 7, true, 'test') RETURNING id INTO plan_starter_test;
  INSERT INTO plans (id, tenant_id, name, amount, currency, interval, interval_count, trial_period_days, is_active, mode)
  VALUES (gen_random_uuid(), tid, 'Annual', 2500000, 'NGN', 'annual', 1, 0, true, 'test') RETURNING id INTO plan_annual_test;

  -- ============ CUSTOMERS ============
  INSERT INTO customers (id, tenant_id, email, name, mode) VALUES (gen_random_uuid(), tid, 'amaka.obi@classpay.ng', 'Amaka Obi', 'live') RETURNING id INTO cust_live_1;
  INSERT INTO customers (id, tenant_id, email, name, mode) VALUES (gen_random_uuid(), tid, 'chidi.nwosu@classpay.ng', 'Chidi Nwosu', 'live') RETURNING id INTO cust_live_2;
  INSERT INTO customers (id, tenant_id, email, name, mode) VALUES (gen_random_uuid(), tid, 'fatima.abubakar@classpay.ng', 'Fatima Abubakar', 'live') RETURNING id INTO cust_live_3;
  INSERT INTO customers (id, tenant_id, email, name, mode) VALUES (gen_random_uuid(), tid, 'emeka.eze@classpay.ng', 'Emeka Eze', 'live') RETURNING id INTO cust_live_4;
  INSERT INTO customers (id, tenant_id, email, name, mode) VALUES (gen_random_uuid(), tid, 'ngozi.adeyemi@classpay.ng', 'Ngozi Adeyemi', 'live') RETURNING id INTO cust_live_5;
  INSERT INTO customers (id, tenant_id, email, name, mode) VALUES (gen_random_uuid(), tid, 'taiwo.okonkwo@classpay.ng', 'Taiwo Okonkwo', 'live') RETURNING id INTO cust_live_6;

  INSERT INTO customers (id, tenant_id, email, name, mode) VALUES (gen_random_uuid(), tid, 'tolu.bankole@classpay.ng', 'Tolu Bankole', 'test') RETURNING id INTO cust_test_1;
  INSERT INTO customers (id, tenant_id, email, name, mode) VALUES (gen_random_uuid(), tid, 'uche.chukwu@classpay.ng', 'Uche Chukwu', 'test') RETURNING id INTO cust_test_2;
  INSERT INTO customers (id, tenant_id, email, name, mode) VALUES (gen_random_uuid(), tid, 'yewande.ade@classpay.ng', 'Yewande Ade', 'test') RETURNING id INTO cust_test_3;
  INSERT INTO customers (id, tenant_id, email, name, mode) VALUES (gen_random_uuid(), tid, 'segun.bello@classpay.ng', 'Segun Bello', 'test') RETURNING id INTO cust_test_4;

  -- ============ LIVE SUBSCRIPTIONS — every status (9) ============
  -- 1. PENDING_PAYMENT
  INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, current_period_start, current_period_end, mode, idempotency_key)
  VALUES (gen_random_uuid(), tid, cust_live_1, plan_basic_live, 'PENDING_PAYMENT', now_ts, now_ts + interval '1 month', 'live', 'mode-seed-live-1');

  -- 2. TRIALING
  INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, current_period_start, current_period_end, trial_end, mode, idempotency_key)
  VALUES (gen_random_uuid(), tid, cust_live_2, plan_starter_live, 'TRIALING', now_ts - interval '2 days', now_ts + interval '5 days', now_ts + interval '5 days', 'live', 'mode-seed-live-2');

  -- 3. ACTIVE (gets invoice + ledger below)
  INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, current_period_start, current_period_end, token_key, mode, idempotency_key)
  VALUES (gen_random_uuid(), tid, cust_live_3, plan_pro_live, 'ACTIVE', now_ts - interval '10 days', now_ts + interval '20 days', 'tok_live_seed_1', 'live', 'mode-seed-live-3')
  RETURNING id INTO sub_id;

  INSERT INTO invoices (id, tenant_id, subscription_id, customer_id, amount, currency, status, due_date, paid_at, line_items, idempotency_key, mode)
  VALUES (gen_random_uuid(), tid, sub_id, cust_live_3, 500000, 'NGN', 'paid', now_ts - interval '10 days', now_ts - interval '10 days',
          jsonb_build_array(jsonb_build_object('description', 'Pro — monthly billing', 'amount', 500000, 'currency', 'NGN')),
          'mode-seed-invoice-live-1', 'live')
  RETURNING id INTO inv_id;

  INSERT INTO ledger_entries (id, tenant_id, subscription_id, invoice_id, customer_id, entry_type, direction, amount, currency, description, idempotency_key, mode)
  VALUES (gen_random_uuid(), tid, sub_id, inv_id, cust_live_3, 'CHARGE', 'DEBIT', 500000, 'NGN', 'Pro — subscription charge', 'mode-seed-charge-live-1', 'live');

  -- 4. GRACE_PERIOD
  INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, current_period_start, current_period_end, mode, idempotency_key)
  VALUES (gen_random_uuid(), tid, cust_live_4, plan_basic_live, 'GRACE_PERIOD', now_ts - interval '32 days', now_ts - interval '2 days', 'live', 'mode-seed-live-4');

  -- 5. PAST_DUE
  INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, current_period_start, current_period_end, mode, idempotency_key)
  VALUES (gen_random_uuid(), tid, cust_live_5, plan_pro_live, 'PAST_DUE', now_ts - interval '40 days', now_ts - interval '10 days', 'live', 'mode-seed-live-5');

  -- 6. DUNNING
  INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, current_period_start, current_period_end, dunning_attempt, next_retry_at, recovery_rail, mode, idempotency_key)
  VALUES (gen_random_uuid(), tid, cust_live_6, plan_pro_live, 'DUNNING', now_ts - interval '45 days', now_ts - interval '15 days', 2, now_ts + interval '3 days', 'card', 'live', 'mode-seed-live-6');

  -- 7. PAUSED
  INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, current_period_start, current_period_end, paused_at, mode, idempotency_key)
  VALUES (gen_random_uuid(), tid, cust_live_1, plan_basic_live, 'PAUSED', now_ts - interval '15 days', now_ts + interval '15 days', now_ts - interval '1 day', 'live', 'mode-seed-live-7');

  -- 8. SUSPENDED
  INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, current_period_start, current_period_end, dunning_attempt, recovery_rail, mode, idempotency_key)
  VALUES (gen_random_uuid(), tid, cust_live_2, plan_basic_live, 'SUSPENDED', now_ts - interval '70 days', now_ts - interval '40 days', 4, 'manual', 'live', 'mode-seed-live-8');

  -- 9. CANCELLED
  INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, current_period_start, current_period_end, cancelled_at, mode, idempotency_key)
  VALUES (gen_random_uuid(), tid, cust_live_3, plan_annual_live, 'CANCELLED', now_ts - interval '60 days', now_ts + interval '305 days', now_ts - interval '5 days', 'live', 'mode-seed-live-9');

  -- ============ TEST SUBSCRIPTIONS (5): ACTIVE x2, TRIALING, PAST_DUE, DUNNING ============
  -- ACTIVE #1 (gets invoice + ledger below)
  INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, current_period_start, current_period_end, token_key, mode, idempotency_key)
  VALUES (gen_random_uuid(), tid, cust_test_1, plan_pro_test, 'ACTIVE', now_ts - interval '5 days', now_ts + interval '25 days', 'tok_test_seed_1', 'test', 'mode-seed-test-1')
  RETURNING id INTO sub_id;

  INSERT INTO invoices (id, tenant_id, subscription_id, customer_id, amount, currency, status, due_date, paid_at, line_items, idempotency_key, mode)
  VALUES (gen_random_uuid(), tid, sub_id, cust_test_1, 500000, 'NGN', 'paid', now_ts - interval '5 days', now_ts - interval '5 days',
          jsonb_build_array(jsonb_build_object('description', 'Pro — monthly billing', 'amount', 500000, 'currency', 'NGN')),
          'mode-seed-invoice-test-1', 'test')
  RETURNING id INTO inv_id;

  INSERT INTO ledger_entries (id, tenant_id, subscription_id, invoice_id, customer_id, entry_type, direction, amount, currency, description, idempotency_key, mode)
  VALUES (gen_random_uuid(), tid, sub_id, inv_id, cust_test_1, 'CHARGE', 'DEBIT', 500000, 'NGN', 'Pro — subscription charge', 'mode-seed-charge-test-1', 'test');

  -- ACTIVE #2 (gets invoice + ledger below)
  INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, current_period_start, current_period_end, token_key, mode, idempotency_key)
  VALUES (gen_random_uuid(), tid, cust_test_2, plan_basic_test, 'ACTIVE', now_ts - interval '8 days', now_ts + interval '22 days', 'tok_test_seed_2', 'test', 'mode-seed-test-2')
  RETURNING id INTO sub_id;

  INSERT INTO invoices (id, tenant_id, subscription_id, customer_id, amount, currency, status, due_date, paid_at, line_items, idempotency_key, mode)
  VALUES (gen_random_uuid(), tid, sub_id, cust_test_2, 250000, 'NGN', 'paid', now_ts - interval '8 days', now_ts - interval '8 days',
          jsonb_build_array(jsonb_build_object('description', 'Basic — monthly billing', 'amount', 250000, 'currency', 'NGN')),
          'mode-seed-invoice-test-2', 'test')
  RETURNING id INTO inv_id;

  INSERT INTO ledger_entries (id, tenant_id, subscription_id, invoice_id, customer_id, entry_type, direction, amount, currency, description, idempotency_key, mode)
  VALUES (gen_random_uuid(), tid, sub_id, inv_id, cust_test_2, 'CHARGE', 'DEBIT', 250000, 'NGN', 'Basic — subscription charge', 'mode-seed-charge-test-2', 'test');

  -- TRIALING
  INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, current_period_start, current_period_end, trial_end, mode, idempotency_key)
  VALUES (gen_random_uuid(), tid, cust_test_3, plan_starter_test, 'TRIALING', now_ts - interval '1 day', now_ts + interval '6 days', now_ts + interval '6 days', 'test', 'mode-seed-test-3');

  -- PAST_DUE
  INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, current_period_start, current_period_end, mode, idempotency_key)
  VALUES (gen_random_uuid(), tid, cust_test_4, plan_pro_test, 'PAST_DUE', now_ts - interval '35 days', now_ts - interval '5 days', 'test', 'mode-seed-test-4');

  -- DUNNING
  INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, current_period_start, current_period_end, dunning_attempt, next_retry_at, recovery_rail, mode, idempotency_key)
  VALUES (gen_random_uuid(), tid, cust_test_1, plan_basic_test, 'DUNNING', now_ts - interval '38 days', now_ts - interval '8 days', 1, now_ts + interval '2 days', 'card', 'test', 'mode-seed-test-5');

  -- ============ PROMO CODES: 3 LIVE + 2 TEST ============
  INSERT INTO promo_codes (id, tenant_id, code, description, discount_type, discount_value, mode)
  VALUES (gen_random_uuid(), tid, 'LAUNCH20', 'Launch discount', 'percentage', 20, 'live');
  INSERT INTO promo_codes (id, tenant_id, code, description, discount_type, discount_value, mode)
  VALUES (gen_random_uuid(), tid, 'SAVE500', 'Fixed discount', 'fixed', 50000, 'live');
  INSERT INTO promo_codes (id, tenant_id, code, description, discount_type, discount_value, plan_id, mode)
  VALUES (gen_random_uuid(), tid, 'PROONLY', 'Pro plan only', 'percentage', 15, plan_pro_live, 'live');

  INSERT INTO promo_codes (id, tenant_id, code, description, discount_type, discount_value, mode)
  VALUES (gen_random_uuid(), tid, 'TESTLAUNCH', 'Launch discount (test)', 'percentage', 20, 'test');
  INSERT INTO promo_codes (id, tenant_id, code, description, discount_type, discount_value, mode)
  VALUES (gen_random_uuid(), tid, 'TESTSAVE', 'Fixed discount (test)', 'fixed', 50000, 'test');

  -- ============ WEBHOOK ENDPOINTS: 1 LIVE + 1 TEST ============
  INSERT INTO webhook_endpoints (id, tenant_id, url, events, secret, api_version, mode)
  VALUES (gen_random_uuid(), tid, 'https://classpay.example.com/webhooks/tori', ARRAY['*'], 'whsec_live_demo_a1b2c3d4e5f6789012345678', '2026-06-01', 'live');
  INSERT INTO webhook_endpoints (id, tenant_id, url, events, secret, api_version, mode)
  VALUES (gen_random_uuid(), tid, 'https://classpay-staging.example.com/webhooks/tori', ARRAY['*'], 'whsec_test_demo_a1b2c3d4e5f6789012345678', '2026-06-01', 'test');

END $$;

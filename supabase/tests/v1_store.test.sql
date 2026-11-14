-- v1 PACE Store partners: every redemption gate, code pools, concurrency,
-- the PACE ledger, anonymous views and the partner report.
-- Run after _stub_supabase.sql, 20261106000001, _stub_notifications.sql,
-- 20261106000002, _stub_store.sql, 20261106000003 (see README.md).
-- Uses dblink to run two redemptions at the same time, connecting back to
-- this same database over the local socket.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS dblink;
-- Fixture rows are committed (the race below runs on two real connections), so
-- clear anything a previous run left, here and again at the end.
DELETE FROM pace_redemptions WHERE user_id::text LIKE 'b0000000-%';
DELETE FROM reward_codes WHERE reward_id::text LIKE 'd0000000-%';
DELETE FROM reward_events WHERE reward_id::text LIKE 'd0000000-%';
DELETE FROM reward_view_keys WHERE true AND EXISTS (SELECT 1);
DELETE FROM pace_store_rewards WHERE id::text LIKE 'd0000000-%';
DELETE FROM partners WHERE id::text LIKE 'c0000000-%';
DELETE FROM auth.users WHERE id::text LIKE 'b0000000-%';
-- Rewards gained required brand/description/value_label after these tests were written;
-- defaults for this transaction only.
ALTER TABLE public.pace_store_rewards ALTER COLUMN brand SET DEFAULT 'Test brand',
  ALTER COLUMN description SET DEFAULT 'Test reward', ALTER COLUMN value_label SET DEFAULT 'Test';
SET client_min_messages = notice;

CREATE OR REPLACE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF;
  RAISE NOTICE 'ok  %', what;
END $$;

SELECT set_config('test.role', 'service_role', false);

-- Runners. Bengaluru point is inside the Bengaluru launch city.
INSERT INTO auth.users (id, email) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'v1-b0000000-0@example.com'),
  ('b0000000-0000-0000-0000-000000000002', 'v1-b0000000-1@example.com'),
  ('b0000000-0000-0000-0000-000000000003', 'v1-b0000000-2@example.com'),
  ('b0000000-0000-0000-0000-000000000004', 'v1-b0000000-3@example.com'),
  ('b0000000-0000-0000-0000-000000000005', 'v1-b0000000-4@example.com'),
  ('b0000000-0000-0000-0000-000000000006', 'v1-b0000000-5@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO profiles (id, username, created_at, total_runs, pace_balance, pace_total_earned, pace_weekly_earned,
                      runner_rank, subscription_tier, country, last_known_location) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'vet',     now() - interval '30 days', 5, 500, 900, 40, 'chaser',  'free',    'IN', ST_SetSRID(ST_MakePoint(77.60, 12.97), 4326)),
  ('b0000000-0000-0000-0000-000000000002', 'newbie',  now() - interval '3 days',  5, 500, 900, 40, 'chaser',  'free',    'IN', ST_SetSRID(ST_MakePoint(77.60, 12.97), 4326)),
  ('b0000000-0000-0000-0000-000000000003', 'fewruns', now() - interval '30 days', 2, 500, 900, 40, 'chaser',  'free',    'IN', ST_SetSRID(ST_MakePoint(77.60, 12.97), 4326)),
  ('b0000000-0000-0000-0000-000000000004', 'plus',    now() - interval '30 days', 9, 500, 900, 40, 'hunter',  'premium', 'IN', ST_SetSRID(ST_MakePoint(72.88, 19.07), 4326)),
  ('b0000000-0000-0000-0000-000000000005', 'broke',   now() - interval '30 days', 9,  20, 900, 40, 'chaser',  'free',    'IN', ST_SetSRID(ST_MakePoint(77.60, 12.97), 4326)),
  ('b0000000-0000-0000-0000-000000000006', 'racer',   now() - interval '30 days', 9, 500, 900, 40, 'chaser',  'free',    'IN', ST_SetSRID(ST_MakePoint(77.60, 12.97), 4326))
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, created_at = EXCLUDED.created_at, total_runs = EXCLUDED.total_runs, pace_balance = EXCLUDED.pace_balance, pace_total_earned = EXCLUDED.pace_total_earned, pace_weekly_earned = EXCLUDED.pace_weekly_earned, runner_rank = EXCLUDED.runner_rank, subscription_tier = EXCLUDED.subscription_tier, country = EXCLUDED.country, last_known_location = EXCLUDED.last_known_location;

SELECT pg_temp.check(city_for_point(last_known_location) = 'Bengaluru', 'a Bengaluru point maps to Bengaluru')
FROM profiles WHERE username = 'vet';
SELECT pg_temp.check(city_for_point(ST_SetSRID(ST_MakePoint(0, 51.5), 4326)) IS NULL, 'London is not a launch city');

INSERT INTO partners (id, name, billing_model, fee_per_redemption, billing_starts_on, status) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Brooks', 'cost_per_redemption', 1.50, date_trunc('month', now())::date, 'active'),
  ('c0000000-0000-0000-0000-000000000002', 'Third Wave', 'free_listing', 0, NULL, 'active');

INSERT INTO pace_store_rewards (id, title, pace_cost, partner_id, code_mode, cities, status, starts_at, expires_at, plus_only, min_rank, countries, static_code, stock) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'Pool, Bengaluru', 100, 'c0000000-0000-0000-0000-000000000001', 'pool',   '{Bengaluru}', 'available', NULL, NULL, false, NULL, NULL, NULL, NULL),
  ('d0000000-0000-0000-0000-000000000002', 'Plus only',        50, 'c0000000-0000-0000-0000-000000000001', 'none',   NULL, 'available', NULL, NULL, true,  NULL, NULL, NULL, NULL),
  ('d0000000-0000-0000-0000-000000000003', 'Hunters',          50, 'c0000000-0000-0000-0000-000000000001', 'none',   NULL, 'available', NULL, NULL, false, 'hunter', NULL, NULL, NULL),
  ('d0000000-0000-0000-0000-000000000004', 'Expired',          50, NULL, 'none', NULL, 'available', NULL, now() - interval '1 hour', false, NULL, NULL, NULL, NULL),
  ('d0000000-0000-0000-0000-000000000005', 'Tomorrow',         50, NULL, 'none', NULL, 'available', now() + interval '1 day', NULL, false, NULL, NULL, NULL, NULL),
  ('d0000000-0000-0000-0000-000000000006', 'Coming soon',      50, NULL, 'none', NULL, 'coming_soon', NULL, NULL, false, NULL, NULL, NULL, NULL),
  ('d0000000-0000-0000-0000-000000000007', 'US only',          50, NULL, 'none', NULL, 'available', NULL, NULL, false, NULL, '{US}', NULL, NULL),
  ('d0000000-0000-0000-0000-000000000008', 'Static, 1 left',   60, 'c0000000-0000-0000-0000-000000000002', 'static', NULL, 'available', NULL, NULL, false, NULL, NULL, 'CAFE-RUN', 1),
  ('d0000000-0000-0000-0000-000000000009', 'Last code',        30, 'c0000000-0000-0000-0000-000000000001', 'pool',   NULL, 'available', NULL, NULL, false, NULL, NULL, NULL, NULL);

INSERT INTO reward_codes (reward_id, code, created_at) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'BRK-AAA', now() - interval '2 min'),
  ('d0000000-0000-0000-0000-000000000001', 'BRK-BBB', now() - interval '1 min'),
  ('d0000000-0000-0000-0000-000000000009', 'LAST-1',  now());

CREATE TEMP TABLE res(who text, r jsonb);
CREATE FUNCTION pg_temp.redeem(who text, reward text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE j jsonb;
BEGIN
  SELECT redeem_reward(p.id, reward::uuid) INTO j FROM profiles p WHERE p.username = who;
  RETURN j;
END $$;

-- ── Gates ───────────────────────────────────────────────────────────────────
SELECT pg_temp.check(pg_temp.redeem('vet', 'd0000000-0000-0000-0000-000000000099')->>'reason' = 'not_found', 'unknown reward: not_found');
SELECT pg_temp.check(pg_temp.redeem('vet', 'd0000000-0000-0000-0000-000000000006')->>'reason' = 'not_available', 'coming soon: not_available');
SELECT pg_temp.check(pg_temp.redeem('vet', 'd0000000-0000-0000-0000-000000000005')->>'reason' = 'not_started', 'starts tomorrow: not_started');
SELECT pg_temp.check(pg_temp.redeem('vet', 'd0000000-0000-0000-0000-000000000004')->>'reason' = 'expired', 'past expiry: expired');
SELECT pg_temp.check(pg_temp.redeem('vet', 'd0000000-0000-0000-0000-000000000007')->>'reason' = 'not_in_region', 'other country: not_in_region');
SELECT pg_temp.check(pg_temp.redeem('plus', 'd0000000-0000-0000-0000-000000000001')->>'reason' = 'not_in_region', 'Mumbai runner, Bengaluru reward: not_in_region');
SELECT pg_temp.check(pg_temp.redeem('vet', 'd0000000-0000-0000-0000-000000000002')->>'reason' = 'plus_only', 'free runner, Plus reward: plus_only');
SELECT pg_temp.check(pg_temp.redeem('vet', 'd0000000-0000-0000-0000-000000000003')->>'reason' = 'rank_locked', 'chaser, Hunter reward: rank_locked');
SELECT pg_temp.check(pg_temp.redeem('newbie', 'd0000000-0000-0000-0000-000000000001')->>'reason' = 'new_account', 'account 3 days old: new_account');
SELECT pg_temp.check(pg_temp.redeem('fewruns', 'd0000000-0000-0000-0000-000000000001')->>'reason' = 'new_account', 'only 2 runs: new_account');
SELECT pg_temp.check(pg_temp.redeem('broke', 'd0000000-0000-0000-0000-000000000001')->>'reason' = 'not_enough_pace', '20 PACE, 100 reward: not_enough_pace');
SELECT pg_temp.check((pg_temp.redeem('plus', 'd0000000-0000-0000-0000-000000000002')->>'ok')::boolean, 'Plus runner redeems the Plus reward');
SELECT pg_temp.check((pg_temp.redeem('plus', 'd0000000-0000-0000-0000-000000000003')->>'ok')::boolean, 'Hunter redeems the Hunter reward');

-- ── Pool: one code each, PACE taken once, earnings untouched ────────────────
INSERT INTO res SELECT 'vet1', pg_temp.redeem('vet', 'd0000000-0000-0000-0000-000000000001');
SELECT pg_temp.check((r->>'ok')::boolean AND r->>'code' = 'BRK-AAA' AND (r->>'balance')::int = 400,
                     'first redemption gets the oldest code and leaves 400 PACE') FROM res WHERE who = 'vet1';
INSERT INTO res SELECT 'vet2', pg_temp.redeem('vet', 'd0000000-0000-0000-0000-000000000001');
SELECT pg_temp.check(r->>'reason' = 'already_redeemed', 'second try: already_redeemed') FROM res WHERE who = 'vet2';
SELECT pg_temp.check(pace_balance = 400 AND pace_total_earned = 900 AND pace_weekly_earned = 40,
                     'PACE taken exactly once; lifetime and weekly earned untouched') FROM profiles WHERE username = 'vet';
SELECT pg_temp.check(assigned_to = 'b0000000-0000-0000-0000-000000000001' AND assigned_at IS NOT NULL,
                     'the code is assigned to that runner') FROM reward_codes WHERE code = 'BRK-AAA';
SELECT pg_temp.check(fulfillment_code = 'BRK-AAA' AND fulfilled_at IS NOT NULL AND pace_spent = 100,
                     'the redemption keeps the code') FROM pace_redemptions
WHERE user_id = 'b0000000-0000-0000-0000-000000000001' AND reward_id = 'd0000000-0000-0000-0000-000000000001';
SELECT pg_temp.check((pg_temp.redeem('racer', 'd0000000-0000-0000-0000-000000000001')->>'code') = 'BRK-BBB', 'the next runner gets the next code');
SELECT pg_temp.check(pg_temp.redeem('broke', 'd0000000-0000-0000-0000-000000000001')->>'reason' = 'sold_out', 'empty pool: sold_out');

-- ── Static code with stock ──────────────────────────────────────────────────
SELECT pg_temp.check(pg_temp.redeem('vet', 'd0000000-0000-0000-0000-000000000008')->>'code' = 'CAFE-RUN', 'static code is handed out');
SELECT pg_temp.check(stock = 0, 'stock goes down by one') FROM pace_store_rewards WHERE id = 'd0000000-0000-0000-0000-000000000008';
SELECT pg_temp.check(pg_temp.redeem('racer', 'd0000000-0000-0000-0000-000000000008')->>'reason' = 'sold_out', 'no stock left: sold_out');

-- ── Two runners, one code, at the same time ─────────────────────────────────
CREATE TEMP TABLE conn AS SELECT format('host=%s port=%s user=%s dbname=%s',
  split_part(current_setting('unix_socket_directories'), ',', 1), current_setting('port'),
  current_user, current_database()) AS s;
SELECT dblink_connect('a', s) FROM conn;
SELECT dblink_connect('b', s) FROM conn;
SELECT dblink_exec('a', $$SET test.role = 'service_role'$$);
SELECT dblink_exec('b', $$SET test.role = 'service_role'$$);
SELECT dblink_exec('a', 'BEGIN');
INSERT INTO res SELECT 'racerA', j::jsonb FROM dblink('a',
  $$SELECT redeem_reward('b0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000009')::text$$) AS t(j text);
-- B starts while A still holds the reward: it has to wait.
SELECT dblink_send_query('b', $$SELECT redeem_reward('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009')::text$$);
SELECT pg_sleep(0.3);
SELECT pg_temp.check(dblink_is_busy('b') = 1, 'the second redemption waits for the first');
SELECT dblink_exec('a', 'COMMIT');
INSERT INTO res SELECT 'vetB', j::jsonb FROM dblink_get_result('b') AS t(j text);
SELECT dblink_get_result('b');
SELECT dblink_disconnect('a'); SELECT dblink_disconnect('b');
SELECT pg_temp.check((SELECT r->>'code' FROM res WHERE who = 'racerA') = 'LAST-1'
                     AND (SELECT r->>'reason' FROM res WHERE who = 'vetB') = 'sold_out',
                     'two at once for the last code: one gets it, the other sees sold_out');
SELECT pg_temp.check(pace_balance = 340, 'the loser kept their PACE (400 - 60 static, nothing for the pool)')
FROM profiles WHERE username = 'vet';
SELECT pg_temp.check((SELECT count(*) FROM reward_codes WHERE code = 'LAST-1' AND assigned_to IS NOT NULL) = 1, 'the last code went out once');

-- ── App catalogue and anonymous views ───────────────────────────────────────
SELECT set_config('test.role', 'authenticated', false);
SELECT set_config('test.uid', 'b0000000-0000-0000-0000-000000000004', false);  -- Plus runner in Mumbai
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM store_catalog() WHERE title IN ('Pool, Bengaluru', 'US only')),
                     'catalogue hides other cities'' and countries'' rewards');
SELECT pg_temp.check((SELECT redeemed FROM store_catalog() WHERE title = 'Plus only'), 'catalogue marks what I redeemed');
SELECT set_config('test.uid', 'b0000000-0000-0000-0000-000000000001', false);  -- vet in Bengaluru
SELECT pg_temp.check((SELECT lock_reason FROM store_catalog() WHERE title = 'Hunters') = 'rank_locked'
                 AND (SELECT lock_reason FROM store_catalog() WHERE title = 'Plus only') = 'plus_only'
                 AND (SELECT lock_reason FROM store_catalog() WHERE title = 'Pool, Bengaluru') = 'already_redeemed',
                     'catalogue gives each reward my lock reason');
SELECT pg_temp.check((SELECT my_code FROM store_catalog() WHERE title = 'Pool, Bengaluru') = 'BRK-AAA', 'catalogue shows my own code');
SELECT pg_temp.check((SELECT stock_left FROM store_catalog() WHERE title = 'Last code') = 0, 'catalogue counts codes left');
SELECT pg_temp.check(log_reward_view('d0000000-0000-0000-0000-000000000001'), 'a view is logged');
SELECT pg_temp.check(NOT log_reward_view('d0000000-0000-0000-0000-000000000001'), 'the same runner''s second view today is not');
SELECT set_config('test.uid', 'b0000000-0000-0000-0000-000000000006', false);
SELECT log_reward_view('d0000000-0000-0000-0000-000000000001');
SELECT set_config('test.uid', 'b0000000-0000-0000-0000-000000000005', false);
SELECT log_reward_view('d0000000-0000-0000-0000-000000000001');
SELECT set_config('test.role', 'service_role', false);

SELECT pg_temp.check(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_name IN ('reward_events', 'reward_view_keys') AND column_name LIKE '%user%'),
  'report events keep no user id');

-- ── Partner report ──────────────────────────────────────────────────────────
CREATE TEMP TABLE rep AS SELECT partner_monthly_report('c0000000-0000-0000-0000-000000000001', current_date) AS j;
-- Brooks: Pool, Bengaluru (2 redeemed, 3 views), Plus only (1), Hunters (1), Last code (1) = 5 redemptions.
SELECT pg_temp.check((j->'totals'->>'redemptions')::int = 5 AND (j->'totals'->>'views')::int = 3, 'report totals: 5 redemptions, 3 views') FROM rep;
SELECT pg_temp.check((j->>'fee_owed')::numeric = 7.50, 'cost per redemption: 5 × 1.50 = 7.50 owed') FROM rep;
SELECT pg_temp.check(EXISTS (SELECT 1 FROM jsonb_array_elements(j->'rewards') e
                              WHERE e->>'title' = 'Pool, Bengaluru' AND (e->>'redemptions')::int = 2
                                AND (e->>'views')::int = 3 AND (e->>'redemption_rate')::numeric = 0.6667),
                     'per reward: 2 of 3 views redeemed (0.6667)') FROM rep;
SELECT pg_temp.check(EXISTS (SELECT 1 FROM jsonb_array_elements(j->'by_city') e
                              WHERE e->>'city' = 'Bengaluru' AND (e->>'redemptions')::int = 3)
                 AND EXISTS (SELECT 1 FROM jsonb_array_elements(j->'by_city') e
                              WHERE e->>'city' = 'Mumbai' AND (e->>'redemptions')::int = 2),
                     'by city: Bengaluru 3, Mumbai 2') FROM rep;
SELECT pg_temp.check(EXISTS (SELECT 1 FROM jsonb_array_elements(j->'by_rank') e
                              WHERE e->>'rank' = 'hunter' AND (e->>'redemptions')::int = 2),
                     'by rank: Hunters redeemed 2') FROM rep;
SELECT pg_temp.check(position('b0000000' IN j::text) = 0 AND position('vet' IN j::text) = 0,
                     'the report contains no runner ids or names') FROM rep;
SELECT pg_temp.check((partner_monthly_report('c0000000-0000-0000-0000-000000000002', current_date)->>'fee_owed')::numeric = 0,
                     'free listing owes nothing');
UPDATE partners SET billing_starts_on = (date_trunc('month', now()) + interval '1 month')::date
 WHERE id = 'c0000000-0000-0000-0000-000000000001';
SELECT pg_temp.check((partner_monthly_report('c0000000-0000-0000-0000-000000000001', current_date)->>'fee_owed')::numeric = 0,
                     'before billing starts, nothing is owed');

-- ── Lockdown ────────────────────────────────────────────────────────────────
SELECT set_config('test.role', 'authenticated', false);
DO $$ BEGIN
  PERFORM redeem_reward('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003');
  RAISE EXCEPTION 'FAILED: a client could call redeem_reward';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAILED%' THEN RAISE; END IF;
  RAISE NOTICE 'ok  redeem_reward refuses non-service callers';
END $$;
SELECT pg_temp.check(NOT has_function_privilege('authenticated', 'partner_monthly_report(uuid, date)', 'EXECUTE')
                 AND NOT has_function_privilege('authenticated', 'redeem_reward(uuid, uuid, double precision, double precision)', 'EXECUTE')
                 AND has_function_privilege('authenticated', 'store_catalog(double precision, double precision)', 'EXECUTE'),
                     'runners can browse, but not redeem directly or read reports');
SELECT pg_temp.check((SELECT relrowsecurity FROM pg_class WHERE relname = 'partners')
                 AND (SELECT relrowsecurity FROM pg_class WHERE relname = 'reward_codes')
                 AND (SELECT relrowsecurity FROM pg_class WHERE relname = 'reward_events'),
                     'partners, codes and events are behind row-level security');

SELECT 'ALL STORE CHECKS PASSED' AS result;
-- Fixture rows are committed (the race below runs on two real connections), so
-- clear anything a previous run left, here and again at the end.
DELETE FROM pace_redemptions WHERE user_id::text LIKE 'b0000000-%';
DELETE FROM reward_codes WHERE reward_id::text LIKE 'd0000000-%';
DELETE FROM reward_events WHERE reward_id::text LIKE 'd0000000-%';
DELETE FROM reward_view_keys WHERE true AND EXISTS (SELECT 1);
DELETE FROM pace_store_rewards WHERE id::text LIKE 'd0000000-%';
DELETE FROM partners WHERE id::text LIKE 'c0000000-%';
DELETE FROM auth.users WHERE id::text LIKE 'b0000000-%';
ALTER TABLE public.pace_store_rewards ALTER COLUMN brand DROP DEFAULT,
  ALTER COLUMN description DROP DEFAULT, ALTER COLUMN value_label DROP DEFAULT;

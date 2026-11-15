-- City rewards with a device point, and partner applications.
-- Run right after v1_store.test.sql and 20261106000006 (see README.md).
\set ON_ERROR_STOP on
BEGIN;
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

-- City rewards unlock for runners with a recent scored run that started in the
-- city (20261115000024). Give each runner one where their saved point is, then
-- put the run counts back (the insert trigger counts the run).
CREATE FUNCTION pg_temp.ran_in(p_user uuid, p_where geometry) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, verified_distance_m, route)
  VALUES (gen_random_uuid(), p_user, 'run', now() - interval '2 days', now() - interval '2 days' + interval '30 minutes', 5000, 1800, '6:00', 5000,
          ST_SetSRID(ST_MakeLine(p_where, ST_Translate(p_where, 0.001, 0)), 4326));
$$;

-- A runner who passes every gate but has never saved a location.
INSERT INTO auth.users (id, email) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'v1-e1000000-0@example.com'),
  ('e1000000-0000-0000-0000-000000000002', 'v1-e1000000-1@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO profiles (id, username, created_at, total_runs, pace_balance, pace_total_earned, pace_weekly_earned,
                      runner_rank, subscription_tier, country, last_known_location) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'nolocA', now() - interval '30 days', 5, 500, 900, 40, 'chaser', 'free', 'IN', NULL),
  ('e1000000-0000-0000-0000-000000000002', 'nolocB', now() - interval '30 days', 5, 500, 900, 40, 'chaser', 'free', 'IN', NULL)
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, created_at = EXCLUDED.created_at, total_runs = EXCLUDED.total_runs, pace_balance = EXCLUDED.pace_balance, pace_total_earned = EXCLUDED.pace_total_earned, pace_weekly_earned = EXCLUDED.pace_weekly_earned, runner_rank = EXCLUDED.runner_rank, subscription_tier = EXCLUDED.subscription_tier, country = EXCLUDED.country, last_known_location = EXCLUDED.last_known_location;

INSERT INTO pace_store_rewards (id, title, pace_cost, code_mode, cities, status, plus_only) VALUES
  ('e2000000-0000-0000-0000-000000000001', 'Pune café', 40, 'none', '{Pune}', 'available', false);

-- Pune centre 18.5204, 73.8567; Delhi is far outside Pune's 35 km.
SELECT pg_temp.check(point_from_latlng(18.52, 73.86) IS NOT NULL, 'a real coordinate makes a point');
SELECT pg_temp.check(point_from_latlng(NULL, 73.86) IS NULL
                 AND point_from_latlng('NaN', 73.86) IS NULL
                 AND point_from_latlng(18.52, 'Infinity') IS NULL
                 AND point_from_latlng(95, 73.86) IS NULL
                 AND point_from_latlng(18.52, -200) IS NULL, 'null, NaN, infinite and out-of-range points are ignored');

SELECT set_config('test.role', 'authenticated', false);
SELECT set_config('test.uid', 'e1000000-0000-0000-0000-000000000001', false);
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM store_catalog() WHERE title = 'Pune café'),
                     'no saved location, no point: the city reward is hidden, as before');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM store_catalog(18.52, 73.86) WHERE title = 'Pune café' AND lock_reason = 'not_in_region'),
                     'no saved location, a point inside Pune: the reward shows (locked until a run there)');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM store_catalog(28.61, 77.21) WHERE title = 'Pune café'),
                     'a point in Delhi: the Pune reward is hidden');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM store_catalog('NaN', 73.86) WHERE title = 'Pune café'),
                     'an invalid point is ignored, not treated as a location');
SELECT pg_temp.check(log_reward_view('e2000000-0000-0000-0000-000000000001', 18.52, 73.86), 'a view with a point is logged');

SELECT set_config('test.role', 'service_role', false);
SELECT pg_temp.check((SELECT city FROM reward_events WHERE reward_id = 'e2000000-0000-0000-0000-000000000001' AND event = 'view') = 'Pune',
                     'the report city comes from the point');

SELECT pg_temp.check((redeem_reward('e1000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000001', 28.61, 77.21))->>'reason' = 'not_in_region',
                     'redeeming with a point outside the city is blocked: not_in_region');
SELECT pg_temp.check((redeem_reward('e1000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000001', 95, 77.21))->>'reason' = 'not_in_region',
                     'redeeming with an invalid point falls back to no location: not_in_region');
SELECT pg_temp.check((redeem_reward('e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 18.52, 73.86))->>'reason' = 'not_in_region',
                     'a point inside Pune alone no longer unlocks it: the app can send any point');
SELECT pg_temp.ran_in('e1000000-0000-0000-0000-000000000001', ST_SetSRID(ST_MakePoint(73.86, 18.52), 4326));
UPDATE profiles SET total_runs = 5 WHERE id = 'e1000000-0000-0000-0000-000000000001';
SELECT pg_temp.check((redeem_reward('e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 18.52, 73.86))->>'ok' = 'true',
                     'after a scored run in Pune it unlocks');
SELECT pg_temp.check((SELECT city FROM reward_events WHERE reward_id = 'e2000000-0000-0000-0000-000000000001' AND event = 'redeem') = 'Pune',
                     'the redemption is reported in Pune');
SELECT pg_temp.check((SELECT last_known_location FROM profiles WHERE id = 'e1000000-0000-0000-0000-000000000001') IS NULL,
                     'the device point is never stored on the profile');
SELECT pg_temp.check((SELECT pace_balance FROM profiles WHERE id = 'e1000000-0000-0000-0000-000000000001') = 460,
                     'PACE spent once (500 → 460)');
SELECT pg_temp.check((redeem_reward('e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001'))->>'reason' IN ('already_redeemed', 'not_in_region'),
                     'the old two-argument call still works');

-- ── Partner applications ────────────────────────────────────────────────────

SELECT pg_temp.check(submit_partner_application('Stride Café', 'cafe', 'Meera', 'Meera@Stride.cafe', 'https://stride.cafe',
                       '{IN}', '{Pune,Mumbai}', '1 free cold brew after any 5K', 500) IS NOT NULL,
                     'an application is accepted');
SELECT pg_temp.check((SELECT status = 'applied' AND applied_at IS NOT NULL AND contact_email = 'meera@stride.cafe'
                        AND billing_model = 'free_listing' AND offer LIKE '1 free cold brew%'
                        FROM partners WHERE name = 'Stride Café'),
                     'stored as applied, email lower-cased, free listing by default');
SELECT submit_partner_application('Stride Café 2', 'cafe', 'Meera', 'meera@stride.cafe', NULL, NULL, NULL, 'Another offer here', NULL);
SELECT submit_partner_application('Stride Café 3', 'cafe', 'Meera', 'meera@stride.cafe', NULL, NULL, NULL, 'Another offer here', NULL);

CREATE FUNCTION pg_temp.apply_error(email text, cat text, offer text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM submit_partner_application('Test Co', cat, NULL, email, NULL, NULL, NULL, offer, NULL);
  RETURN 'none';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;

SELECT pg_temp.check(pg_temp.apply_error('meera@stride.cafe', 'cafe', 'A fourth offer') = 'rate_limited',
                     'a fourth application from one email in a day is refused');
SELECT pg_temp.check(pg_temp.apply_error('not-an-email', 'cafe', 'A fine offer') = 'invalid', 'a bad email is refused');
SELECT pg_temp.check(pg_temp.apply_error('a@b.co', 'casino', 'A fine offer') = 'invalid', 'an unknown category is refused');
SELECT pg_temp.check(pg_temp.apply_error('a@b.co', 'cafe', 'hi') = 'invalid', 'an empty offer is refused');

SELECT set_config('test.role', 'authenticated', false);
SELECT pg_temp.check(pg_temp.apply_error('x@y.co', 'cafe', 'A fine offer') LIKE '%service_role only%',
                     'only the server can submit applications');
SELECT set_config('test.role', 'service_role', false);

SELECT 'ALL STORE LOCATION CHECKS PASSED' AS result;
ROLLBACK;

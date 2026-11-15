-- Exercises 20261106000001_v1_pace_and_territory_integrity.sql.
-- Each check raises an exception on failure; a clean run prints "ALL PASSED".
\set ON_ERROR_STOP on

BEGIN;
-- These checks cover the Free/Plus rules as they'll run once subscriptions are on.
UPDATE public.app_settings SET value = 'true' WHERE key = 'subscriptions_enabled';
-- Rewards gained required brand/description/value_label after these tests were written;
-- defaults for this transaction only.
ALTER TABLE public.pace_store_rewards ALTER COLUMN brand SET DEFAULT 'Test brand',
  ALTER COLUMN description SET DEFAULT 'Test reward', ALTER COLUMN value_label SET DEFAULT 'Test';
DROP TRIGGER IF EXISTS protect_profile_columns_t ON public.profiles;
CREATE TRIGGER protect_profile_columns_t BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

CREATE OR REPLACE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;

-- Users: u1 free, u2 premium, u3 free
SELECT set_config('test.role', 'service_role', false);
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'v1-00000000-0@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'v1-00000000-1@example.com'),
  ('00000000-0000-0000-0000-000000000003', 'v1-00000000-2@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO profiles (id, username, subscription_tier) VALUES
  ('00000000-0000-0000-0000-000000000001', 'u1', 'free'),
  ('00000000-0000-0000-0000-000000000002', 'u2', 'premium'),
  ('00000000-0000-0000-0000-000000000003', 'u3', 'free')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, subscription_tier = EXCLUDED.subscription_tier;

-- ── Client can't touch economy columns ────────────────────────────────────────
SELECT set_config('test.role', 'authenticated', false);
UPDATE profiles SET pace_balance = 999, pace_weekly_reset_at = '2000-01-01', runner_rank = 'sovereign'
WHERE id = '00000000-0000-0000-0000-000000000001';
SELECT pg_temp.check(pace_balance = 0 AND runner_rank = 'pacer' AND pace_weekly_reset_at > '2020-01-01',
  'client update of pace_balance / weekly reset / rank is reverted')
FROM profiles WHERE id = '00000000-0000-0000-0000-000000000001';

-- ── Weekly cap, idempotency, rank ─────────────────────────────────────────────
SELECT set_config('test.role', 'service_role', false);
SELECT pg_temp.check(credit_pace_capped('00000000-0000-0000-0000-000000000001', 60, 'run', 'r1') = 60, 'first run credits 60');
SELECT pg_temp.check(credit_pace_capped('00000000-0000-0000-0000-000000000001', 60, 'run', 'r1') = 0, 'replaying the same run credits 0');
SELECT pg_temp.check(credit_pace_capped('00000000-0000-0000-0000-000000000001', 60, 'run', 'r2') = 40, 'free cap stops at 100');
SELECT pg_temp.check(credit_pace_capped('00000000-0000-0000-0000-000000000001', 10, 'run', 'r3') = 0, 'nothing above the cap');
SELECT pg_temp.check(pace_balance = 100 AND pace_weekly_earned = 100 AND pace_total_earned = 100, 'balance, weekly and lifetime agree')
FROM profiles WHERE id = '00000000-0000-0000-0000-000000000001';

UPDATE profiles SET pace_weekly_reset_at = now() - interval '8 days' WHERE id = '00000000-0000-0000-0000-000000000001';
SELECT pg_temp.check(credit_pace_capped('00000000-0000-0000-0000-000000000001', 30, 'run', 'r4') = 30, 'new week resets the cap');
SELECT pg_temp.check(pace_weekly_earned = 30 AND pace_total_earned = 130, 'weekly counter restarts, lifetime keeps growing')
FROM profiles WHERE id = '00000000-0000-0000-0000-000000000001';

SELECT pg_temp.check(credit_pace_capped('00000000-0000-0000-0000-000000000002', 140, 'run', 'p1') = 140, 'premium earns past 100');
SELECT pg_temp.check(credit_pace_capped('00000000-0000-0000-0000-000000000002', 40, 'run', 'p2') = 10, 'premium cap stops at 150');

UPDATE profiles SET pace_weekly_reset_at = now() - interval '8 days' WHERE id = '00000000-0000-0000-0000-000000000001';
SELECT credit_pace_capped('00000000-0000-0000-0000-000000000001', 100, 'run', 'r5');
SELECT pg_temp.check(runner_rank = 'strider', 'rank follows lifetime PACE (230 -> strider)')
FROM profiles WHERE id = '00000000-0000-0000-0000-000000000001';
SELECT pg_temp.check(credit_pace_capped('00000000-0000-0000-0000-000000000001', 0, 'run', 'r6') = 0, 'zero amounts credit nothing');

-- ── Missions: credited despite the trigger, once per title per day ────────────
-- Missions now need the work done: an 8 km run today for Long Haul.
SELECT set_config('test.role', 'service_role', false);
INSERT INTO runs (user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace)
VALUES ('00000000-0000-0000-0000-000000000003', 'run', date_trunc('day', now()) + interval '1 minute', date_trunc('day', now()) + interval '50 minutes', 8200, 2940, '6:00');
UPDATE profiles SET pace_weekly_reset_at = now() - interval '8 days' WHERE id = '00000000-0000-0000-0000-000000000003';
SELECT set_config('test.role', 'authenticated', false);
SELECT set_config('test.uid', '00000000-0000-0000-0000-000000000003', false);
SELECT pg_temp.check(claim_mission_reward('daily-a', 'Long Haul') = 35, 'mission reward is credited (not reverted by the trigger)');
SELECT pg_temp.check(claim_mission_reward('daily-b', 'Long Haul') = 0, 'same mission under a new id pays 0');
SELECT pg_temp.check(claim_mission_reward('daily-c', 'Unknown') = 0, 'unknown mission pays 0');
SELECT set_config('test.role', 'service_role', false);
SELECT pg_temp.check(pace_balance = 35, 'mission PACE is in the balance') FROM profiles WHERE id = '00000000-0000-0000-0000-000000000003';

-- ── Territory geometry ────────────────────────────────────────────────────────
-- 200 m square near Hyde Park (lat 51.507): 0.0017976 deg lat, 0.0028845 deg lng
CREATE TEMP TABLE g AS SELECT
  'LINESTRING(-0.165 51.507, -0.1621155 51.507, -0.1621155 51.5087976, -0.165 51.5087976, -0.165 51.507)'::text AS loop_line,
  'POLYGON((-0.165 51.507, -0.1621155 51.507, -0.1621155 51.5087976, -0.165 51.5087976, -0.165 51.507))'::text AS loop_ring,
  'LINESTRING(-0.165 51.507, -0.1563465 51.507, -0.165 51.507)'::text AS out_back;

SELECT pg_temp.check(is_loop AND area_m2 BETWEEN 48000 AND 52500, 'loop = interior + strip (~50k m²): ' || round(area_m2))
FROM g, build_territory_geom(g.loop_line, g.loop_ring);
SELECT pg_temp.check(NOT is_loop AND area_m2 BETWEEN 14000 AND 15500, 'out-and-back 600 m = 24 m strip (~14.8k m²): ' || round(area_m2))
FROM g, build_territory_geom(g.out_back, NULL);
SELECT pg_temp.check(ST_IsValid(ST_GeomFromText(wkt, 4326)), 'self-crossing route still gives valid geometry')
FROM build_territory_geom('LINESTRING(-0.165 51.507, -0.162 51.509, -0.162 51.507, -0.165 51.509)', NULL);

-- Claim: u1 takes the loop
INSERT INTO runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'run', now() - interval '5 hours', now() - interval '5 hours', 0, 0, '0:00'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'run', now() - interval '6 hours', now() - interval '6 hours', 0, 0, '0:00');
SELECT pg_temp.check(c.pieces = 1 AND c.area_m2 > 48000, 'free land is claimed in full')
FROM g, build_territory_geom(g.loop_line, g.loop_ring) b,
     claim_unclaimed_area(b.wkt, '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', true) c;
SELECT pg_temp.check(is_loop_fill AND tier = 'district', 'stored as a loop, district tier (50.1k m²)') FROM territory_polygons WHERE run_id = '10000000-0000-0000-0000-000000000001';

-- Steal: u2 runs a strip through the middle
SELECT pg_temp.check(
  steal_territory_portion(t.id, b.wkt, '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002') > 5000,
  'a steal returns the area that moved')
FROM territory_polygons t,
     build_territory_geom('LINESTRING(-0.1663 51.5079, -0.1608 51.5079)', NULL) b
WHERE t.owner_id = '00000000-0000-0000-0000-000000000001';
SELECT pg_temp.check(count(*) >= 2, 'rival keeps the leftover parts') FROM territory_polygons WHERE owner_id = '00000000-0000-0000-0000-000000000001';
SELECT pg_temp.check(bool_and(tier = CASE WHEN area_m2 < 5000 THEN 'patch' WHEN area_m2 < 50000 THEN 'block' ELSE tier END), 'leftover tiers recomputed')
FROM territory_polygons WHERE owner_id = '00000000-0000-0000-0000-000000000001';
SELECT pg_temp.check(
  steal_territory_portion(t.id, 'POLYGON((10 10, 10.0001 10, 10.0001 10.0001, 10 10))', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002') = 0,
  'a miss steals nothing and pays nothing')
FROM territory_polygons t WHERE t.owner_id = '00000000-0000-0000-0000-000000000001' LIMIT 1;

-- Decay floors to whole points
UPDATE territory_polygons SET last_defended_at = now() - interval '6.01 days', freshness = 100
WHERE owner_id = '00000000-0000-0000-0000-000000000001';
SELECT pg_temp.check(min(freshness) = 39, 'decay after 6.01 days = 39 (floored, matches the app)')
FROM g, find_intersecting_territories(g.loop_ring, '00000000-0000-0000-0000-000000000002');

-- Daily score refresh
SELECT refresh_all_territory_scores();
SELECT pg_temp.check(territory_score > 0 AND territory_score < 50000, 'territory score refreshed with decay applied')
FROM profiles WHERE id = '00000000-0000-0000-0000-000000000001';

-- ── Redemption ────────────────────────────────────────────────────────────────
INSERT INTO pace_store_rewards (id, title, pace_cost, expires_at, stock, status, code_mode) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Expired', 10, now() - interval '1 day', NULL, 'available', 'none'),
  ('20000000-0000-0000-0000-000000000002', 'One left', 10, NULL, 1, 'available', 'none');
-- redeem_reward now returns jsonb: a reason when refused (see v1_store for the full rules).
SELECT set_config('test.role', 'service_role', false);
UPDATE profiles SET pace_balance = 100, created_at = now() - interval '60 days', total_runs = 10 WHERE id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
SELECT pg_temp.check(redeem_reward('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001')->>'reason' IS NOT NULL, 'expired reward cannot be redeemed');
SELECT pg_temp.check(redeem_reward('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002')->>'reason' IS NULL, 'last unit can be redeemed');
SELECT pg_temp.check(redeem_reward('00000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002')->>'reason' = 'sold_out', 'sold-out reward is refused');

SELECT 'ALL PASSED' AS result;
ROLLBACK;

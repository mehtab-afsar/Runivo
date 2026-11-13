-- Map visibility (20261112000001_map_visibility.sql).
-- Runs against a database with every migration applied; wrapped in a
-- transaction and rolled back, so it leaves nothing behind.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/map_visibility.test.sql
\set ON_ERROR_STOP on
BEGIN;

CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;

-- A runner and a 3 km straight run north, a point every 50 m (61 points).
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES ('22222222-2222-4222-8222-222222222222', 'mapvis@example.com')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES ('22222222-2222-4222-8222-222222222222', 'mapvis_runner')
  ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE route AS
SELECT jsonb_agg(jsonb_build_object('lat', 12.9 + i * 50 / 111320.0, 'lng', 77.6, 'timestamp', i * 20000) ORDER BY i) AS pts
FROM generate_series(0, 60) i;

INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points)
SELECT '33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'run',
       now() - interval '30 minutes', now() - interval '10 minutes', 3000, 1200, '6:40', pts
FROM route;

INSERT INTO public.feed_posts (user_id, run_id, distance_km, route_points)
SELECT '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', 3, pts FROM route;

CREATE FUNCTION pg_temp.n() RETURNS int LANGUAGE sql AS $$
  SELECT jsonb_array_length(route_points) FROM public.feed_posts WHERE run_id = '33333333-3333-4333-8333-333333333333' $$;

-- 61 points; 200 m = 4 steps, strictly inside drops 0..4 and 56..60 → 51 left.
SELECT pg_temp.check(pg_temp.n() = 51, 'default: 200 m hidden at each end (51 of 61 points)');
SELECT pg_temp.check(
  (SELECT (route_points->0->>'lat')::numeric = round((12.9 + 5 * 50 / 111320.0)::numeric, 4)
     FROM public.feed_posts WHERE run_id = '33333333-3333-4333-8333-333333333333'),
  'first visible point is 250 m from the start, rounded to 4 decimals');

SET LOCAL test.uid = '22222222-2222-4222-8222-222222222222';
SET LOCAL test.role = 'authenticated';

SELECT public.set_map_visibility(800, false);
-- 800 m = 16 steps each end → 61 - 2*17 = 27.
SELECT pg_temp.check(pg_temp.n() = 27, '800 m hides more of past posts (27 left)');

SELECT public.set_map_visibility(200, false);
SELECT pg_temp.check(pg_temp.n() = 51, 'going back to 200 m restores the route from the private run');

SELECT public.set_map_visibility(400, true);
SELECT pg_temp.check(pg_temp.n() = 0, 'hide all maps empties every post');

SELECT public.set_map_visibility(400, false);
-- 400 m = 8 steps each end → 61 - 18 = 43.
SELECT pg_temp.check(pg_temp.n() = 43, 'turning hide-all off brings the maps back at the chosen radius');

SELECT pg_temp.check(public.set_activity_map_hidden('33333333-3333-4333-8333-333333333333', true) = 1, 'hiding one activity finds its post');
SELECT pg_temp.check(pg_temp.n() = 0, 'that activity posts without a map');
SELECT public.set_activity_map_hidden('33333333-3333-4333-8333-333333333333', false);
SELECT pg_temp.check(pg_temp.n() = 43, 'showing it again restores it at the chosen radius');

-- A new post written straight to the table still obeys the settings.
SELECT public.set_map_visibility(200, true);
INSERT INTO public.feed_posts (user_id, run_id, distance_km, route_points)
SELECT '22222222-2222-4222-8222-222222222222', NULL, 3, pts FROM route;
SELECT pg_temp.check(
  (SELECT jsonb_array_length(route_points) FROM public.feed_posts
    WHERE user_id = '22222222-2222-4222-8222-222222222222' AND run_id IS NULL) = 0,
  'a raw route inserted directly is emptied when maps are hidden');

-- Nobody else can change this runner's posts through the RPC.
SELECT public.set_map_visibility(200, false);
SET LOCAL test.uid = '11111111-1111-4111-8111-111111111111';
SELECT pg_temp.check(public.set_activity_map_hidden('33333333-3333-4333-8333-333333333333', true) = 0,
  'another runner cannot hide this post');
SELECT pg_temp.check(pg_temp.n() = 51, '…and its map is unchanged');

-- Input checks.
DO $$ BEGIN
  PERFORM public.set_map_visibility(300, false);
  RAISE EXCEPTION 'FAILED: 300 m accepted';
EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'ok  only 200, 400, 800 or 1600 m are accepted';
END $$;

SELECT pg_temp.check(NOT has_function_privilege('authenticated', 'public.refresh_post_routes(uuid, uuid)', 'EXECUTE'),
  'refresh_post_routes is not callable by clients');

ROLLBACK;

-- Private places and privacy controls (20261113000010).
\set ON_ERROR_STOP on
BEGIN;
-- These runs stand in for runs the server has scored: in production
-- process-run-territory writes verified_distance_m (20261115000021).
CREATE FUNCTION pg_temp.as_scored() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.verified_distance_m := COALESCE(NEW.verified_distance_m, NEW.distance_m); RETURN NEW; END $$;
CREATE TRIGGER runs_z_test_scored BEFORE INSERT ON public.runs FOR EACH ROW EXECUTE FUNCTION pg_temp.as_scored();

CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('test.uid', u::text, true), set_config('test.role', 'authenticated', true) $$;
-- What a viewer may read straight from the table (the tp_read rule).
CREATE FUNCTION pg_temp.sees(viewer uuid, zone uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT public.zone_visible_to(viewer, t.owner_id, t.near_private_place) FROM public.territory_polygons t WHERE t.id = zone $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('b1100000-0000-4000-8000-000000000001', 'pp-me@example.com'), ('b1200000-0000-4000-8000-000000000002', 'pp-other@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES
  ('b1100000-0000-4000-8000-000000000001', 'pp_me'), ('b1200000-0000-4000-8000-000000000002', 'pp_other')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;
-- Two zones: one around my street (home at 12.9700, 77.6400), one 3 km away.
INSERT INTO public.territory_polygons (id, owner_id, geom, area_m2, tier, polygon_coords) VALUES
  ('b1300000-0000-4000-8000-0000000000a1', 'b1100000-0000-4000-8000-000000000001', ST_GeomFromText('POLYGON((77.6395 12.9695,77.6420 12.9695,77.6420 12.9720,77.6395 12.9720,77.6395 12.9695))', 4326), 70000, 'block', '[[77.6395,12.9695],[77.6420,12.9695],[77.6420,12.9720],[77.6395,12.9720],[77.6395,12.9695]]'),
  ('b1300000-0000-4000-8000-0000000000a2', 'b1100000-0000-4000-8000-000000000001', ST_GeomFromText('POLYGON((77.6650 12.9700,77.6670 12.9700,77.6670 12.9720,77.6650 12.9720,77.6650 12.9700))', 4326), 40000, 'block', '[[77.6650,12.9700],[77.6670,12.9700],[77.6670,12.9720],[77.6650,12.9720],[77.6650,12.9700]]');
INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points) VALUES
  ('b1400000-0000-4000-8000-0000000000b1', 'b1100000-0000-4000-8000-000000000001', 'run', now() - interval '3 hours', now() - interval '2 hours', 5000, 1800, '6:00',
   (SELECT jsonb_agg(jsonb_build_object('lat', 12.9700 + i * 0.0009, 'lng', 77.6400, 'timestamp', 1767225600000 + i * 15000) ORDER BY i) FROM generate_series(0, 40) i));
INSERT INTO public.feed_posts (id, user_id, run_id, distance_km, post_type, route_points)
SELECT 'b1500000-0000-4000-8000-0000000000c1', 'b1100000-0000-4000-8000-000000000001', 'b1400000-0000-4000-8000-0000000000b1', 5, 'run', gps_points
  FROM public.runs WHERE id = 'b1400000-0000-4000-8000-0000000000b1';
CREATE TEMP TABLE before AS SELECT jsonb_array_length(route_points) AS n FROM public.feed_posts WHERE id = 'b1500000-0000-4000-8000-0000000000c1';

SELECT pg_temp.check(pg_temp.sees('b1200000-0000-4000-8000-000000000002', 'b1300000-0000-4000-8000-0000000000a1'), 'before: others see my home zone');

SELECT pg_temp.as_user('b1100000-0000-4000-8000-000000000001');
SELECT public.add_privacy_place('Home', 12.9700, 77.6400, 400);
SELECT pg_temp.check(NOT pg_temp.sees('b1200000-0000-4000-8000-000000000002', 'b1300000-0000-4000-8000-0000000000a1'), 'after: the zone at home is hidden from others');
SELECT pg_temp.check(pg_temp.sees('b1200000-0000-4000-8000-000000000002', 'b1300000-0000-4000-8000-0000000000a2'), 'a zone 3 km away stays visible');
SELECT pg_temp.check(pg_temp.sees('b1100000-0000-4000-8000-000000000001', 'b1300000-0000-4000-8000-0000000000a1'), 'I still see my own');
SELECT pg_temp.check((SELECT jsonb_array_length(route_points) FROM public.feed_posts WHERE id = 'b1500000-0000-4000-8000-0000000000c1') < (SELECT n FROM before),
  'past posts lose the points near home');
SELECT pg_temp.check(NOT EXISTS (
  SELECT 1 FROM public.feed_posts fp, jsonb_array_elements(fp.route_points) e
   WHERE fp.id = 'b1500000-0000-4000-8000-0000000000c1'
     AND ST_DWithin(ST_SetSRID(ST_MakePoint((e->>'lng')::float8, (e->>'lat')::float8), 4326)::geography, ST_SetSRID(ST_MakePoint(77.64, 12.97), 4326)::geography, 400)),
  'no point within 400 m of home remains');

-- A zone claimed later near home is hidden as it is written.
RESET test.uid;
INSERT INTO public.territory_polygons (id, owner_id, geom, area_m2, tier, polygon_coords) VALUES
  ('b1300000-0000-4000-8000-0000000000a3', 'b1100000-0000-4000-8000-000000000001', ST_GeomFromText('POLYGON((77.6401 12.9701,77.6405 12.9701,77.6405 12.9705,77.6401 12.9701))', 4326), 900, 'patch', '[[77.6401,12.9701],[77.6405,12.9701],[77.6405,12.9705],[77.6401,12.9701]]');
SELECT pg_temp.check(NOT pg_temp.sees('b1200000-0000-4000-8000-000000000002', 'b1300000-0000-4000-8000-0000000000a3'), 'new zones near home are hidden from the start');

SELECT pg_temp.as_user('b1100000-0000-4000-8000-000000000001');
SELECT public.remove_privacy_place((SELECT id FROM public.get_my_privacy_places() LIMIT 1));
SELECT pg_temp.check(pg_temp.sees('b1200000-0000-4000-8000-000000000002', 'b1300000-0000-4000-8000-0000000000a1'), 'removing the place shows it again');

-- Hide zones from the map.
SELECT public.set_privacy_controls(NULL, true);
SELECT pg_temp.check(NOT pg_temp.sees('b1200000-0000-4000-8000-000000000002', 'b1300000-0000-4000-8000-0000000000a2'), 'hide from the zone map hides every zone from others');
SELECT pg_temp.check(pg_temp.sees('b1100000-0000-4000-8000-000000000001', 'b1300000-0000-4000-8000-0000000000a2'), 'but not from me');

-- Hide from leaderboards.
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.leaderboard_values('distance', 'all') WHERE user_id = 'b1100000-0000-4000-8000-000000000001'), 'on the board');
SELECT public.set_privacy_controls(true, NULL);
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.leaderboard_values('distance', 'all') WHERE user_id = 'b1100000-0000-4000-8000-000000000001'), 'I still see my own rank');
SELECT pg_temp.as_user('b1200000-0000-4000-8000-000000000002');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.leaderboard_values('distance', 'all') WHERE user_id = 'b1100000-0000-4000-8000-000000000001'), 'others don''t');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.get_leaderboard('distance', 'all') WHERE user_id = 'b1100000-0000-4000-8000-000000000001'), 'on any board');
ROLLBACK;

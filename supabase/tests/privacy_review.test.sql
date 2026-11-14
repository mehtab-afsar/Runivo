-- Privacy review fixes (20261114000001).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('test.uid', u::text, true), set_config('test.role', 'authenticated', true) $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('c7000000-0000-4000-8000-000000000001', 'pr-a@example.com'), ('c7000000-0000-4000-8000-000000000002', 'pr-b@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username, last_known_location) VALUES
  ('c7000000-0000-4000-8000-000000000001', 'pra', 'SRID=4326;POINT(77.6000 12.9700)'),
  ('c7000000-0000-4000-8000-000000000002', 'prb', 'SRID=4326;POINT(77.6123 12.9741)')
ON CONFLICT (id) DO UPDATE SET last_known_location = EXCLUDED.last_known_location;

-- 1. Coarse distance only.
SELECT pg_temp.as_user('c7000000-0000-4000-8000-000000000001');
SELECT pg_temp.check((SELECT distance_km FROM suggest_runners_nearby(5) WHERE username = 'prb') = 2, 'nearby runner shows "within 2 km", not an exact distance');

-- 2. B ran at the event, but posted for followers only; A doesn't follow B.
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO public.events (id, title, event_type, starts_at, ends_at, lat, lng, location, source, is_active) VALUES
  ('c7100000-0000-4000-8000-0000000000e1', 'Park run', 'community-run', now() - interval '3 hours', now() - interval '1 hour', 12.97, 77.60,
   ST_SetSRID(ST_MakePoint(77.60, 12.97), 4326), 'hosted', true);
INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points) VALUES
  ('c7200000-0000-4000-8000-0000000000b1', 'c7000000-0000-4000-8000-000000000002', 'run', now() - interval '170 minutes', now() - interval '140 minutes', 5000, 1800, '6:00',
   (SELECT jsonb_agg(jsonb_build_object('lat', 12.9702 + i * 0.0009, 'lng', 77.6001, 'timestamp', (extract(epoch from now() - interval '170 minutes') * 1000)::bigint + i * 15000) ORDER BY i) FROM generate_series(0, 40) i));
INSERT INTO public.feed_posts (user_id, run_id, distance_km, post_type, visibility) VALUES
  ('c7000000-0000-4000-8000-000000000002', 'c7200000-0000-4000-8000-0000000000b1', 5, 'run', 'followers');
SELECT pg_temp.as_user('c7000000-0000-4000-8000-000000000001');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM event_result('c7100000-0000-4000-8000-0000000000e1') WHERE username = 'prb'), 'a followers-only run stays out of a stranger''s event result');
SELECT pg_temp.as_user('c7000000-0000-4000-8000-000000000002');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM event_result('c7100000-0000-4000-8000-0000000000e1') WHERE is_me), 'the runner still sees their own result');

-- 3. B claimed ground next to home (a private place), then A took it.
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO public.privacy_places (user_id, label, center, radius_m) VALUES
  ('c7000000-0000-4000-8000-000000000002', 'Home', ST_MakePoint(10.0015, 50.0010)::geography, 400);
INSERT INTO public.territory_polygons (id, owner_id, area_m2, tier, polygon_coords) VALUES
  ('c7300000-0000-4000-8000-0000000000a1', 'c7000000-0000-4000-8000-000000000002', 70000, 'block',
   '[[10.0000,50.0000],[10.0030,50.0000],[10.0030,50.0020],[10.0000,50.0020],[10.0000,50.0000]]');
UPDATE public.territory_polygons SET owner_id = 'c7000000-0000-4000-8000-000000000001', near_private_place = false WHERE id = 'c7300000-0000-4000-8000-0000000000a1';
SELECT pg_temp.as_user('c7000000-0000-4000-8000-000000000001');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM get_zone_history('c7300000-0000-4000-8000-0000000000a1') WHERE username = 'prb'), 'history hides what B did inside B''s private place');
ROLLBACK;

-- Fixes from the end-to-end run test (20261114000002).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('c8000000-0000-4000-8000-000000000001', 'rt-a@example.com'), ('c8000000-0000-4000-8000-000000000002', 'rt-b@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES
  ('c8000000-0000-4000-8000-000000000001', 'rta'), ('c8000000-0000-4000-8000-000000000002', 'rtb')
ON CONFLICT (id) DO NOTHING;

-- 1. An attack card no longer blocks deleting the zone it points at.
INSERT INTO public.territory_polygons (id, owner_id, area_m2, tier, polygon_coords) VALUES
  ('c8100000-0000-4000-8000-0000000000a1', 'c8000000-0000-4000-8000-000000000002', 20000, 'block',
   '[[10.0000,50.0000],[10.0020,50.0000],[10.0020,50.0012],[10.0000,50.0012],[10.0000,50.0000]]');
INSERT INTO public.feed_posts (id, user_id, post_type, distance_km, stolen_territory_id) VALUES
  ('c8200000-0000-4000-8000-0000000000f1', 'c8000000-0000-4000-8000-000000000002', 'attack', 0, 'c8100000-0000-4000-8000-0000000000a1');
DELETE FROM public.territory_polygons WHERE id = 'c8100000-0000-4000-8000-0000000000a1';
SELECT pg_temp.check((SELECT stolen_territory_id IS NULL FROM public.feed_posts WHERE id = 'c8200000-0000-4000-8000-0000000000f1'),
  'deleting a zone clears the attack card''s link instead of failing');

-- 2. The rival's in-app row; silent ones skip the push.
INSERT INTO public.notifications (user_id, type, title, body, silent) VALUES
  ('c8000000-0000-4000-8000-000000000002', 'zone_attacked', 'Your territory is under attack', 'rta captured part of your block zone.', true);
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.notifications WHERE user_id = 'c8000000-0000-4000-8000-000000000002' AND type = 'zone_attacked' AND silent),
  'zone_attacked rows save, with silent kept');
SELECT pg_temp.check((SELECT prosrc LIKE '%NEW.silent%' FROM pg_proc WHERE proname = 'notify_push_on_notification'),
  'the push trigger skips silent rows');

-- 3. Wheelchair distance counts on the distance boards.
INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points) VALUES
  ('c8300000-0000-4000-8000-0000000000b1', 'c8000000-0000-4000-8000-000000000001', 'wheelchair', now() - interval '40 minutes', now() - interval '10 minutes', 4000, 1800, '7:30',
   (SELECT jsonb_agg(jsonb_build_object('lat', 50.01 + i * 0.0009, 'lng', 10.01, 'timestamp', (extract(epoch from now() - interval '40 minutes') * 1000)::bigint + i * 40000) ORDER BY i) FROM generate_series(0, 40) i));
SELECT pg_temp.check(EXISTS (SELECT 1 FROM leaderboard_values_all('distance', 'week') WHERE user_id = 'c8000000-0000-4000-8000-000000000001'),
  'a wheelchair session counts on the weekly distance board');
ROLLBACK;

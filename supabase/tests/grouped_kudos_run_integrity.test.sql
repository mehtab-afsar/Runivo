-- Grouped kudos and run integrity (20261113000003).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('test.uid', u::text, true), set_config('test.role', 'authenticated', true) $$;
-- A straight line north from (12.9, 77.6): n points, step metres apart, every dt seconds.
CREATE FUNCTION pg_temp.line(n int, step float8, dt float8, jump_at int DEFAULT -1, jump_m float8 DEFAULT 0) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_agg(jsonb_build_object(
    'lat', 12.9 + (i * step + CASE WHEN jump_at >= 0 AND i >= jump_at THEN jump_m ELSE 0 END) / 111320.0,
    'lng', 77.6, 'timestamp', 1767225600000 + i * dt * 1000) ORDER BY i)
  FROM generate_series(0, n - 1) i $$;

SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('a1100000-0000-4000-8000-000000000001', 'gk-owner@example.com'),
  ('a1200000-0000-4000-8000-000000000002', 'gk-ana@example.com'),
  ('a1300000-0000-4000-8000-000000000003', 'gk-ben@example.com'),
  ('a1400000-0000-4000-8000-000000000004', 'gk-cy@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES
  ('a1100000-0000-4000-8000-000000000001', 'gk_owner'), ('a1200000-0000-4000-8000-000000000002', 'gk_ana'),
  ('a1300000-0000-4000-8000-000000000003', 'gk_ben'), ('a1400000-0000-4000-8000-000000000004', 'gk_cy')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;

-- ── Kudos ──
INSERT INTO public.feed_posts (id, user_id, distance_km, post_type) VALUES
  ('a1500000-0000-4000-8000-0000000000a5', 'a1100000-0000-4000-8000-000000000001', 5, 'run');
INSERT INTO public.feed_post_likes (post_id, user_id) VALUES ('a1500000-0000-4000-8000-0000000000a5', 'a1200000-0000-4000-8000-000000000002');
SELECT pg_temp.check((SELECT count(*) FROM public.notifications WHERE user_id = 'a1100000-0000-4000-8000-000000000001' AND type = 'kudos') = 1, 'first kudos: one notification');
INSERT INTO public.feed_post_likes (post_id, user_id) VALUES
  ('a1500000-0000-4000-8000-0000000000a5', 'a1300000-0000-4000-8000-000000000003'),
  ('a1500000-0000-4000-8000-0000000000a5', 'a1400000-0000-4000-8000-000000000004');
SELECT pg_temp.check((SELECT count(*) FROM public.notifications WHERE user_id = 'a1100000-0000-4000-8000-000000000001' AND type = 'kudos') = 1, 'more kudos fold into it');
SELECT pg_temp.check((SELECT title FROM public.notifications WHERE user_id = 'a1100000-0000-4000-8000-000000000001' AND type = 'kudos') = 'gk_cy and 2 others gave kudos', 'titled with the latest and the count');
UPDATE public.notifications SET read = true WHERE user_id = 'a1100000-0000-4000-8000-000000000001';
DELETE FROM public.feed_post_likes WHERE user_id = 'a1200000-0000-4000-8000-000000000002';
INSERT INTO public.feed_post_likes (post_id, user_id) VALUES ('a1500000-0000-4000-8000-0000000000a5', 'a1200000-0000-4000-8000-000000000002');
SELECT pg_temp.check((SELECT count(*) FROM public.notifications WHERE user_id = 'a1100000-0000-4000-8000-000000000001' AND type = 'kudos') = 2, 'after reading, a new kudos starts a new notification');

-- ── Integrity ──
RESET test.uid;
-- 5 km at 5:00/km: 100 points, 50 m every 15 s.
INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points) VALUES
  ('a1600000-0000-4000-8000-0000000000b1', 'a1100000-0000-4000-8000-000000000001', 'run', now() - interval '6 hours', now() - interval '5 hours 35 minutes', 4950, 1500, '5:00', pg_temp.line(100, 50, 15));
SELECT pg_temp.check((SELECT integrity_status FROM public.runs WHERE id = 'a1600000-0000-4000-8000-0000000000b1') = 'ok', 'a normal run is ok');

-- Same, with a 400 m jump in 5 s at point 50.
INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points) VALUES
  ('a1600000-0000-4000-8000-0000000000b2', 'a1200000-0000-4000-8000-000000000002', 'run', now() - interval '6 hours', now() - interval '5 hours 35 minutes', 5300, 1500, '4:43',
   (SELECT jsonb_agg(CASE WHEN (e->>'timestamp')::float8 > 1767225600000 + 49 * 15000 THEN jsonb_set(e, '{timestamp}', to_jsonb((e->>'timestamp')::float8 - 10000)) ELSE e END)
      FROM jsonb_array_elements(pg_temp.line(100, 50, 15, 50, 400)) e));
SELECT pg_temp.check((SELECT integrity_status || ':' || integrity_reason FROM public.runs WHERE id = 'a1600000-0000-4000-8000-0000000000b2') = 'flagged:teleport', 'a GPS jump is flagged as a teleport');

-- A walk with 1.5 km at 10 m/s (a car): 30 points of 50 m every 5 s, inside a slower walk.
INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points) VALUES
  ('a1600000-0000-4000-8000-0000000000b3', 'a1300000-0000-4000-8000-000000000003', 'walk', now() - interval '6 hours', now() - interval '5 hours', 1500, 3600, '40:00', pg_temp.line(31, 50, 5));
SELECT pg_temp.check((SELECT integrity_reason FROM public.runs WHERE id = 'a1600000-0000-4000-8000-0000000000b3') = 'vehicle', 'a car-speed stretch on foot is flagged');

SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.leaderboard_values('distance', 'all') WHERE user_id = 'a1100000-0000-4000-8000-000000000001'), 'ok runs count');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.leaderboard_values('distance', 'all') WHERE user_id = 'a1200000-0000-4000-8000-000000000002'), 'flagged runs stay off boards');

-- The runner cannot clear it by writing the column.
SELECT pg_temp.as_user('a1200000-0000-4000-8000-000000000002');
UPDATE public.runs SET integrity_status = 'cleared' WHERE id = 'a1600000-0000-4000-8000-0000000000b2';
SELECT pg_temp.check((SELECT integrity_status FROM public.runs WHERE id = 'a1600000-0000-4000-8000-0000000000b2') = 'flagged', 'runners cannot clear their own flag');
SELECT pg_temp.check(public.appeal_run_flag('a1600000-0000-4000-8000-0000000000b2', 'Tunnel under the river'), 'but can appeal');
SELECT pg_temp.check((SELECT integrity_status || ':' || integrity_appeal FROM public.runs WHERE id = 'a1600000-0000-4000-8000-0000000000b2') = 'appealed:Tunnel under the river', 'appeal recorded');
SELECT pg_temp.check(NOT public.appeal_run_flag('a1600000-0000-4000-8000-0000000000b1', 'x'), 'cannot appeal someone else''s run');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.leaderboard_values('distance', 'all') WHERE user_id = 'a1200000-0000-4000-8000-000000000002'), 'appealed runs still off boards');

-- Staff clear it.
SELECT set_config('test.role', 'service_role', true);
UPDATE public.runs SET integrity_status = 'cleared' WHERE id = 'a1600000-0000-4000-8000-0000000000b2';
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.leaderboard_values('distance', 'all') WHERE user_id = 'a1200000-0000-4000-8000-000000000002'), 'cleared runs count');
ROLLBACK;

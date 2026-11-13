-- Year in Runivo (20261113000006).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('test.uid', u::text, true), set_config('test.role', 'authenticated', true) $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES ('d6100000-0000-4000-8000-000000000001', 'yr@example.com') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES ('d6100000-0000-4000-8000-000000000001', 'yr_runner') ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;
INSERT INTO public.runs (user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, excluded) VALUES
  ('d6100000-0000-4000-8000-000000000001', 'run',   '2025-03-02 06:00Z', '2025-03-02 06:30Z', 5000, 1800, '6:00', false),
  ('d6100000-0000-4000-8000-000000000001', 'run',   '2025-03-09 06:00Z', '2025-03-09 07:00Z', 10000, 3600, '6:00', false),
  ('d6100000-0000-4000-8000-000000000001', 'walk',  '2025-07-01 06:00Z', '2025-07-01 06:40Z', 3000, 2400, '13:20', false),
  ('d6100000-0000-4000-8000-000000000001', 'cycle', '2025-07-02 06:00Z', '2025-07-02 07:00Z', 30000, 3600, '2:00', false),
  ('d6100000-0000-4000-8000-000000000001', 'run',   '2025-08-01 06:00Z', '2025-08-01 06:30Z', 50000, 1800, '0:36', true),
  ('d6100000-0000-4000-8000-000000000001', 'run',   '2024-12-31 06:00Z', '2024-12-31 06:30Z', 5000, 1800, '6:00', false);
INSERT INTO public.feed_posts (user_id, distance_km, post_type, territories_claimed, created_at) VALUES
  ('d6100000-0000-4000-8000-000000000001', 5, 'run', 2, '2025-03-02 07:00Z'),
  ('d6100000-0000-4000-8000-000000000001', 10, 'run', 3, '2025-03-09 08:00Z');
INSERT INTO public.feed_posts (user_id, distance_km, post_type, stolen_area_m2, stolen_from_username, created_at) VALUES
  ('d6100000-0000-4000-8000-000000000001', 0, 'conquest', 12000, 'ana', '2025-04-01 07:00Z'),
  ('d6100000-0000-4000-8000-000000000001', 0, 'conquest', 30000, 'ben', '2025-05-01 07:00Z'),
  ('d6100000-0000-4000-8000-000000000001', 0, 'attack', NULL, 'cy', '2025-06-01 07:00Z');

SELECT pg_temp.as_user('d6100000-0000-4000-8000-000000000001');
CREATE TEMP TABLE y AS SELECT * FROM public.get_year_in_runivo(2025);
SELECT pg_temp.check((SELECT activities FROM y) = 3, 'on-foot activities in the year, not rides, not excluded, not other years');
SELECT pg_temp.check((SELECT km FROM y) = 18.0, 'their distance');
SELECT pg_temp.check((SELECT longest_km FROM y) = 10.00, 'the longest');
SELECT pg_temp.check((SELECT zones_claimed FROM y) = 5, 'zones claimed from run posts');
SELECT pg_temp.check((SELECT biggest_steal_from FROM y) = 'ben' AND (SELECT biggest_steal_m2 FROM y) = 30000, 'the biggest steal');
SELECT pg_temp.check((SELECT times_stolen_from FROM y) = 1, 'times you were stolen from');
SELECT pg_temp.check((SELECT best_month FROM y) = 3 AND (SELECT best_month_km FROM y) = 15.0, 'the best month');
RESET test.uid;
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.get_year_in_runivo(2025)), 'nothing when signed out');
ROLLBACK;

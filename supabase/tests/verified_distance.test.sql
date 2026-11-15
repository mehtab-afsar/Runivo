-- Boards, missions and challenges count server-checked distance (20261115000021).
-- Needs every migration applied; runs in a transaction and rolls back.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;

SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('b1100000-0000-4000-8000-000000000001', 'vd-honest@example.com'),
  ('b2200000-0000-4000-8000-000000000002', 'vd-cheat@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES
  ('b1100000-0000-4000-8000-000000000001', 'vd_honest'),
  ('b2200000-0000-4000-8000-000000000002', 'vd_cheat')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;

-- Written as the service role (the scoring function): 5 km checked.
INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, verified_distance_m)
VALUES ('a1100000-0000-4000-8000-0000000000a1', 'b1100000-0000-4000-8000-000000000001', 'run', now() - interval '1 hour', now() - interval '30 minutes', 5000, 1800, '6:00', 5000);

-- Written as the runner's app: 40 km claimed, trying to set its own checked distance.
SELECT set_config('test.role', 'authenticated', true), set_config('test.uid', 'b2200000-0000-4000-8000-000000000002', true);
SELECT set_config('runivo.trusted_writer', 'off', true);
SET LOCAL runivo.integrity_writer = 'off';
ALTER TABLE public.runs DISABLE TRIGGER runs_validate_distance; -- the fake trace isn't the point here
INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, verified_distance_m)
VALUES ('a2200000-0000-4000-8000-0000000000a2', 'b2200000-0000-4000-8000-000000000002', 'run', now() - interval '3 hours', now() - interval '1 hour', 40000, 7200, '3:00', 40000);
SELECT pg_temp.check((SELECT verified_distance_m FROM public.runs WHERE id = 'a2200000-0000-4000-8000-0000000000a2') IS NULL, 'the app cannot set the checked distance on insert');
UPDATE public.runs SET verified_distance_m = 40000 WHERE id = 'a2200000-0000-4000-8000-0000000000a2';
SELECT pg_temp.check((SELECT verified_distance_m FROM public.runs WHERE id = 'a2200000-0000-4000-8000-0000000000a2') IS NULL, 'or by updating it later');
ALTER TABLE public.runs ENABLE TRIGGER runs_validate_distance;
SELECT set_config('test.role', 'service_role', true);

SELECT pg_temp.check(
  (SELECT value FROM public.leaderboard_values_all('distance', 'week') WHERE user_id = 'b1100000-0000-4000-8000-000000000001') = 5,
  'the distance board counts the checked 5 km');
SELECT pg_temp.check(
  NOT EXISTS (SELECT 1 FROM public.leaderboard_values_all('distance', 'week') WHERE user_id = 'b2200000-0000-4000-8000-000000000002'),
  'an unscored 40 km claim is not on the board');
SELECT pg_temp.check(public.mission_completed_today('b1100000-0000-4000-8000-000000000001', 'Endurance Test'), 'a checked 5 km completes the 5 km mission');
SELECT pg_temp.check(NOT public.mission_completed_today('b2200000-0000-4000-8000-000000000002', 'Long Haul'), 'an unscored claim completes nothing');

-- Once the server scores it (here: the trace held up for 12 km), that counts.
UPDATE public.runs SET verified_distance_m = 12000 WHERE id = 'a2200000-0000-4000-8000-0000000000a2';
SELECT pg_temp.check(
  (SELECT value FROM public.leaderboard_values_all('distance', 'week') WHERE user_id = 'b2200000-0000-4000-8000-000000000002') = 12,
  'after scoring, the board shows the checked 12 km, not the claimed 40');
SELECT pg_temp.check((SELECT weekly_km FROM public.leaderboard_weekly WHERE id = 'b2200000-0000-4000-8000-000000000002') = 12, 'the weekly view agrees');

-- Meals: backfilling five past days in one go no longer earns Fuel Right.
SELECT set_config('test.role', 'authenticated', true), set_config('test.uid', 'b1100000-0000-4000-8000-000000000001', true);
INSERT INTO public.nutrition_logs (user_id, log_date, meal, name, kcal, logged_at)
SELECT 'b1100000-0000-4000-8000-000000000001', (now() AT TIME ZONE 'UTC')::date - d, m, 'food', 300, now() - (d || ' days')::interval
  FROM generate_series(0, 4) d, unnest(ARRAY['breakfast', 'lunch', 'dinner']) m;
SELECT pg_temp.check((SELECT count(*) FROM public.nutrition_logs WHERE user_id = 'b1100000-0000-4000-8000-000000000001' AND logged_at < now() - interval '1 minute') = 0, 'the server sets when a meal was logged');
SELECT pg_temp.check(public.nutrition_streak_days('b1100000-0000-4000-8000-000000000001') <= 2, 'backfilled days do not count towards the streak');
SELECT pg_temp.check(NOT public.mission_completed_today('b1100000-0000-4000-8000-000000000001', 'Fuel Right'), 'so Fuel Right is not paid for a backfill');
ROLLBACK;

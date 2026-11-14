-- Wheelchair, stroller and treadmill validation (20261113000018).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES ('b8000000-0000-4000-8000-000000000001', 'ms@example.com') ON CONFLICT DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES ('b8000000-0000-4000-8000-000000000001', 'msone') ON CONFLICT DO NOTHING;
SELECT set_config('test.uid', 'b8000000-0000-4000-8000-000000000001', true), set_config('test.role', 'authenticated', true);
INSERT INTO public.runs (user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points)
VALUES ('b8000000-0000-4000-8000-000000000001', 'treadmill', now() - interval '3 hours', now() - interval '150 minutes', 8000, 1800, '3:45', '[]');
SELECT pg_temp.check(true, 'treadmill run with no GPS is accepted');
DO $$ BEGIN
  INSERT INTO public.runs (user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points)
  VALUES ('b8000000-0000-4000-8000-000000000001', 'treadmill', now() - interval '10 hours', now() - interval '9 hours', 30000, 1800, '1:00', '[]');
  RAISE EXCEPTION 'no error';
EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'no error' THEN RAISE; END IF; END $$;
SELECT pg_temp.check(true, 'impossible treadmill speed refused');
DO $$ BEGIN
  INSERT INTO public.runs (user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points)
  VALUES ('b8000000-0000-4000-8000-000000000001', 'stroller', now() - interval '20 hours', now() - interval '19 hours', 5000, 1800, '6:00', '[]');
  RAISE EXCEPTION 'no error';
EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'no error' THEN RAISE; END IF; END $$;
SELECT pg_temp.check(true, 'stroller run still needs a GPS trace');
ROLLBACK;

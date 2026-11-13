-- Leaderboards (20261112000002_leaderboards.sql). Needs every migration
-- applied; runs in a transaction and rolls back.
\set ON_ERROR_STOP on
BEGIN;

CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;

SET LOCAL runivo.trusted_writer = 'on';
-- Start from an empty board so earlier data cannot interfere.
DELETE FROM public.pace_awards;
UPDATE public.profiles SET pace_total_earned = 0, territory_score = 0;
DELETE FROM public.runs;

INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-4000-8000-00000000000a', 'lb-a@example.com'),
  ('b0000000-0000-4000-8000-00000000000b', 'lb-b@example.com'),
  ('c0000000-0000-4000-8000-00000000000c', 'lb-c@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username, country) VALUES
  ('a0000000-0000-4000-8000-00000000000a', 'lb_asha',  'IN'),
  ('b0000000-0000-4000-8000-00000000000b', 'lb_bilal', 'IN'),
  ('c0000000-0000-4000-8000-00000000000c', 'lb_cara',  'GB')
ON CONFLICT (id) DO UPDATE SET country = EXCLUDED.country, username = EXCLUDED.username;

CREATE TEMP TABLE t AS SELECT public.leaderboard_period_start('week') AS wk, public.leaderboard_period_start('month') AS mo;

-- Asha: 5 km run this week + a 40 km ride this week (must not count).
-- Bilal: 8 km run in a previous month. Cara: 12 km hike this week.
INSERT INTO public.runs (user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace)
SELECT 'a0000000-0000-4000-8000-00000000000a'::uuid, 'run',   wk + interval '1 hour', wk + interval '2 hours', 5000, 1800, '6:00' FROM t UNION ALL
SELECT 'a0000000-0000-4000-8000-00000000000a', 'cycle', wk + interval '3 hours', wk + interval '5 hours', 40000, 6000, '2:30' FROM t UNION ALL
SELECT 'b0000000-0000-4000-8000-00000000000b', 'run',   mo - interval '2 days', mo - interval '2 days' + interval '1 hour', 8000, 2700, '5:37' FROM t UNION ALL
SELECT 'c0000000-0000-4000-8000-00000000000c', 'hike',  wk + interval '1 hour', wk + interval '4 hours', 12000, 9000, '12:30' FROM t;

SELECT pg_temp.check(
  (SELECT value FROM public.get_leaderboard('distance', 'week') WHERE username = 'lb_asha') = 5.0,
  'weekly distance counts the run and ignores the 40 km ride');
SELECT pg_temp.check(
  (SELECT username FROM public.get_leaderboard('distance', 'week') WHERE rank = 1) = 'lb_cara',
  'a 12 km hike outranks a 5 km run');
SELECT pg_temp.check(
  NOT EXISTS (SELECT 1 FROM public.get_leaderboard('distance', 'month') WHERE username = 'lb_bilal'),
  'this month starts on the 1st: last month''s run is out');
SELECT pg_temp.check(
  (SELECT value FROM public.get_leaderboard('distance', 'all') WHERE username = 'lb_bilal') = 8.0,
  'all time includes it');

-- PACE: this month from the ledger, all time from lifetime PACE.
INSERT INTO public.pace_awards (user_id, source, source_key, requested, credited, created_at)
SELECT 'b0000000-0000-4000-8000-00000000000b'::uuid, 'run', 'lb-1', 30, 30, mo - interval '3 days' FROM t UNION ALL
SELECT 'b0000000-0000-4000-8000-00000000000b', 'run', 'lb-2', 12, 12, wk + interval '1 hour' FROM t UNION ALL
SELECT 'a0000000-0000-4000-8000-00000000000a', 'run', 'lb-3', 20, 20, wk + interval '2 hours' FROM t;
UPDATE public.profiles SET pace_total_earned = 900 WHERE id = 'b0000000-0000-4000-8000-00000000000b';
UPDATE public.profiles SET pace_total_earned = 20  WHERE id = 'a0000000-0000-4000-8000-00000000000a';

SELECT pg_temp.check(
  (SELECT username FROM public.get_leaderboard('pace', 'month') WHERE rank = 1) = 'lb_asha',
  'PACE this month is this month''s ledger, not lifetime (20 beats 12)');
SELECT pg_temp.check(
  (SELECT username FROM public.get_leaderboard('pace', 'all') WHERE rank = 1) = 'lb_bilal',
  'PACE all time is lifetime (900)');

-- Own rank is counted inside the chosen country.
SET LOCAL test.uid = 'a0000000-0000-4000-8000-00000000000a';
SELECT pg_temp.check((SELECT rank FROM public.get_my_leaderboard_rank('distance', 'week')) = 2,
  'globally Asha is 2nd on weekly distance');
SELECT pg_temp.check((SELECT rank FROM public.get_my_leaderboard_rank('distance', 'week', 'IN')) = 1,
  'in India she is 1st (Cara is in GB)');
SELECT pg_temp.check((SELECT username FROM public.get_leaderboard('distance', 'week', 'IN') WHERE rank = 1) = 'lb_asha',
  'the national board ranks within the country');
SELECT pg_temp.check((SELECT rank FROM public.get_my_leaderboard_rank('territory', 'week')) IS NULL,
  'no rank when you have no value');

DO $$ BEGIN
  PERFORM * FROM public.get_leaderboard('speed', 'week');
  RAISE EXCEPTION 'FAILED: bad metric accepted';
EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'ok  unknown metrics are refused';
END $$;

SELECT pg_temp.check(
  (SELECT total_km FROM public.get_run_km_by_user('-infinity'::timestamptz, 100) WHERE user_id = 'a0000000-0000-4000-8000-00000000000a') = 5,
  'the old distance RPC no longer counts rides either');

ROLLBACK;

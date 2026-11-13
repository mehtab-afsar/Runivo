-- Safety share (20261113000005).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('test.uid', u::text, true), set_config('test.role', 'authenticated', true) $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('c5100000-0000-4000-8000-000000000001', 'ss-runner@example.com'),
  ('c5200000-0000-4000-8000-000000000002', 'ss-other@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES
  ('c5100000-0000-4000-8000-000000000001', 'ss_runner'), ('c5200000-0000-4000-8000-000000000002', 'ss_other')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;

SELECT pg_temp.as_user('c5100000-0000-4000-8000-000000000001');
CREATE TEMP TABLE t AS SELECT public.start_safety_share('run-1', 'run') AS token;
SELECT pg_temp.check(length((SELECT token FROM t)) >= 20, 'a long random token');
SELECT pg_temp.check((SELECT status FROM public.view_safety_share((SELECT token FROM t))) = 'no_signal', 'no position yet');
SELECT pg_temp.check(public.update_safety_share((SELECT token FROM t), 12.97, 77.59, 1200, 360), 'the runner posts a position');
SELECT pg_temp.check((SELECT status || ':' || round(lat::numeric, 2) FROM public.view_safety_share((SELECT token FROM t))) = 'live:12.97', 'viewers see it live');

SELECT pg_temp.as_user('c5200000-0000-4000-8000-000000000002');
SELECT pg_temp.check(NOT public.update_safety_share((SELECT token FROM t), 0, 0, 0, 0), 'someone else cannot move your position');
SELECT public.end_safety_share((SELECT token FROM t));
SELECT pg_temp.check((SELECT status FROM public.view_safety_share((SELECT token FROM t))) = 'live', 'nor end your share');

SELECT pg_temp.as_user('c5100000-0000-4000-8000-000000000001');
CREATE TEMP TABLE t2 AS SELECT public.start_safety_share('run-2', 'walk') AS token;
SELECT pg_temp.check((SELECT status FROM public.view_safety_share((SELECT token FROM t))) = 'finished', 'starting a new share ends the old one');
SELECT public.end_safety_share((SELECT token FROM t2));
SELECT pg_temp.check(NOT public.update_safety_share((SELECT token FROM t2), 1, 1, 1, 1), 'an ended share takes no positions');

RESET test.uid;
UPDATE public.safety_shares SET ended_at = now() - interval '31 minutes' WHERE token = (SELECT token FROM t);
SELECT pg_temp.check((SELECT lat FROM public.view_safety_share((SELECT token FROM t))) IS NULL, 'location hidden 30 min after the end');
UPDATE public.safety_shares SET expires_at = now() - interval '1 minute' WHERE token = (SELECT token FROM t);
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.view_safety_share((SELECT token FROM t))), 'expired links show nothing');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.view_safety_share('not-a-token')), 'unknown tokens show nothing');
ROLLBACK;

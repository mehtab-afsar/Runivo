-- Cheers (20261115000025): only mutual friends, only while live, one per run.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('test.uid', u::text, true), set_config('test.role', 'authenticated', true) $$;

SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('c4000000-0000-4000-8000-000000000001', 'runner@example.com'),
  ('c4000000-0000-4000-8000-000000000002', 'friend@example.com'),
  ('c4000000-0000-4000-8000-000000000003', 'stranger@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username, live_run_sharing_enabled) VALUES
  ('c4000000-0000-4000-8000-000000000001', 'kabir', true),
  ('c4000000-0000-4000-8000-000000000002', 'aanya', false),
  ('c4000000-0000-4000-8000-000000000003', 'dev', false)
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, live_run_sharing_enabled = EXCLUDED.live_run_sharing_enabled;
INSERT INTO public.followers (follower_id, following_id) VALUES
  ('c4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000002'),
  ('c4000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000001'),
  ('c4000000-0000-4000-8000-000000000003', 'c4000000-0000-4000-8000-000000000001')
ON CONFLICT DO NOTHING;

-- Not running yet.
SELECT pg_temp.as_user('c4000000-0000-4000-8000-000000000002');
SELECT pg_temp.check(public.send_cheer('c4000000-0000-4000-8000-000000000001', 'go') = 'not_live', 'nobody to cheer before the run starts');

INSERT INTO public.live_run_positions (user_id, run_id, lat, lng) VALUES ('c4000000-0000-4000-8000-000000000001', 'run-123', 12.97, 77.6)
  ON CONFLICT (user_id) DO UPDATE SET run_id = 'run-123', updated_at = now();

SELECT pg_temp.check(public.send_cheer('c4000000-0000-4000-8000-000000000001', 'free text') = 'bad_message', 'only the fixed messages');
SELECT pg_temp.check(public.send_cheer('c4000000-0000-4000-8000-000000000001', 'go') = 'sent', 'a mutual friend can cheer a live runner');
SELECT pg_temp.check(public.send_cheer('c4000000-0000-4000-8000-000000000001', 'pace') = 'already', 'one cheer per friend per run');
SELECT pg_temp.check(public.send_cheer('c4000000-0000-4000-8000-000000000002', 'go') = 'not_live', 'cannot cheer yourself');

-- One-way follower: no.
SELECT pg_temp.as_user('c4000000-0000-4000-8000-000000000003');
SELECT pg_temp.check(public.send_cheer('c4000000-0000-4000-8000-000000000001', 'go') = 'not_live', 'a one-way follower cannot cheer');
SET LOCAL ROLE authenticated;
SELECT pg_temp.check((SELECT count(*) FROM public.run_cheers) = 0, 'and cannot read other people''s cheers');
RESET ROLE;

-- The runner sees it, with the words and a push row.
SELECT pg_temp.as_user('c4000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT pg_temp.check((SELECT message FROM public.run_cheers WHERE run_id = 'run-123') = 'go', 'the runner reads the cheer');
RESET ROLE;
SET LOCAL runivo.trusted_writer = 'on';
SELECT set_config('test.role', 'service_role', true);
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.notifications WHERE user_id = 'c4000000-0000-4000-8000-000000000001'
  AND type = 'cheer' AND title = 'aanya cheered you on' AND body = 'Go kabir!'), 'a cheer notification is queued');

-- Thanks: only the runner.
SELECT pg_temp.as_user('c4000000-0000-4000-8000-000000000002');
SELECT pg_temp.check(public.thank_cheer((SELECT id FROM public.run_cheers WHERE run_id = 'run-123')) = false, 'the sender cannot thank their own cheer');
SELECT pg_temp.as_user('c4000000-0000-4000-8000-000000000001');
SELECT pg_temp.check(public.thank_cheer((SELECT id FROM public.run_cheers WHERE run_id = 'run-123')), 'the runner thanks it');

-- A block stops it, even mid-run.
SET LOCAL runivo.trusted_writer = 'on';
SELECT set_config('test.role', 'service_role', true);
UPDATE public.live_run_positions SET run_id = 'run-456', updated_at = now() WHERE user_id = 'c4000000-0000-4000-8000-000000000001';
INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES ('c4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000002');
SELECT pg_temp.as_user('c4000000-0000-4000-8000-000000000002');
SELECT pg_temp.check(public.send_cheer('c4000000-0000-4000-8000-000000000001', 'go') = 'not_live', 'a blocked friend cannot cheer');

-- Stale position: the run has ended.
SET LOCAL runivo.trusted_writer = 'on';
SELECT set_config('test.role', 'service_role', true);
DELETE FROM public.user_blocks WHERE blocker_id = 'c4000000-0000-4000-8000-000000000001';
UPDATE public.live_run_positions SET updated_at = now() - interval '5 minutes' WHERE user_id = 'c4000000-0000-4000-8000-000000000001';
SELECT pg_temp.as_user('c4000000-0000-4000-8000-000000000002');
SELECT pg_temp.check(public.send_cheer('c4000000-0000-4000-8000-000000000001', 'go') = 'not_live', 'no cheers once the live position goes stale');

SELECT pg_temp.check(NOT has_table_privilege('authenticated', 'public.run_cheers', 'INSERT'), 'no direct inserts');
SELECT pg_temp.check(NOT has_function_privilege('anon', 'public.send_cheer(uuid, text)', 'EXECUTE'), 'signed-out callers cannot cheer');
ROLLBACK;

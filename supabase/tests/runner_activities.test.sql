-- get_runner_activities (20261113000004).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('test.uid', u::text, true), set_config('test.role', 'authenticated', true) $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('b7100000-0000-4000-8000-000000000001', 'ra-runner@example.com'),
  ('b7200000-0000-4000-8000-000000000002', 'ra-fan@example.com'),
  ('b7300000-0000-4000-8000-000000000003', 'ra-stranger@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES
  ('b7100000-0000-4000-8000-000000000001', 'ra_runner'), ('b7200000-0000-4000-8000-000000000002', 'ra_fan'), ('b7300000-0000-4000-8000-000000000003', 'ra_stranger')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;
UPDATE public.profiles SET profile_visibility = 'public' WHERE id = 'b7100000-0000-4000-8000-000000000001';
INSERT INTO public.followers (follower_id, following_id) VALUES ('b7200000-0000-4000-8000-000000000002', 'b7100000-0000-4000-8000-000000000001');
INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, excluded) VALUES
  ('b7400000-0000-4000-8000-0000000000a1', 'b7100000-0000-4000-8000-000000000001', 'run', now() - interval '3 days', now() - interval '3 days' + interval '30 minutes', 5000, 1800, '6:00', false),
  ('b7400000-0000-4000-8000-0000000000a2', 'b7100000-0000-4000-8000-000000000001', 'run', now() - interval '2 days', now() - interval '2 days' + interval '30 minutes', 6000, 1800, '5:00', false),
  ('b7400000-0000-4000-8000-0000000000a3', 'b7100000-0000-4000-8000-000000000001', 'walk', now() - interval '1 day', now() - interval '1 day' + interval '30 minutes', 2000, 1800, '15:00', false),
  ('b7400000-0000-4000-8000-0000000000a4', 'b7100000-0000-4000-8000-000000000001', 'run', now() - interval '5 days', now() - interval '5 days' + interval '30 minutes', 4000, 1800, '7:30', true);
INSERT INTO public.feed_posts (user_id, run_id, distance_km, post_type, visibility) VALUES
  ('b7100000-0000-4000-8000-000000000001', 'b7400000-0000-4000-8000-0000000000a1', 5, 'run', 'everyone'),
  ('b7100000-0000-4000-8000-000000000001', 'b7400000-0000-4000-8000-0000000000a2', 6, 'run', 'followers'),
  ('b7100000-0000-4000-8000-000000000001', 'b7400000-0000-4000-8000-0000000000a3', 2, 'run', 'only_me'),
  ('b7100000-0000-4000-8000-000000000001', 'b7400000-0000-4000-8000-0000000000a4', 4, 'run', 'everyone');
-- fill_post_visibility may override the audience on insert; set them explicitly.
UPDATE public.feed_posts SET visibility = CASE run_id
  WHEN 'b7400000-0000-4000-8000-0000000000a1' THEN 'everyone' WHEN 'b7400000-0000-4000-8000-0000000000a2' THEN 'followers'
  WHEN 'b7400000-0000-4000-8000-0000000000a3' THEN 'only_me' ELSE 'everyone' END
 WHERE user_id = 'b7100000-0000-4000-8000-000000000001';

SELECT pg_temp.as_user('b7300000-0000-4000-8000-000000000003');
SELECT pg_temp.check((SELECT count(*) FROM public.get_runner_activities('b7100000-0000-4000-8000-000000000001')) = 1, 'a stranger sees only activities for everyone, not excluded ones');
SELECT pg_temp.as_user('b7200000-0000-4000-8000-000000000002');
SELECT pg_temp.check((SELECT count(*) FROM public.get_runner_activities('b7100000-0000-4000-8000-000000000001')) = 2, 'a follower also sees followers-only');
SELECT pg_temp.as_user('b7100000-0000-4000-8000-000000000001');
SELECT pg_temp.check((SELECT count(*) FROM public.get_runner_activities('b7100000-0000-4000-8000-000000000001')) = 3, 'the owner sees their own, minus not-counted');

RESET test.uid;
UPDATE public.profiles SET profile_visibility = 'followers' WHERE id = 'b7100000-0000-4000-8000-000000000001';
SELECT pg_temp.as_user('b7300000-0000-4000-8000-000000000003');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.get_runner_activities('b7100000-0000-4000-8000-000000000001')), 'a followers-only profile shows strangers nothing');

RESET test.uid;
INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES ('b7100000-0000-4000-8000-000000000001', 'b7200000-0000-4000-8000-000000000002');
SELECT pg_temp.as_user('b7200000-0000-4000-8000-000000000002');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.get_runner_activities('b7100000-0000-4000-8000-000000000001')), 'blocked viewers see nothing');
ROLLBACK;

-- Block, mute and report (20261112000003_block_mute_report.sql).
-- Needs every migration applied; runs in a transaction and rolls back.
\set ON_ERROR_STOP on
BEGIN;

CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('test.uid', u::text, true), set_config('test.role', 'authenticated', true) $$;
CREATE FUNCTION pg_temp.refused(sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN EXECUTE sql; RETURN false; EXCEPTION WHEN insufficient_privilege THEN RETURN true; END $$;

SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('d1000000-0000-4000-8000-000000000001', 'bm-ana@example.com'),
  ('d2000000-0000-4000-8000-000000000002', 'bm-raj@example.com'),
  ('d3000000-0000-4000-8000-000000000003', 'bm-sam@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES
  ('d1000000-0000-4000-8000-000000000001', 'bm_ana'),
  ('d2000000-0000-4000-8000-000000000002', 'bm_raj'),
  ('d3000000-0000-4000-8000-000000000003', 'bm_sam')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;

-- Ana and Raj follow each other; Sam follows Raj. Raj and Sam have posts; Raj commented on Ana's post.
INSERT INTO public.followers (follower_id, following_id) VALUES
  ('d1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000002'),
  ('d2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001'),
  ('d1000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000003');
INSERT INTO public.feed_posts (id, user_id, distance_km, post_type) VALUES
  ('e1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 5, 'run'),
  ('e2000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000002', 5, 'run'),
  ('e3000000-0000-4000-8000-000000000003', 'd3000000-0000-4000-8000-000000000003', 5, 'run');
INSERT INTO public.feed_post_comments (post_id, user_id, content)
  VALUES ('e1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000002', 'nice one');

SELECT pg_temp.as_user('d1000000-0000-4000-8000-000000000001');
SELECT pg_temp.check((SELECT count(*) FROM public.get_feed(50) WHERE user_id = 'd2000000-0000-4000-8000-000000000002') = 1,
  'before: Ana sees Raj''s post');

-- Ana blocks Raj.
SELECT public.block_user('d2000000-0000-4000-8000-000000000002');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.followers
   WHERE (follower_id = 'd1000000-0000-4000-8000-000000000001' AND following_id = 'd2000000-0000-4000-8000-000000000002')
      OR (follower_id = 'd2000000-0000-4000-8000-000000000002' AND following_id = 'd1000000-0000-4000-8000-000000000001')),
  'blocking removes follows both ways');
SELECT pg_temp.check((SELECT count(*) FROM public.get_feed(50) WHERE user_id = 'd2000000-0000-4000-8000-000000000002') = 0,
  'Ana no longer sees Raj''s posts');
SELECT pg_temp.check((SELECT count(*) FROM public.get_comments('e1000000-0000-4000-8000-000000000001')) = 0,
  'Raj''s comment is hidden from Ana');
SELECT pg_temp.check((SELECT restricted FROM public.get_user_profile_for_viewer('d2000000-0000-4000-8000-000000000002')),
  'Ana sees only Raj''s header, so she can unblock');

SELECT pg_temp.as_user('d2000000-0000-4000-8000-000000000002');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.get_user_profile_for_viewer('d1000000-0000-4000-8000-000000000001')),
  'Raj cannot see Ana''s profile at all');
SELECT pg_temp.check(pg_temp.refused($$SELECT public.toggle_follow('d1000000-0000-4000-8000-000000000001')$$),
  'Raj cannot follow Ana');
SELECT pg_temp.check(pg_temp.refused($$SELECT public.toggle_like('e1000000-0000-4000-8000-000000000001')$$),
  'Raj cannot give Ana kudos');
SELECT pg_temp.check(pg_temp.refused($$SELECT public.add_comment('e1000000-0000-4000-8000-000000000001', 'hey')$$),
  'Raj cannot comment on Ana''s post');
SELECT pg_temp.check((SELECT count(*) FROM public.get_feed(50, NULL, true) WHERE user_id = 'd1000000-0000-4000-8000-000000000001') = 0,
  'Ana is gone from Raj''s Discover too');

-- Mute is one-way and silent.
SELECT pg_temp.as_user('d1000000-0000-4000-8000-000000000001');
SELECT public.mute_user('d3000000-0000-4000-8000-000000000003');
SELECT pg_temp.check((SELECT count(*) FROM public.get_feed(50) WHERE user_id = 'd3000000-0000-4000-8000-000000000003') = 0,
  'muting Sam removes his posts from Ana''s feed');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.followers WHERE follower_id = 'd1000000-0000-4000-8000-000000000001' AND following_id = 'd3000000-0000-4000-8000-000000000003'),
  '…without unfollowing him');
SELECT pg_temp.check((SELECT count(*) FROM public.get_my_blocks_and_mutes()) = 2, 'Ana''s list shows one block and one mute');
SELECT pg_temp.as_user('d3000000-0000-4000-8000-000000000003');
SELECT pg_temp.check((SELECT restricted FROM public.get_user_profile_for_viewer('d1000000-0000-4000-8000-000000000001')) = false,
  'Sam is not told: Ana''s profile looks the same to him');

-- Unblock restores visibility (follows are not restored).
SELECT pg_temp.as_user('d1000000-0000-4000-8000-000000000001');
SELECT public.unblock_user('d2000000-0000-4000-8000-000000000002');
SELECT pg_temp.check((SELECT count(*) FROM public.get_comments('e1000000-0000-4000-8000-000000000001')) = 1,
  'after unblocking, Raj''s comment shows again');

-- Reports.
SELECT public.report_user('d2000000-0000-4000-8000-000000000002', 'harassment', 'repeated messages');
SELECT public.report_user('d2000000-0000-4000-8000-000000000002', 'harassment');
SELECT pg_temp.check((SELECT count(*) FROM public.user_reports WHERE reporter_id = 'd1000000-0000-4000-8000-000000000001') = 1,
  'a second report on the same runner is not duplicated while the first is open');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.user_reports WHERE reporter_id <> 'd1000000-0000-4000-8000-000000000001'
  AND target_user_id = 'd2000000-0000-4000-8000-000000000002') , 'reports are stored against the target');
DO $$ BEGIN
  PERFORM public.block_user('d1000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'FAILED: blocked yourself';
EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'ok  you cannot block yourself';
END $$;
SELECT pg_temp.check(NOT has_function_privilege('authenticated', 'public.hidden_user_ids(uuid)', 'EXECUTE'),
  'hidden_user_ids is not callable by clients (it would reveal who blocked you)');

ROLLBACK;

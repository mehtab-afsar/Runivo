-- Edit, audience and delete (20261112000004_activity_edit.sql).
-- Needs every migration applied; runs in a transaction and rolls back.
\set ON_ERROR_STOP on
BEGIN;

CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('test.uid', u::text, true), set_config('test.role', 'authenticated', true) $$;
CREATE FUNCTION pg_temp.refused(sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN EXECUTE sql; RETURN false; EXCEPTION WHEN insufficient_privilege THEN RETURN true; END $$;
-- Rows a viewer can read straight from the table (the RLS rule, evaluated as that viewer).
CREATE FUNCTION pg_temp.table_sees(viewer uuid, post uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT public.can_view_post(viewer, fp.user_id, fp.visibility) FROM public.feed_posts fp WHERE fp.id = post $$;

SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('f1000000-0000-4000-8000-000000000001', 'ae-owner@example.com'),
  ('f2000000-0000-4000-8000-000000000002', 'ae-fan@example.com'),
  ('f3000000-0000-4000-8000-000000000003', 'ae-stranger@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES
  ('f1000000-0000-4000-8000-000000000001', 'ae_owner'),
  ('f2000000-0000-4000-8000-000000000002', 'ae_fan'),
  ('f3000000-0000-4000-8000-000000000003', 'ae_stranger')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;
INSERT INTO public.followers (follower_id, following_id) VALUES
  ('f2000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001');

INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace)
VALUES ('a1000000-0000-4000-8000-0000000000a1', 'f1000000-0000-4000-8000-000000000001', 'run',
        now() - interval '1 hour', now() - interval '30 minutes', 5000, 1800, '6:00');
INSERT INTO public.feed_posts (id, user_id, run_id, distance_km, post_type)
VALUES ('b1000000-0000-4000-8000-0000000000b1', 'f1000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-0000000000a1', 5, 'run');

SELECT pg_temp.check((SELECT visibility FROM public.feed_posts WHERE id = 'b1000000-0000-4000-8000-0000000000b1') = 'everyone',
  'a new post takes the default audience (everyone)');

-- Owner edits it: followers only, with a title and private notes.
SELECT pg_temp.as_user('f1000000-0000-4000-8000-000000000001');
SELECT pg_temp.check(public.update_activity('a1000000-0000-4000-8000-0000000000a1', '  Easy loop  ', 'Felt good', 'followers', 4::smallint, 'left knee a bit tight'),
  'the owner can edit the activity');
SELECT pg_temp.check((SELECT title = 'Easy loop' AND content = 'Felt good' AND visibility = 'followers'
   FROM public.feed_posts WHERE id = 'b1000000-0000-4000-8000-0000000000b1'), 'title, description and audience reach the post');
SELECT pg_temp.check((SELECT private_notes = 'left knee a bit tight' AND perceived_effort = 4
   FROM public.runs WHERE id = 'a1000000-0000-4000-8000-0000000000a1'), 'private notes and effort stay on the run');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feed_posts' AND column_name = 'private_notes'),
  'private notes never reach the public post table');

SELECT pg_temp.check(pg_temp.table_sees('f2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-0000000000b1'),
  'a follower can read a followers-only post');
SELECT pg_temp.check(NOT pg_temp.table_sees('f3000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-0000000000b1'),
  'a stranger cannot read it, even straight from the table');

SELECT pg_temp.as_user('f3000000-0000-4000-8000-000000000003');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.get_feed(50, NULL, true) WHERE id = 'b1000000-0000-4000-8000-0000000000b1'),
  'Discover leaves out followers-only posts');
SELECT pg_temp.check(pg_temp.refused($$SELECT public.toggle_like('b1000000-0000-4000-8000-0000000000b1')$$),
  'a stranger cannot kudos a post they cannot see');
SELECT pg_temp.check(NOT public.update_activity('a1000000-0000-4000-8000-0000000000a1', 'hacked', NULL, 'everyone'),
  'nobody else can edit it');

SELECT pg_temp.as_user('f2000000-0000-4000-8000-000000000002');
SELECT pg_temp.check((SELECT title FROM public.get_feed(50) WHERE id = 'b1000000-0000-4000-8000-0000000000b1') = 'Easy loop',
  'the follower''s feed shows it with its title');

-- Only me.
SELECT pg_temp.as_user('f1000000-0000-4000-8000-000000000001');
SELECT public.update_activity('a1000000-0000-4000-8000-0000000000a1', 'Easy loop', NULL, 'only_me');
SELECT pg_temp.check(NOT pg_temp.table_sees('f2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-0000000000b1'),
  'only-me hides it from followers too');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.get_feed(50) WHERE id = 'b1000000-0000-4000-8000-0000000000b1'),
  'the owner still sees it');

-- Default audience for new posts.
SELECT public.set_default_activity_visibility('followers');
INSERT INTO public.feed_posts (user_id, distance_km, post_type) VALUES ('f1000000-0000-4000-8000-000000000001', 3, 'run');
SELECT pg_temp.check((SELECT visibility FROM public.feed_posts WHERE user_id = 'f1000000-0000-4000-8000-000000000001' AND run_id IS NULL) = 'followers',
  'new posts follow the chosen default');

-- Delete.
SELECT pg_temp.as_user('f3000000-0000-4000-8000-000000000003');
SELECT pg_temp.check(NOT public.delete_activity('a1000000-0000-4000-8000-0000000000a1'), 'nobody else can delete it');
SELECT pg_temp.as_user('f1000000-0000-4000-8000-000000000001');
SELECT pg_temp.check(public.delete_activity('a1000000-0000-4000-8000-0000000000a1'), 'the owner can delete it');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.runs WHERE id = 'a1000000-0000-4000-8000-0000000000a1')
   AND NOT EXISTS (SELECT 1 FROM public.feed_posts WHERE run_id = 'a1000000-0000-4000-8000-0000000000a1'),
  'the run and its post are gone');

DO $$ BEGIN
  PERFORM public.update_activity('a1000000-0000-4000-8000-0000000000a1', NULL, NULL, 'public');
  RAISE EXCEPTION 'FAILED: bad visibility accepted';
EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'ok  only everyone, followers or only_me are accepted';
END $$;

ROLLBACK;

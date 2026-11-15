-- Activity photos are readable only by people who may see the post (20261115000020).
-- Needs every migration applied; runs in a transaction and rolls back.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;

SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('c1000000-0000-4000-8000-000000000001', 'pp-owner@example.com'),
  ('c2000000-0000-4000-8000-000000000002', 'pp-fan@example.com'),
  ('c3000000-0000-4000-8000-000000000003', 'pp-stranger@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES
  ('c1000000-0000-4000-8000-000000000001', 'pp_owner'),
  ('c2000000-0000-4000-8000-000000000002', 'pp_fan'),
  ('c3000000-0000-4000-8000-000000000003', 'pp_stranger')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;
INSERT INTO public.followers (follower_id, following_id) VALUES
  ('c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001');

INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace) VALUES
  ('d1000000-0000-4000-8000-0000000000d1', 'c1000000-0000-4000-8000-000000000001', 'run', now() - interval '2 hours', now() - interval '90 minutes', 5000, 1800, '6:00'),
  ('d2000000-0000-4000-8000-0000000000d2', 'c1000000-0000-4000-8000-000000000001', 'run', now() - interval '5 hours', now() - interval '270 minutes', 5000, 1800, '6:00');
INSERT INTO public.feed_posts (id, user_id, run_id, distance_km, post_type, visibility) VALUES
  ('e1000000-0000-4000-8000-0000000000e1', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-0000000000d1', 5, 'run', 'everyone'),
  ('e2000000-0000-4000-8000-0000000000e2', 'c1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-0000000000d2', 5, 'run', 'followers');
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('feed', 'c1000000-0000-4000-8000-000000000001/d1000000-0000-4000-8000-0000000000d1/public.jpg'),
  ('feed', 'c1000000-0000-4000-8000-000000000001/d2000000-0000-4000-8000-0000000000d2/followers.jpg'),
  ('feed', 'c1000000-0000-4000-8000-000000000001/d9000000-0000-4000-8000-0000000000d9/no-post.jpg');

SELECT pg_temp.check(NOT (SELECT public FROM storage.buckets WHERE id = 'feed'), 'the feed bucket is private');
SELECT pg_temp.check(NOT (SELECT public FROM storage.buckets WHERE id = 'stories'), 'the stories bucket is private');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'user-media'), 'the gear photo bucket exists');

-- Read as each runner, through RLS.
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT EXECUTE ON FUNCTION storage.foldername(text) TO authenticated;
GRANT SELECT ON storage.objects, public.feed_posts, public.followers, public.profiles TO authenticated;
CREATE FUNCTION pg_temp.sees(viewer uuid) RETURNS text[] LANGUAGE plpgsql AS $$
DECLARE r text[];
BEGIN
  PERFORM set_config('test.uid', viewer::text, true);
  PERFORM set_config('test.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  SELECT coalesce(array_agg(split_part(name, '/', 3) ORDER BY split_part(name, '/', 3)), '{}') INTO r FROM storage.objects WHERE bucket_id = 'feed' AND name LIKE 'c1000000%';
  RESET ROLE;
  RETURN r;
END $$;

SELECT pg_temp.check(pg_temp.sees('c1000000-0000-4000-8000-000000000001') = ARRAY['followers.jpg','no-post.jpg','public.jpg'], 'the owner sees all of their own photos');
SELECT pg_temp.check(pg_temp.sees('c2000000-0000-4000-8000-000000000002') = ARRAY['followers.jpg','public.jpg'], 'a follower sees everyone and followers photos');
SELECT pg_temp.check(pg_temp.sees('c3000000-0000-4000-8000-000000000003') = ARRAY['public.jpg'], 'a stranger sees only photos on public posts');

SET LOCAL runivo.trusted_writer = 'on';
UPDATE public.feed_posts SET visibility = 'only_me' WHERE id = 'e1000000-0000-4000-8000-0000000000e1';
SELECT pg_temp.check(pg_temp.sees('c3000000-0000-4000-8000-000000000003') = '{}', 'making the post private hides its photos at once');
ROLLBACK;

-- 20261123000003_privacy_fixes: minors stay private, the minor flag is one-way,
-- comments follow post visibility, run_territories is gone.
-- Needs every migration applied; runs in a transaction and rolls back.
\set ON_ERROR_STOP on
SET client_min_messages = notice;
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;

-- Act as a signed-in runner (auth.uid/auth.role read these settings in the base schema).
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('test.uid', u::text, true);
  PERFORM set_config('test.role', 'authenticated', true);
END $$;
CREATE FUNCTION pg_temp.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('test.uid', '', true);
  PERFORM set_config('test.role', 'service_role', true);
END $$;
-- Runs an update as the runner; returns the SQLSTATE it failed with, or NULL.
CREATE FUNCTION pg_temp.try(sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE sql; RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE; END $$;

INSERT INTO auth.users (id, email) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'pf-teen@example.com'),
  ('a2000000-0000-4000-8000-000000000002', 'pf-author@example.com'),
  ('a3000000-0000-4000-8000-000000000003', 'pf-fan@example.com'),
  ('a4000000-0000-4000-8000-000000000004', 'pf-stranger@example.com')
ON CONFLICT (id) DO NOTHING;

-- ── Minors ───────────────────────────────────────────────────────────────────
UPDATE public.profiles SET profile_visibility = 'public', live_run_sharing_enabled = true
 WHERE id = 'a1000000-0000-4000-8000-000000000001';

-- The age screen marks the runner under 18 (the app also sends private, but a stale
-- client might not): the row goes to Followers (approval needed) with live sharing off.
SELECT pg_temp.as_user('a1000000-0000-4000-8000-000000000001');
UPDATE public.profiles SET age_range = 'under_18', age_confirmed_at = now()
 WHERE id = 'a1000000-0000-4000-8000-000000000001';
SELECT pg_temp.check(profile_visibility = 'followers' AND live_run_sharing_enabled = false,
  'becoming under 18 makes the profile followers-only and turns live sharing off')
FROM public.profiles WHERE id = 'a1000000-0000-4000-8000-000000000001';

SELECT pg_temp.check(pg_temp.try($q$UPDATE public.profiles SET profile_visibility = 'public' WHERE id = 'a1000000-0000-4000-8000-000000000001'$q$) = '42501',
  'a minor cannot make their profile public');
SELECT pg_temp.check(pg_temp.try($q$UPDATE public.profiles SET live_run_sharing_enabled = true WHERE id = 'a1000000-0000-4000-8000-000000000001'$q$) = '42501',
  'a minor cannot turn on live run sharing');
SELECT pg_temp.check(pg_temp.try($q$UPDATE public.profiles SET profile_visibility = 'followers' WHERE id = 'a1000000-0000-4000-8000-000000000001'$q$) IS NULL,
  'a minor can still choose followers-only');

-- A settings change that touches nothing private (km → mi) goes through and stays private.
UPDATE public.profiles SET distance_unit = 'mi' WHERE id = 'a1000000-0000-4000-8000-000000000001';
SELECT pg_temp.check(distance_unit = 'mi' AND profile_visibility = 'followers', 'an unrelated setting saves and privacy is untouched')
FROM public.profiles WHERE id = 'a1000000-0000-4000-8000-000000000001';

-- Onboarding skipping "About you" (null) or picking an adult range doesn't clear the flag.
UPDATE public.profiles SET age_range = NULL WHERE id = 'a1000000-0000-4000-8000-000000000001';
UPDATE public.profiles SET age_range = '25_34' WHERE id = 'a1000000-0000-4000-8000-000000000001';
UPDATE public.profiles SET age_confirmed_at = NULL WHERE id = 'a1000000-0000-4000-8000-000000000001';
SELECT pg_temp.check(age_range = 'under_18' AND age_confirmed_at IS NOT NULL, 'the client cannot clear the under-18 flag or the age confirmation')
FROM public.profiles WHERE id = 'a1000000-0000-4000-8000-000000000001';

-- Support (service role) can correct a wrong age.
SELECT pg_temp.as_service();
UPDATE public.profiles SET age_range = '18_24' WHERE id = 'a1000000-0000-4000-8000-000000000001';
SELECT pg_temp.check(age_range = '18_24', 'the service role can still correct the age range')
FROM public.profiles WHERE id = 'a1000000-0000-4000-8000-000000000001';

-- An adult is unaffected.
SELECT pg_temp.as_user('a2000000-0000-4000-8000-000000000002');
SELECT pg_temp.check(pg_temp.try($q$UPDATE public.profiles SET profile_visibility = 'public', live_run_sharing_enabled = true WHERE id = 'a2000000-0000-4000-8000-000000000002'$q$) IS NULL,
  'an adult can be public and share live');

-- ── Comments ─────────────────────────────────────────────────────────────────
SELECT pg_temp.as_service();
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO public.followers (follower_id, following_id) VALUES
  ('a3000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000002');
INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace) VALUES
  ('b1000000-0000-4000-8000-0000000000b1', 'a2000000-0000-4000-8000-000000000002', 'run', now() - interval '2 hours', now() - interval '90 minutes', 5000, 1800, '6:00');
INSERT INTO public.feed_posts (id, user_id, run_id, distance_km, post_type, visibility) VALUES
  ('e1000000-0000-4000-8000-0000000000f1', 'a2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-0000000000b1', 5, 'run', 'followers');
INSERT INTO public.feed_post_comments (id, post_id, user_id, content) VALUES
  ('c1000000-0000-4000-8000-0000000000c1', 'e1000000-0000-4000-8000-0000000000f1', 'a3000000-0000-4000-8000-000000000003', 'nice run');
SET LOCAL runivo.trusted_writer = 'off';

GRANT SELECT ON public.feed_post_comments, public.feed_posts, public.followers, public.profiles TO authenticated;
CREATE FUNCTION pg_temp.comment_count(viewer uuid) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  PERFORM pg_temp.as_user(viewer);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.feed_post_comments WHERE post_id = 'e1000000-0000-4000-8000-0000000000f1';
  RESET ROLE;
  RETURN n;
END $$;

SELECT pg_temp.check(pg_temp.comment_count('a3000000-0000-4000-8000-000000000003') = 1, 'a follower reads comments on a followers-only post');
SELECT pg_temp.check(pg_temp.comment_count('a2000000-0000-4000-8000-000000000002') = 1, 'the author reads them');
SELECT pg_temp.check(pg_temp.comment_count('a4000000-0000-4000-8000-000000000004') = 0, 'a stranger reads none (table)');

SELECT pg_temp.as_user('a4000000-0000-4000-8000-000000000004');
SELECT pg_temp.check((SELECT count(*) FROM public.get_comments('e1000000-0000-4000-8000-0000000000f1')) = 0, 'a stranger reads none (get_comments)');
SELECT pg_temp.as_user('a3000000-0000-4000-8000-000000000003');
SELECT pg_temp.check((SELECT count(*) FROM public.get_comments('e1000000-0000-4000-8000-0000000000f1')) = 1, 'a follower reads them (get_comments)');

SELECT pg_temp.check(NOT has_table_privilege('anon', 'public.feed_post_comments', 'SELECT'), 'anon cannot read comments at all');
SELECT pg_temp.check(NOT has_function_privilege('anon', 'public.get_comments(uuid, integer)', 'EXECUTE'), 'anon cannot call get_comments');

-- ── Legacy table ─────────────────────────────────────────────────────────────
SELECT pg_temp.check(to_regclass('public.run_territories') IS NULL, 'run_territories is dropped');

ROLLBACK;

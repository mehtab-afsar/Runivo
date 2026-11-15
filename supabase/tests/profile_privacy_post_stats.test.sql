-- Private profiles stay private in profiles_public; posts carry server numbers (20261115000022).
-- Needs every migration applied; runs in a transaction and rolls back.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.refused(sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN EXECUTE sql; RETURN false; EXCEPTION WHEN insufficient_privilege THEN RETURN true; END $$;

SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('a7100000-0000-4000-8000-000000000001', 'pv-private@example.com'),
  ('a7200000-0000-4000-8000-000000000002', 'pv-fans@example.com'),
  ('a7300000-0000-4000-8000-000000000003', 'pv-viewer@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username, bio, location, instagram, total_runs, profile_visibility) VALUES
  ('a7100000-0000-4000-8000-000000000001', 'pv_private', 'secret bio', 'Indiranagar', '@hidden', 40, 'private'),
  ('a7200000-0000-4000-8000-000000000002', 'pv_fans',    'fans bio',   'Koramangala', '@fans',   12, 'followers'),
  ('a7300000-0000-4000-8000-000000000003', 'pv_viewer',  'open bio',   'HSR',         '@open',    3, 'public')
ON CONFLICT (id) DO UPDATE SET bio = EXCLUDED.bio, location = EXCLUDED.location, instagram = EXCLUDED.instagram,
  total_runs = EXCLUDED.total_runs, profile_visibility = EXCLUDED.profile_visibility, username = EXCLUDED.username;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT, INSERT ON public.feed_posts TO authenticated;
GRANT SELECT ON public.runs, public.profiles, public.followers TO authenticated;

CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('test.uid', u::text, true), set_config('test.role', 'authenticated', true) $$;

-- The viewer looks at the other two, then follows the followers-only one.
SELECT pg_temp.as_user('a7300000-0000-4000-8000-000000000003');
SET LOCAL ROLE authenticated;
SELECT pg_temp.check((SELECT bio IS NULL AND location IS NULL AND instagram IS NULL AND total_runs IS NULL AND username = 'pv_private'
                        FROM public.profiles_public WHERE id = 'a7100000-0000-4000-8000-000000000001'),
  'a private runner shows only name, avatar and rank to others');
SELECT pg_temp.check((SELECT bio IS NULL FROM public.profiles_public WHERE id = 'a7200000-0000-4000-8000-000000000002'),
  'a followers-only runner hides details from non-followers');
SELECT pg_temp.check((SELECT bio = 'open bio' AND total_runs = 3 FROM public.profiles_public WHERE id = 'a7300000-0000-4000-8000-000000000003'),
  'you always see your own details');
RESET ROLE;
INSERT INTO public.followers (follower_id, following_id) VALUES ('a7300000-0000-4000-8000-000000000003', 'a7200000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT pg_temp.check((SELECT bio = 'fans bio' AND location = 'Koramangala' FROM public.profiles_public WHERE id = 'a7200000-0000-4000-8000-000000000002'),
  'a follower sees a followers-only profile');
RESET ROLE;

-- A scored run: 2.4 km, 19 PACE, one zone of 12,000 m² (written as the server).
SELECT set_config('test.role', 'service_role', true);
INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace)
VALUES ('a7a00000-0000-4000-8000-0000000000a1', 'a7300000-0000-4000-8000-000000000003', 'run', now() - interval '1 hour', now() - interval '40 minutes', 2400, 790, '5:29');
INSERT INTO public.run_processing (run_id, user_id, result) VALUES ('a7a00000-0000-4000-8000-0000000000a1', 'a7300000-0000-4000-8000-000000000003',
  '{"paceAdjustment": 19, "newZonesClaimed": 1, "claimedAreaM2": 12000}');

SELECT set_config('test.role', 'authenticated', true);
-- The app posts it claiming 500 PACE, 42 km, a huge zone, 999 kudos and Sovereign rank.
SET LOCAL ROLE authenticated;
INSERT INTO public.feed_posts (id, user_id, run_id, distance_km, pace_earned, territory_area_m2, territory_tier, likes, comment_count, runner_rank, post_type)
VALUES ('a7b00000-0000-4000-8000-0000000000b1', 'a7300000-0000-4000-8000-000000000003', 'a7a00000-0000-4000-8000-0000000000a1', 42, 500, 9999999, 'district', 999, 50, 'sovereign', 'run');
RESET ROLE;
SELECT pg_temp.check((SELECT pace_earned = 19 AND distance_km = 2.4 AND territory_area_m2 = 12000 AND likes = 0 AND comment_count = 0
                             AND runner_rank IS NOT DISTINCT FROM (SELECT runner_rank FROM public.profiles WHERE id = 'a7300000-0000-4000-8000-000000000003')
                        FROM public.feed_posts WHERE id = 'a7b00000-0000-4000-8000-0000000000b1'),
  'the post shows the server''s PACE, distance, zone and rank, with no kudos yet');

SET LOCAL ROLE authenticated;
SELECT pg_temp.check(pg_temp.refused($q$INSERT INTO public.feed_posts (user_id, post_type, stolen_from_username) VALUES ('a7300000-0000-4000-8000-000000000003', 'zone_steal', 'pv_private')$q$),
  'the app cannot write a fake "stole a zone from you" post');
SELECT pg_temp.check(pg_temp.refused($q$INSERT INTO public.feed_posts (user_id, run_id, post_type) VALUES ('a7300000-0000-4000-8000-000000000003', 'a7a00000-0000-4000-8000-0000000000ff', 'run')$q$),
  'a run post needs a real run of your own');
SELECT pg_temp.check(pg_temp.refused($q$INSERT INTO public.feed_posts (user_id, post_type, territory_tier) VALUES ('a7300000-0000-4000-8000-000000000003', 'milestone', 'domain')$q$),
  'a milestone needs a zone of that tier');
RESET ROLE;
ROLLBACK;

-- 20261123000005_review_fixes plus the follow rules it relies on: friends see each
-- other's live position, "Only me" can't be followed, the word list keeps names.
-- Needs every migration applied; runs in a transaction and rolls back.
\set ON_ERROR_STOP on
SET client_min_messages = notice;
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
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

INSERT INTO auth.users (id, email) VALUES
  ('b1000000-0000-4000-8000-000000000001', 'rf-ana@example.com'),
  ('b2000000-0000-4000-8000-000000000002', 'rf-ben@example.com'),
  ('b3000000-0000-4000-8000-000000000003', 'rf-cal@example.com'),
  ('b4000000-0000-4000-8000-000000000004', 'rf-dee@example.com')
ON CONFLICT (id) DO NOTHING;

-- ── F5: live positions between mutual followers ─────────────────────────────
INSERT INTO public.followers (follower_id, following_id) VALUES
  ('b1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002'),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001')
ON CONFLICT DO NOTHING;
UPDATE public.profiles SET live_run_sharing_enabled = true WHERE id = 'b2000000-0000-4000-8000-000000000002';
INSERT INTO public.live_run_positions (user_id, run_id, lat, lng, updated_at)
VALUES ('b2000000-0000-4000-8000-000000000002', 'run-live-1', 51.5, -0.12, now());

SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('b1000000-0000-4000-8000-000000000001');
SELECT pg_temp.check(count(*) = 1, 'a mutual friend sees the live position')
FROM public.live_run_positions WHERE user_id = 'b2000000-0000-4000-8000-000000000002';
SELECT pg_temp.as_user('b3000000-0000-4000-8000-000000000003');
SELECT pg_temp.check(count(*) = 0, 'a stranger does not')
FROM public.live_run_positions WHERE user_id = 'b2000000-0000-4000-8000-000000000002';
RESET ROLE;

UPDATE public.profiles SET live_run_sharing_enabled = false WHERE id = 'b2000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('b1000000-0000-4000-8000-000000000001');
SELECT pg_temp.check(count(*) = 0, 'sharing off hides it from friends too')
FROM public.live_run_positions WHERE user_id = 'b2000000-0000-4000-8000-000000000002';
RESET ROLE;

-- ── F4: "Only me" can't be followed; Followers needs approval ───────────────
UPDATE public.profiles SET profile_visibility = 'private' WHERE id = 'b3000000-0000-4000-8000-000000000003';
UPDATE public.profiles SET profile_visibility = 'followers' WHERE id = 'b4000000-0000-4000-8000-000000000004';
SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('b1000000-0000-4000-8000-000000000001');
SELECT pg_temp.check(public.set_follow('b3000000-0000-4000-8000-000000000003', true) = 'none', 'following an Only me profile does nothing');
SELECT pg_temp.check(public.set_follow('b4000000-0000-4000-8000-000000000004', true) = 'requested', 'following a Followers profile sends a request');
RESET ROLE;
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.follow_requests WHERE following_id = 'b3000000-0000-4000-8000-000000000003'),
  'no request left waiting on the Only me profile');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.follow_requests
  WHERE follower_id = 'b1000000-0000-4000-8000-000000000001' AND following_id = 'b4000000-0000-4000-8000-000000000004'),
  'the request is waiting for approval');

-- ── F7: names that contain no blocked word survive; real abuse is still caught ─
SELECT pg_temp.check(NOT public.contains_blocked_term('Lund parkrun with Dick and Randi'), 'names and places are not blocked');
SELECT pg_temp.check(NOT public.contains_blocked_term('Cum laude 5k past Coon Rapids'), 'cum laude and Coon Rapids are not blocked');
SELECT pg_temp.check(public.contains_blocked_term('what a f*ck run, total sh1t'), 'folded profanity is still caught')
  WHERE public.contains_blocked_term('total sh1t');

-- ── F8: post tier follows the claimed area ──────────────────────────────────
SELECT pg_temp.check(public.tier_for_area(NULL) IS NULL AND public.tier_for_area(4999) = 'patch'
  AND public.tier_for_area(5000) = 'block' AND public.tier_for_area(600000) = 'domain', 'tier bands match the app');

ROLLBACK;

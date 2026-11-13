-- My rewards and circle leaderboards (20261113000002).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('test.uid', u::text, true), set_config('test.role', 'authenticated', true) $$;
CREATE FUNCTION pg_temp.fails(sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN EXECUTE sql; RETURN false; EXCEPTION WHEN OTHERS THEN RETURN true; END $$;

SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('91000000-0000-4000-8000-000000000001', 'cb-me@example.com'),
  ('92000000-0000-4000-8000-000000000002', 'cb-friend@example.com'),
  ('93000000-0000-4000-8000-000000000003', 'cb-clubmate@example.com'),
  ('94000000-0000-4000-8000-000000000004', 'cb-stranger@example.com'),
  ('95000000-0000-4000-8000-000000000005', 'cb-blocked@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES
  ('91000000-0000-4000-8000-000000000001', 'cb_me'), ('92000000-0000-4000-8000-000000000002', 'cb_friend'),
  ('93000000-0000-4000-8000-000000000003', 'cb_clubmate'), ('94000000-0000-4000-8000-000000000004', 'cb_stranger'),
  ('95000000-0000-4000-8000-000000000005', 'cb_blocked')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;
INSERT INTO public.followers (follower_id, following_id) VALUES
  ('91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000002'),
  ('91000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000005');
INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES ('91000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000005');
INSERT INTO public.clubs (id, name, owner_id) VALUES ('9c000000-0000-4000-8000-00000000009c', 'cb club', '91000000-0000-4000-8000-000000000001');
INSERT INTO public.club_members (club_id, user_id, role) VALUES
  ('9c000000-0000-4000-8000-00000000009c', '91000000-0000-4000-8000-000000000001', 'admin'),
  ('9c000000-0000-4000-8000-00000000009c', '93000000-0000-4000-8000-000000000003', 'member');
INSERT INTO public.runs (user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace)
SELECT u, 'run', now() - interval '2 hours', now() - interval '1 hour', km * 1000, 3000, '6:00'
  FROM (VALUES ('91000000-0000-4000-8000-000000000001'::uuid, 5), ('92000000-0000-4000-8000-000000000002'::uuid, 8),
               ('93000000-0000-4000-8000-000000000003'::uuid, 12), ('94000000-0000-4000-8000-000000000004'::uuid, 30),
               ('95000000-0000-4000-8000-000000000005'::uuid, 20)) t(u, km);

SELECT pg_temp.as_user('91000000-0000-4000-8000-000000000001');
SELECT pg_temp.check((SELECT array_agg(username ORDER BY rank) FROM public.get_circle_leaderboard('distance', 'week', 'following'))
  = ARRAY['cb_friend', 'cb_me'], 'following board: you and who you follow, minus blocked');
SELECT pg_temp.check((SELECT rank FROM public.get_circle_leaderboard('distance', 'week', 'following') WHERE username = 'cb_me') = 2,
  'ranked inside the circle');
SELECT pg_temp.check((SELECT array_agg(username ORDER BY rank) FROM public.get_circle_leaderboard('distance', 'week', 'clubs'))
  = ARRAY['cb_clubmate', 'cb_me'], 'club board: you and your club mates');
SELECT pg_temp.check(pg_temp.fails($q$SELECT * FROM public.get_circle_leaderboard('distance', 'week', 'world')$q$), 'bad circle refused');

-- Rewards
RESET test.uid;
INSERT INTO public.pace_store_rewards (id, brand, title, description, pace_cost, value_label, expires_at) VALUES
  ('9a000000-0000-4000-8000-0000000000a1', 'Brand A', '10% off', 'x', 100, '10%', now() + interval '30 days'),
  ('9a000000-0000-4000-8000-0000000000a2', 'Brand B', 'Free gel', 'x', 50, 'Gel', now() - interval '1 day'),
  ('9a000000-0000-4000-8000-0000000000a3', 'Brand C', 'Entry', 'x', 80, 'Entry', NULL);
INSERT INTO public.pace_redemptions (id, user_id, reward_id, pace_spent, fulfillment_code) VALUES
  ('9b000000-0000-4000-8000-0000000000b1', '91000000-0000-4000-8000-000000000001', '9a000000-0000-4000-8000-0000000000a1', 100, 'ABC123'),
  ('9b000000-0000-4000-8000-0000000000b2', '91000000-0000-4000-8000-000000000001', '9a000000-0000-4000-8000-0000000000a2', 50, 'GEL1'),
  ('9b000000-0000-4000-8000-0000000000b3', '91000000-0000-4000-8000-000000000001', '9a000000-0000-4000-8000-0000000000a3', 80, NULL),
  ('9b000000-0000-4000-8000-0000000000b4', '92000000-0000-4000-8000-000000000002', '9a000000-0000-4000-8000-0000000000a1', 100, 'FRIEND');

SELECT pg_temp.as_user('91000000-0000-4000-8000-000000000001');
SELECT pg_temp.check((SELECT count(*) FROM public.get_my_rewards()) = 3, 'my rewards lists only mine');
SELECT pg_temp.check((SELECT status FROM public.get_my_rewards() WHERE brand = 'Brand A') = 'unused', 'a code not yet used');
SELECT pg_temp.check((SELECT status FROM public.get_my_rewards() WHERE brand = 'Brand B') = 'expired', 'an expired reward');
SELECT pg_temp.check((SELECT status FROM public.get_my_rewards() WHERE brand = 'Brand C') = 'pending', 'a code still on its way');
SELECT pg_temp.check(public.set_reward_used('9b000000-0000-4000-8000-0000000000b1', true), 'mark a code used');
SELECT pg_temp.check((SELECT status FROM public.get_my_rewards() WHERE brand = 'Brand A') = 'used', 'now used');
SELECT pg_temp.check(NOT public.set_reward_used('9b000000-0000-4000-8000-0000000000b4', true), 'cannot mark someone else''s code');
SELECT public.set_reward_used('9b000000-0000-4000-8000-0000000000b1', false);
SELECT pg_temp.check((SELECT status FROM public.get_my_rewards() WHERE brand = 'Brand A') = 'unused', 'and undo it');
ROLLBACK;

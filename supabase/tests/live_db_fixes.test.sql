-- 20261124000002_live_db_fixes: the holes the live-database audit proved.
-- Needs every migration applied; runs in a transaction and rolls back.
\set ON_ERROR_STOP on
SET client_min_messages = notice;
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.try(sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE sql; RETURN NULL; EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE; END $$;

INSERT INTO auth.users (id, email) VALUES
  ('e1000000-0000-4000-8000-000000000001', 'ld-owner@example.com'),
  ('e2000000-0000-4000-8000-000000000002', 'ld-attacker@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.clubs (id, name, owner_id, join_policy)
VALUES ('e3000000-0000-4000-8000-000000000003', 'Open Dawn Club', 'e1000000-0000-4000-8000-000000000001', 'open');

-- B1, B2, M3: nothing private is readable without signing in.
SELECT pg_temp.check(NOT has_table_privilege('anon', 'public.shoe_stats', 'SELECT'), 'anon cannot read shoe_stats');
SELECT pg_temp.check(NOT has_table_privilege('anon', 'public.leaderboard_weekly', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.leaderboard_weekly', 'SELECT'), 'leaderboard_weekly is server-only');
SELECT pg_temp.check(NOT has_table_privilege('anon', 'public.kudos', 'SELECT'), 'anon cannot read kudos');

-- M4: no SECURITY DEFINER function is callable without signing in (bar the landing-page count).
SELECT pg_temp.check(count(*) = 0, 'anon can call no SECURITY DEFINER function')
FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
  AND p.proname <> 'city_runner_count' AND has_function_privilege('anon', p.oid, 'EXECUTE');

-- B3: joining an open club makes you a member, never an owner or admin.
SET LOCAL ROLE authenticated;
SELECT set_config('test.role', 'authenticated', true), set_config('test.uid', 'e2000000-0000-4000-8000-000000000002', true);
SELECT pg_temp.check(pg_temp.try($q$INSERT INTO public.club_members (club_id, user_id, role)
  VALUES ('e3000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000002', 'owner')$q$) IS NOT NULL,
  'cannot join an open club as owner');
SELECT pg_temp.check(pg_temp.try($q$INSERT INTO public.club_members (club_id, user_id, role)
  VALUES ('e3000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000002', 'member')$q$) IS NULL,
  'can still join an open club as a member');

-- B5: signed-in runners cannot test arbitrary pairs.
SELECT pg_temp.check(pg_temp.try($q$SELECT public.is_blocked_between('e1000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000003')$q$) = '42501',
  'is_blocked_between is not callable by runners');
RESET ROLE;

ROLLBACK;

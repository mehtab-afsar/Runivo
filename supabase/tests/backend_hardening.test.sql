-- Migration 20261124000001: block lists, privacy-place oracle and table privileges.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;

-- 1. Nobody but the server can read a runner's block / mute list.
SELECT pg_temp.check(NOT has_function_privilege('anon', 'public.hidden_user_ids(uuid)', 'EXECUTE'), 'anon cannot call hidden_user_ids');
SELECT pg_temp.check(NOT has_function_privilege('authenticated', 'public.hidden_user_ids(uuid)', 'EXECUTE'), 'signed-in runners cannot call hidden_user_ids');
SELECT pg_temp.check(has_function_privilege('service_role', 'public.hidden_user_ids(uuid)', 'EXECUTE'), 'service_role can call hidden_user_ids');
SELECT pg_temp.check(NOT has_function_privilege('anon', 'public.leaderboard_circle(uuid, text)', 'EXECUTE'), 'anon cannot call leaderboard_circle');
SELECT pg_temp.check(NOT has_function_privilege('anon', 'public.is_blocked_between(uuid, uuid)', 'EXECUTE'), 'anon cannot probe blocks');
SELECT pg_temp.check(has_function_privilege('authenticated', 'public.is_blocked_between(uuid, uuid)', 'EXECUTE'), 'policies can still call is_blocked_between');

-- 2. The caller-bound wrapper, and the event_participants policy that uses it.
SELECT pg_temp.check(has_function_privilege('authenticated', 'public.is_hidden_from_me(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.is_hidden_from_me(uuid)', 'EXECUTE'), 'is_hidden_from_me: signed-in only');
SELECT set_config('test.role', 'authenticated', true), set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', true);
SET LOCAL ROLE authenticated;
SELECT count(*) FROM public.event_participants;   -- raised "permission denied for function hidden_user_ids" before
SELECT pg_temp.check(public.is_hidden_from_me(NULL) IS FALSE, 'is_hidden_from_me(NULL) is false');
RESET ROLE;

-- 3. The privacy-place oracle is closed; the feed route trigger still works as definer.
SELECT pg_temp.check(NOT has_function_privilege('anon', 'public.public_route_for(uuid, jsonb, boolean)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.public_route_for(uuid, jsonb, boolean)', 'EXECUTE'), 'clients cannot call public_route_for');
SELECT pg_temp.check((SELECT prosecdef FROM pg_proc WHERE oid = 'public.blur_feed_post_route()'::regprocedure), 'blur_feed_post_route runs as definer');
SELECT pg_temp.check(NOT has_function_privilege('authenticated', 'public.sync_energy(uuid)', 'EXECUTE'), 'clients cannot call sync_energy');

-- 4. personal_records: no anonymous reads; the policy is the profile-visibility one.
SELECT pg_temp.check(NOT has_table_privilege('anon', 'public.personal_records', 'SELECT'), 'anon cannot read personal_records');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'personal_records'
  AND policyname = 'personal_records: visible with the profile'), 'personal_records read policy follows profile visibility');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'personal_records' AND policyname = 'pr_read'), 'old open pr_read policy is gone');

-- 5. Table privileges: anon never writes; nobody outside the server truncates.
SELECT pg_temp.check(NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND grantee = 'anon' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')), 'anon has no write or TRUNCATE privilege on any public table');
SELECT pg_temp.check(NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND grantee = 'authenticated' AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')), 'signed-in runners have no TRUNCATE/TRIGGER/REFERENCES on any public table');
ROLLBACK;

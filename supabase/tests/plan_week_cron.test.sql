-- The weekly plan job leaves engine-built (version 2) plans alone (20261115000027).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES ('c5000000-0000-4000-8000-000000000001', 'plans@example.com') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES ('c5000000-0000-4000-8000-000000000001', 'planner') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.training_plans (id, user_id, goal, weeks_total, week_current, status, plan_data, created_at) VALUES
  ('c5100000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'half', 10, 10, 'active', '{"version": 2, "weeks": []}', now() - interval '70 days'),
  ('c5100000-0000-4000-8000-000000000002', 'c5000000-0000-4000-8000-000000000001', 'old', 4, 1, 'active', '{"weeks": []}', now() - interval '8 days');
SELECT public.advance_training_plan_week();
SELECT pg_temp.check((SELECT status FROM public.training_plans WHERE id = 'c5100000-0000-4000-8000-000000000001') = 'active', 'a version-2 plan is never completed by the job');
SELECT pg_temp.check((SELECT week_current FROM public.training_plans WHERE id = 'c5100000-0000-4000-8000-000000000001') = 10, 'nor moved on');
SELECT pg_temp.check((SELECT week_current FROM public.training_plans WHERE id = 'c5100000-0000-4000-8000-000000000002') = 2, 'older plans still advance');
ROLLBACK;

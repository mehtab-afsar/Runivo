-- PaceX spend cap holds under parallel requests (20261115000023).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES ('a9100000-0000-4000-8000-000000000001', 'ai-cap@example.com') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES ('a9100000-0000-4000-8000-000000000001', 'ai_cap') ON CONFLICT (id) DO NOTHING;

CREATE FUNCTION pg_temp.reserve(feature text) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(refused, 'ok') FROM public.ai_reserve_spend('a9100000-0000-4000-8000-000000000001', feature, 0.02, 0.12, 0.08) $$;

-- Six requests arriving together, each reserving $0.02 of a $0.12 day.
SELECT pg_temp.check((SELECT array_agg(pg_temp.reserve('weekly_brief')) FROM generate_series(1, 7)) =
  ARRAY['ok','ok','ok','ok','ok','ok','daily_limit_reached'], 'parallel requests see each other: the seventh is refused');
DELETE FROM public.ai_usage_log WHERE user_id = 'a9100000-0000-4000-8000-000000000001';

SELECT pg_temp.check((SELECT array_agg(pg_temp.reserve('coach_chat')) FROM generate_series(1, 5)) =
  ARRAY['ok','ok','ok','ok','chat_limit_reached'], 'chat has its own tighter cap');

-- A reservation left by a crashed request stops counting after 5 minutes.
UPDATE public.ai_usage_log SET created_at = now() - interval '10 minutes' WHERE user_id = 'a9100000-0000-4000-8000-000000000001' AND reservation;
SELECT pg_temp.check(pg_temp.reserve('coach_chat') = 'ok', 'stale reservations expire');

-- Real logged cost still counts for 24 hours.
DELETE FROM public.ai_usage_log WHERE user_id = 'a9100000-0000-4000-8000-000000000001';
INSERT INTO public.ai_usage_log (user_id, feature, input_tokens, output_tokens, cost_usd, created_at)
VALUES ('a9100000-0000-4000-8000-000000000001', 'post_run', 1000, 500, 0.12, now() - interval '3 hours');
SELECT pg_temp.check(pg_temp.reserve('post_run') = 'daily_limit_reached', 'spent cost counts for the day');
SELECT pg_temp.check(NOT has_function_privilege('authenticated', 'public.ai_reserve_spend(uuid, text, numeric, numeric, numeric)', 'EXECUTE'), 'only the server can reserve');
ROLLBACK;

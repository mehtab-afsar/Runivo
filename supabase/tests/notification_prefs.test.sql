-- Quiet hours and daily nudge limit the runner sets (20261113000012).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES ('c1100000-0000-4000-8000-000000000001', 'np-me@example.com') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username, timezone) VALUES ('c1100000-0000-4000-8000-000000000001', 'np_me', 'UTC')
ON CONFLICT (id) DO UPDATE SET timezone = 'UTC';

SELECT pg_temp.check(NOT in_quiet_hours(12, 22, 7) AND in_quiet_hours(23, 22, 7) AND in_quiet_hours(3, 22, 7), 'wrapping quiet hours');
SELECT pg_temp.check(in_quiet_hours(14, 13, 15) AND NOT in_quiet_hours(15, 13, 15), 'same-day quiet hours');
SELECT pg_temp.check(NOT in_quiet_hours(3, 0, 0), 'start = end means none');

-- Defaults: 23:00 UTC is quiet.
SELECT pg_temp.check(NOT queue_notification('c1100000-0000-4000-8000-000000000001', 'streak_risk', 't', 'b', null, 'np1', false, '2026-11-10 23:00Z'), 'default quiet hours hold a nudge');
SELECT pg_temp.check(queue_notification('c1100000-0000-4000-8000-000000000001', 'territory_lost', 't', 'b', null, 'np2', true, '2026-11-10 23:00Z'), 'urgent ignores quiet hours');

-- Runner turns quiet hours off and sets the limit to 1.
SELECT set_config('test.uid', 'c1100000-0000-4000-8000-000000000001', true), set_config('test.role', 'authenticated', true);
SELECT set_notification_prefs(0, 0, 1);
SELECT pg_temp.check((SELECT quiet_start = 0 AND quiet_end = 0 AND daily_limit = 1 FROM get_notification_prefs()), 'prefs saved and read back');
SELECT pg_temp.check(queue_notification('c1100000-0000-4000-8000-000000000001', 'streak_risk', 't', 'b', null, 'np3', false, '2026-11-11 23:30Z'), 'no quiet hours: nudge at 23:30 goes');
SELECT pg_temp.check(NOT queue_notification('c1100000-0000-4000-8000-000000000001', 'streak_risk', 't', 'b', null, 'np4', false, '2026-11-11 23:40Z'), 'limit of 1 holds the second');
DO $$ BEGIN PERFORM set_notification_prefs(25, 7, 3); RAISE EXCEPTION 'no error'; EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'no error' THEN RAISE; END IF; END $$;
SELECT pg_temp.check(true, 'out-of-range hour refused');
ROLLBACK;

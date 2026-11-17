-- Event creators and cancelling (20261117000009).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('fb000000-0000-4000-8000-000000000001', 'host@example.com'),
  ('fb000000-0000-4000-8000-000000000002', 'goer@example.com'),
  ('fb000000-0000-4000-8000-000000000003', 'clubadmin@example.com');
INSERT INTO public.clubs (id, name, owner_id) VALUES ('fb100000-0000-4000-8000-000000000001', 'Event Club', 'fb000000-0000-4000-8000-000000000003');

SET LOCAL test.uid = 'fb000000-0000-4000-8000-000000000001';
INSERT INTO public.events (id, title, event_type, starts_at, ends_at, created_by) VALUES
  ('fb200000-0000-4000-8000-000000000001', 'Sunday 10K', 'community-run', now() + interval '2 days', now() + interval '2 days 2 hours',
   'fb000000-0000-4000-8000-000000000002');  -- a forged creator is ignored
SELECT pg_temp.check((SELECT created_by FROM public.events WHERE id = 'fb200000-0000-4000-8000-000000000001') = 'fb000000-0000-4000-8000-000000000001', 'creator is the signed-in runner');
INSERT INTO public.event_participants (event_id, user_id) VALUES ('fb200000-0000-4000-8000-000000000001', 'fb000000-0000-4000-8000-000000000002');

SET LOCAL test.uid = 'fb000000-0000-4000-8000-000000000003';
INSERT INTO public.events (id, title, event_type, starts_at, ends_at, club_id) VALUES
  ('fb200000-0000-4000-8000-000000000002', 'Club long run', 'community-run', now() + interval '3 days', now() + interval '3 days 2 hours', 'fb100000-0000-4000-8000-000000000001');

SET LOCAL test.uid = 'fb000000-0000-4000-8000-000000000002';
SELECT pg_temp.check(public.cancel_event('fb200000-0000-4000-8000-000000000001') = 'not_allowed', 'a runner going cannot cancel it');

SET LOCAL test.uid = 'fb000000-0000-4000-8000-000000000001';
SELECT pg_temp.check(public.cancel_event('fb200000-0000-4000-8000-000000000001') = 'cancelled', 'the poster cancels');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.notifications WHERE user_id = 'fb000000-0000-4000-8000-000000000002' AND title = 'Sunday 10K is cancelled'), 'people going are told');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.events WHERE id = 'fb200000-0000-4000-8000-000000000001'), 'event removed');

SELECT pg_temp.check(public.cancel_event('fb200000-0000-4000-8000-000000000002') = 'not_allowed', 'not your club run');
SET LOCAL test.uid = 'fb000000-0000-4000-8000-000000000003';
SELECT pg_temp.check(public.cancel_event('fb200000-0000-4000-8000-000000000002') = 'cancelled', 'the club owner cancels a club run');
ROLLBACK;

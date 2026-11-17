-- Deleting and leaving clubs (20261117000006), member count (20261117000007).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('f1000000-0000-4000-8000-000000000001', 'own@example.com'),
  ('f1000000-0000-4000-8000-000000000002', 'mem@example.com');
INSERT INTO public.profiles (id, username) VALUES
  ('f1000000-0000-4000-8000-000000000001', 'clubowner'), ('f1000000-0000-4000-8000-000000000002', 'clubmember')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;
INSERT INTO public.clubs (id, name, owner_id) VALUES ('f2000000-0000-4000-8000-000000000001', 'Doomed Striders', 'f1000000-0000-4000-8000-000000000001');
INSERT INTO public.club_members (club_id, user_id, role) VALUES
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'owner'),
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', 'member')
ON CONFLICT DO NOTHING;
INSERT INTO public.lobbies (club_id, name, status, created_by) VALUES ('f2000000-0000-4000-8000-000000000001', 'Doomed Striders', 'open', 'f1000000-0000-4000-8000-000000000001');
INSERT INTO public.events (id, title, event_type, starts_at, ends_at, club_id) VALUES
  ('f3000000-0000-4000-8000-000000000001', 'Next Saturday long run', 'community-run', now() + interval '3 days', now() + interval '3 days 2 hours', 'f2000000-0000-4000-8000-000000000001'),
  ('f3000000-0000-4000-8000-000000000002', 'Last Saturday long run', 'community-run', now() - interval '4 days', now() - interval '4 days' + interval '2 hours', 'f2000000-0000-4000-8000-000000000001');

SELECT pg_temp.check((SELECT member_count FROM public.clubs WHERE id = 'f2000000-0000-4000-8000-000000000001') = 2, 'two members counted as 2 (20261117000007)');
SET LOCAL test.uid = 'f1000000-0000-4000-8000-000000000001';
SELECT pg_temp.check(public.leave_club('f2000000-0000-4000-8000-000000000001') = 'owner', 'owner cannot just leave');

SET LOCAL test.uid = 'f1000000-0000-4000-8000-000000000002';
SELECT pg_temp.check(public.delete_club('f2000000-0000-4000-8000-000000000001') = 'not_owner', 'a member cannot delete');
SELECT pg_temp.check(public.leave_club('f2000000-0000-4000-8000-000000000001') = 'left', 'a member can leave');
INSERT INTO public.club_members (club_id, user_id, role) VALUES ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', 'member');

SET LOCAL test.uid = 'f1000000-0000-4000-8000-000000000001';
SELECT pg_temp.check(public.delete_club('f2000000-0000-4000-8000-000000000001') = 'deleted', 'owner deletes');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = 'f2000000-0000-4000-8000-000000000001'), 'club gone');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.club_members WHERE club_id = 'f2000000-0000-4000-8000-000000000001'), 'members gone');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.lobbies WHERE name = 'Doomed Striders'), 'club chat gone');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.events WHERE id = 'f3000000-0000-4000-8000-000000000001'), 'upcoming club run gone (not left as a public event)');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.events WHERE id = 'f3000000-0000-4000-8000-000000000002'), 'past club run kept');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.notifications WHERE user_id = 'f1000000-0000-4000-8000-000000000002' AND title LIKE 'Doomed Striders was closed'), 'members are told');
ROLLBACK;

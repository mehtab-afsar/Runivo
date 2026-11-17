-- Club chat is for current members only (20261117000008).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
SET LOCAL runivo.trusted_writer = 'on';
GRANT SELECT, INSERT ON public.lobby_messages, public.lobbies TO authenticated;
GRANT SELECT ON public.club_members, public.clubs TO authenticated;
INSERT INTO auth.users (id, email) VALUES
  ('fa000000-0000-4000-8000-000000000001', 'chatowner@example.com'),
  ('fa000000-0000-4000-8000-000000000002', 'chatter@example.com');
INSERT INTO public.clubs (id, name, owner_id) VALUES ('fa100000-0000-4000-8000-000000000001', 'Chat Club', 'fa000000-0000-4000-8000-000000000001');
INSERT INTO public.club_members (club_id, user_id, role) VALUES
  ('fa100000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-000000000001', 'admin'),
  ('fa100000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-000000000002', 'member')
ON CONFLICT DO NOTHING;
-- The member (not the owner) opens the chat first, so they "created" the room.
INSERT INTO public.lobbies (id, club_id, name, status, created_by) VALUES
  ('fa200000-0000-4000-8000-000000000001', 'fa100000-0000-4000-8000-000000000001', 'Chat Club', 'open', 'fa000000-0000-4000-8000-000000000002');
INSERT INTO public.lobby_messages (lobby_id, user_id, content) VALUES
  ('fa200000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-000000000001', 'Saturday 6 AM?');

SELECT pg_temp.check(
  (SELECT count(*) FROM (SELECT 1) x WHERE EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'lobbies_one_per_club')) = 1,
  'one room per club is enforced');

SET LOCAL ROLE authenticated;
SET LOCAL test.uid = 'fa000000-0000-4000-8000-000000000002';
SELECT pg_temp.check((SELECT count(*) FROM public.lobby_messages WHERE lobby_id = 'fa200000-0000-4000-8000-000000000001') = 1, 'member reads the chat');
RESET ROLE;
DELETE FROM public.club_members WHERE user_id = 'fa000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT pg_temp.check((SELECT count(*) FROM public.lobby_messages WHERE lobby_id = 'fa200000-0000-4000-8000-000000000001') = 0, 'after leaving: the room creator reads nothing');
DO $$ BEGIN
  INSERT INTO public.lobby_messages (lobby_id, user_id, content) VALUES ('fa200000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-000000000002', 'still here');
  RAISE EXCEPTION 'FAILED: ex-member posted';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  after leaving: cannot post';
END $$;
RESET ROLE;
ROLLBACK;

-- Chat blocking holds both ways at the database (migration 20261115000016).
-- Run after _stub_chat_blocks.sql and the migration.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
-- Messages visible to a runner, counted as that runner.
CREATE FUNCTION pg_temp.seen_by(uid uuid) RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  PERFORM set_config('test.uid', uid::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.lobby_messages;
  RESET ROLE;
  RETURN n;
END $$;

-- One public room; Ana and Ben each wrote a message; Cy wrote none.
INSERT INTO public.lobbies (id, created_by, club_id) VALUES ('00000000-0000-0000-0000-0000000000d1', NULL, NULL);
INSERT INTO public.lobby_messages (lobby_id, user_id, content) VALUES
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'from ana'),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', 'from ben');

SELECT pg_temp.check(pg_temp.seen_by('00000000-0000-0000-0000-0000000000c1') = 2, 'no block: everyone sees both messages');

-- Ana blocks Ben.
INSERT INTO public.user_blocks VALUES ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');
SELECT pg_temp.check(pg_temp.seen_by('00000000-0000-0000-0000-0000000000a1') = 1, 'blocker no longer sees the blocked runner''s message');
SELECT pg_temp.check(pg_temp.seen_by('00000000-0000-0000-0000-0000000000b1') = 1, 'blocked runner no longer sees the blocker''s message');
SELECT pg_temp.check(pg_temp.seen_by('00000000-0000-0000-0000-0000000000c1') = 2, 'a third runner still sees both');
ROLLBACK;

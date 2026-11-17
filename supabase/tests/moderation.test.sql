-- Moderation: reporting, auto-hide, bans and the word filter (migration 20261115000015).
-- Runs on a database built from supabase/migrations (see README). Each check prints "ok  <what>".
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
-- Runs a statement as a signed-in runner and returns the error text, or NULL when it succeeded.
CREATE FUNCTION pg_temp.as_user(uid uuid, stmt text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('test.uid', uid::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN EXECUTE stmt; EXCEPTION WHEN OTHERS THEN RESET ROLE; RETURN SQLERRM; END;
  RESET ROLE;
  RETURN NULL;
END $$;

-- Four runners sign up (the sign-up trigger creates their profiles).
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'author@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'rep1@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'rep2@example.com'),
  ('00000000-0000-0000-0000-0000000000b3', 'rep3@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.feed_posts (id, user_id) VALUES ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1');
INSERT INTO public.blocked_terms (term) VALUES ('badword') ON CONFLICT DO NOTHING;

-- ── word filter ──
SELECT pg_temp.check(public.contains_blocked_term('you BADWORD'), 'filter: matches regardless of case');
SELECT pg_temp.check(public.contains_blocked_term('b4dw0rd'), 'filter: folds common letter swaps (4->a, 0->o)');
SELECT pg_temp.check(NOT public.contains_blocked_term('a badwordless day'), 'filter: whole words only, not substrings');
SELECT pg_temp.check(pg_temp.as_user('00000000-0000-0000-0000-0000000000a1',
  $q$INSERT INTO public.feed_post_comments (post_id, user_id, content) VALUES ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a1','hey badword')$q$) = 'content_not_allowed',
  'filter: a comment with a blocked word is rejected by the database');
SELECT pg_temp.check(pg_temp.as_user('00000000-0000-0000-0000-0000000000a1',
  $q$INSERT INTO public.lobby_messages (user_id, content) VALUES ('00000000-0000-0000-0000-0000000000a1','badword')$q$) = 'content_not_allowed',
  'filter: chat is filtered too');
SELECT pg_temp.check(pg_temp.as_user('00000000-0000-0000-0000-0000000000a1',
  $q$INSERT INTO public.clubs (name) VALUES ('badword runners')$q$) = 'content_not_allowed', 'filter: club names are filtered');
SELECT pg_temp.check(pg_temp.as_user('00000000-0000-0000-0000-0000000000a1',
  $q$UPDATE public.profiles SET bio = 'badword' WHERE id = '00000000-0000-0000-0000-0000000000a1'$q$) = 'content_not_allowed', 'filter: a changed bio is filtered');
SELECT pg_temp.check(pg_temp.as_user('00000000-0000-0000-0000-0000000000a1',
  $q$INSERT INTO public.feed_post_comments (id, post_id, user_id, content) VALUES ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a1','nice run')$q$) IS NULL,
  'filter: a normal comment goes through');
SELECT pg_temp.check(pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'SELECT * FROM public.blocked_terms') LIKE 'permission denied%',
  'filter: clients cannot read the word list');

-- ── reporting and auto-hide ──
SELECT pg_temp.check(pg_temp.as_user('00000000-0000-0000-0000-0000000000b1',
  $q$SELECT public.report_content('comment','00000000-0000-0000-0000-0000000000c1','spam')$q$) IS NULL, 'report: a comment can be reported');
SELECT pg_temp.check(pg_temp.as_user('00000000-0000-0000-0000-0000000000b1',
  $q$SELECT public.report_content('comment','00000000-0000-0000-0000-0000000000c1','spam')$q$) IS NULL
  AND (SELECT count(*) FROM public.content_reports) = 1, 'report: reporting twice is a no-op');
SELECT pg_temp.check((SELECT count(*) FROM public.get_comments('00000000-0000-0000-0000-0000000000f1')) = 1, 'report: still visible after one report');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b2', $q$SELECT public.report_content('comment','00000000-0000-0000-0000-0000000000c1','abuse')$q$);
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b3', $q$SELECT public.report_content('comment','00000000-0000-0000-0000-0000000000c1','abuse')$q$);
SELECT pg_temp.check((SELECT count(*) FROM public.get_comments('00000000-0000-0000-0000-0000000000f1')) = 0, 'report: three different reporters hide the comment');
SELECT pg_temp.check(pg_temp.as_user('00000000-0000-0000-0000-0000000000b1',
  $q$SELECT public.report_content('comment','00000000-0000-0000-0000-0000000000ff','x')$q$) = 'not_found', 'report: unknown target is rejected');
SELECT pg_temp.check(pg_temp.as_user('00000000-0000-0000-0000-0000000000b1',
  $q$SELECT public.report_content('user','00000000-0000-0000-0000-0000000000c1','x')$q$) = 'bad_target_type', 'report: unknown type is rejected');
SELECT pg_temp.check(pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', 'SELECT * FROM public.content_reports') LIKE 'permission denied%',
  'report: clients cannot read reports');

-- ── bans ──
INSERT INTO public.user_bans (user_id, reason) VALUES ('00000000-0000-0000-0000-0000000000a1', 'test');
SELECT pg_temp.check(pg_temp.as_user('00000000-0000-0000-0000-0000000000a1',
  $q$INSERT INTO public.feed_post_comments (post_id, user_id, content) VALUES ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a1','hello')$q$) = 'account_suspended',
  'ban: a suspended runner cannot comment');
SELECT pg_temp.check(pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'DELETE FROM public.user_bans') LIKE 'permission denied%',
  'ban: a runner cannot lift their own ban');
SELECT pg_temp.check(pg_temp.as_user('00000000-0000-0000-0000-0000000000b2',
  $q$INSERT INTO public.feed_post_comments (post_id, user_id, content) VALUES ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000b2','hello')$q$) IS NULL,
  'ban: other runners are unaffected');
ROLLBACK;

-- Photos, "Don't count this" and club moderation (20261113000001).
-- Needs every migration applied; runs in a transaction and rolls back.
\set ON_ERROR_STOP on
BEGIN;

-- These runs stand in for runs the server has scored: in production
-- process-run-territory writes verified_distance_m (20261115000021).
CREATE FUNCTION pg_temp.as_scored() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.verified_distance_m := COALESCE(NEW.verified_distance_m, NEW.distance_m); RETURN NEW; END $$;
CREATE TRIGGER runs_z_test_scored BEFORE INSERT ON public.runs FOR EACH ROW EXECUTE FUNCTION pg_temp.as_scored();

CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('test.uid', u::text, true), set_config('test.role', 'authenticated', true) $$;
CREATE FUNCTION pg_temp.fails(sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN EXECUTE sql; RETURN false; EXCEPTION WHEN OTHERS THEN RETURN true; END $$;

SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('c1000000-0000-4000-8000-000000000001', 'pc-owner@example.com'),
  ('c2000000-0000-4000-8000-000000000002', 'pc-admin@example.com'),
  ('c3000000-0000-4000-8000-000000000003', 'pc-member@example.com'),
  ('c4000000-0000-4000-8000-000000000004', 'pc-troll@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES
  ('c1000000-0000-4000-8000-000000000001', 'pc_owner'),
  ('c2000000-0000-4000-8000-000000000002', 'pc_admin'),
  ('c3000000-0000-4000-8000-000000000003', 'pc_member'),
  ('c4000000-0000-4000-8000-000000000004', 'pc_troll')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;

-- ── Photos ──
INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace)
VALUES ('d1000000-0000-4000-8000-0000000000d1', 'c1000000-0000-4000-8000-000000000001', 'run',
        now() - interval '1 hour', now() - interval '30 minutes', 8000, 2400, '5:00');
INSERT INTO public.feed_posts (id, user_id, run_id, distance_km, post_type)
VALUES ('e1000000-0000-4000-8000-0000000000e1', 'c1000000-0000-4000-8000-000000000001',
        'd1000000-0000-4000-8000-0000000000d1', 8, 'run');

SELECT pg_temp.as_user('c1000000-0000-4000-8000-000000000001');
SELECT pg_temp.check(public.set_activity_photos('d1000000-0000-4000-8000-0000000000d1',
  ARRAY['c1000000-0000-4000-8000-000000000001/d1000000-0000-4000-8000-0000000000d1/a.jpg']), 'owner saves a photo');
SELECT pg_temp.check((SELECT cardinality(photo_paths) FROM public.feed_posts WHERE id = 'e1000000-0000-4000-8000-0000000000e1') = 1,
  'the post gets the photo too');
SELECT pg_temp.check((SELECT cardinality(photo_paths) FROM public.get_feed(20, NULL, false) WHERE id = 'e1000000-0000-4000-8000-0000000000e1') = 1,
  'get_feed returns photo_paths');
SELECT pg_temp.check(pg_temp.fails($q$SELECT public.set_activity_photos('d1000000-0000-4000-8000-0000000000d1',
  ARRAY['c3000000-0000-4000-8000-000000000003/x/a.jpg'])$q$), 'a path in someone else''s folder is refused');
SELECT pg_temp.check(pg_temp.fails($q$SELECT public.set_activity_photos('d1000000-0000-4000-8000-0000000000d1',
  ARRAY['c1000000-0000-4000-8000-000000000001/d1000000-0000-4000-8000-0000000000d1/../../c3/a.jpg'])$q$), 'a .. path is refused');
SELECT pg_temp.check(pg_temp.fails($q$SELECT public.set_activity_photos('d1000000-0000-4000-8000-0000000000d1',
  array_fill('c1000000-0000-4000-8000-000000000001/d1000000-0000-4000-8000-0000000000d1/a.jpg'::text, ARRAY[7]))$q$), 'more than 6 photos refused');
SELECT pg_temp.as_user('c3000000-0000-4000-8000-000000000003');
SELECT pg_temp.check(NOT public.set_activity_photos('d1000000-0000-4000-8000-0000000000d1',
  ARRAY['c3000000-0000-4000-8000-000000000003/d1000000-0000-4000-8000-0000000000d1/a.jpg']), 'someone else cannot set photos on your run');
SELECT pg_temp.check((SELECT cardinality(photo_paths) FROM public.runs WHERE id = 'd1000000-0000-4000-8000-0000000000d1') = 1, 'photos unchanged');

-- ── Don't count this ──
SELECT pg_temp.as_user('c1000000-0000-4000-8000-000000000001');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.leaderboard_values('distance', 'week') WHERE user_id = 'c1000000-0000-4000-8000-000000000001'),
  'the run counts on the leaderboard');
SELECT pg_temp.check(public.set_activity_excluded('d1000000-0000-4000-8000-0000000000d1', true), 'owner marks it don''t count');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.leaderboard_values('distance', 'week') WHERE user_id = 'c1000000-0000-4000-8000-000000000001'),
  'an excluded run leaves the leaderboard');
SELECT pg_temp.as_user('c3000000-0000-4000-8000-000000000003');
SELECT pg_temp.check(NOT public.set_activity_excluded('d1000000-0000-4000-8000-0000000000d1', false), 'someone else cannot un-exclude it');

-- ── Clubs ──
RESET test.uid;
INSERT INTO public.clubs (id, name, owner_id) VALUES ('aa000000-0000-4000-8000-0000000000aa', 'pc test club', 'c1000000-0000-4000-8000-000000000001');
INSERT INTO public.club_members (club_id, user_id, role) VALUES
  ('aa000000-0000-4000-8000-0000000000aa', 'c1000000-0000-4000-8000-000000000001', 'admin'),
  ('aa000000-0000-4000-8000-0000000000aa', 'c2000000-0000-4000-8000-000000000002', 'admin'),
  ('aa000000-0000-4000-8000-0000000000aa', 'c3000000-0000-4000-8000-000000000003', 'member'),
  ('aa000000-0000-4000-8000-0000000000aa', 'c4000000-0000-4000-8000-000000000004', 'member');
INSERT INTO public.lobbies (id, club_id, name, created_by) VALUES
  ('ac000000-0000-4000-8000-0000000000ac', 'aa000000-0000-4000-8000-0000000000aa', 'pc test club', 'c1000000-0000-4000-8000-000000000001');
INSERT INTO public.lobby_messages (id, lobby_id, user_id, content) VALUES
  ('ab000000-0000-4000-8000-0000000000ab', 'ac000000-0000-4000-8000-0000000000ac', 'c4000000-0000-4000-8000-000000000004', 'buy followers here'),
  ('ad000000-0000-4000-8000-0000000000ad', 'ac000000-0000-4000-8000-0000000000ac', 'c4000000-0000-4000-8000-000000000004', 'second spam');

SELECT pg_temp.as_user('c3000000-0000-4000-8000-000000000003');
SELECT public.report_club_message('ab000000-0000-4000-8000-0000000000ab', 'spam');
SELECT public.report_club_message('ab000000-0000-4000-8000-0000000000ab', 'spam');
SELECT pg_temp.check((SELECT count(*) FROM public.club_message_reports WHERE message_id = 'ab000000-0000-4000-8000-0000000000ab') = 1,
  'a member reports a message, once');
SELECT pg_temp.check(NOT public.is_club_moderator('aa000000-0000-4000-8000-0000000000aa', 'c3000000-0000-4000-8000-000000000003'),
  'a plain member cannot read reports (RLS rule)');
SELECT pg_temp.check(public.is_club_moderator('aa000000-0000-4000-8000-0000000000aa', 'c1000000-0000-4000-8000-000000000001'),
  'the owner is a moderator');
SELECT pg_temp.check(pg_temp.fails($q$SELECT * FROM public.get_club_reports('aa000000-0000-4000-8000-0000000000aa')$q$), 'nor list them');
SELECT pg_temp.check(pg_temp.fails($q$SELECT public.remove_club_member('aa000000-0000-4000-8000-0000000000aa','c4000000-0000-4000-8000-000000000004')$q$),
  'a plain member cannot remove anyone');
SELECT pg_temp.check(pg_temp.fails($q$SELECT public.delete_club_message('ab000000-0000-4000-8000-0000000000ab')$q$),
  'a plain member cannot delete someone else''s message');

SELECT pg_temp.as_user('c4000000-0000-4000-8000-000000000004');
SELECT pg_temp.check(pg_temp.fails($q$SELECT public.report_club_message('ab000000-0000-4000-8000-0000000000ab', 'spam')$q$), 'you cannot report your own message');

SELECT pg_temp.as_user('c2000000-0000-4000-8000-000000000002');
SELECT pg_temp.check((SELECT reports FROM public.get_club_reports('aa000000-0000-4000-8000-0000000000aa')) = 1, 'an admin sees the report');
SELECT pg_temp.check(public.delete_club_message('ad000000-0000-4000-8000-0000000000ad'), 'an admin deletes a message');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.lobby_messages WHERE id = 'ad000000-0000-4000-8000-0000000000ad'), 'and it is gone');
SELECT pg_temp.check(pg_temp.fails($q$SELECT public.remove_club_member('aa000000-0000-4000-8000-0000000000aa','c1000000-0000-4000-8000-000000000001')$q$),
  'an admin cannot remove the owner');
SELECT public.remove_club_member('aa000000-0000-4000-8000-0000000000aa', 'c4000000-0000-4000-8000-000000000004');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.club_members WHERE club_id = 'aa000000-0000-4000-8000-0000000000aa' AND user_id = 'c4000000-0000-4000-8000-000000000004'),
  'an admin removes a member');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.club_bans WHERE user_id = 'c4000000-0000-4000-8000-000000000004'), 'and the admin sees the bar');

SELECT pg_temp.as_user('c4000000-0000-4000-8000-000000000004');
SELECT pg_temp.check(pg_temp.fails($q$INSERT INTO public.club_members (club_id, user_id) VALUES ('aa000000-0000-4000-8000-0000000000aa','c4000000-0000-4000-8000-000000000004')$q$),
  'a removed runner cannot rejoin');
SELECT pg_temp.check(pg_temp.fails($q$INSERT INTO public.club_join_requests (club_id, user_id) VALUES ('aa000000-0000-4000-8000-0000000000aa','c4000000-0000-4000-8000-000000000004')$q$),
  'nor ask to join');

SELECT pg_temp.as_user('c1000000-0000-4000-8000-000000000001');
SELECT public.remove_club_member('aa000000-0000-4000-8000-0000000000aa', 'c2000000-0000-4000-8000-000000000002');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.club_members WHERE club_id = 'aa000000-0000-4000-8000-0000000000aa' AND user_id = 'c2000000-0000-4000-8000-000000000002'),
  'the owner can remove an admin');
SELECT public.unban_club_member('aa000000-0000-4000-8000-0000000000aa', 'c4000000-0000-4000-8000-000000000004');
SELECT pg_temp.as_user('c4000000-0000-4000-8000-000000000004');
INSERT INTO public.club_members (club_id, user_id) VALUES ('aa000000-0000-4000-8000-0000000000aa','c4000000-0000-4000-8000-000000000004');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.club_members WHERE club_id = 'aa000000-0000-4000-8000-0000000000aa' AND user_id = 'c4000000-0000-4000-8000-000000000004'),
  'after unbarring they can rejoin');

ROLLBACK;

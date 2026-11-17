-- Club pictures (20261117000010): only the club's owner/admins may write them.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('fc000000-0000-4000-8000-000000000001', 'picowner@example.com'),
  ('fc000000-0000-4000-8000-000000000002', 'picadmin@example.com'),
  ('fc000000-0000-4000-8000-000000000003', 'picstranger@example.com');
INSERT INTO public.clubs (id, name, owner_id) VALUES ('fc100000-0000-4000-8000-000000000001', 'Pic Club', 'fc000000-0000-4000-8000-000000000001');
INSERT INTO public.club_members (club_id, user_id, role) VALUES ('fc100000-0000-4000-8000-000000000001', 'fc000000-0000-4000-8000-000000000002', 'admin');

SET LOCAL test.uid = 'fc000000-0000-4000-8000-000000000001';
SELECT pg_temp.check(public.can_edit_club_media('fc100000-0000-4000-8000-000000000001/avatar.jpg'), 'owner can upload');
SET LOCAL test.uid = 'fc000000-0000-4000-8000-000000000002';
SELECT pg_temp.check(public.can_edit_club_media('fc100000-0000-4000-8000-000000000001/banner.jpg'), 'admin can upload');
SET LOCAL test.uid = 'fc000000-0000-4000-8000-000000000003';
SELECT pg_temp.check(NOT public.can_edit_club_media('fc100000-0000-4000-8000-000000000001/avatar.jpg'), 'others cannot');
SELECT pg_temp.check(NOT public.can_edit_club_media('not-a-club/avatar.jpg'), 'odd paths refused');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'club-media' AND public), 'bucket is public for viewing');
DO $$ BEGIN
  UPDATE public.clubs SET avatar_url = 'javascript:alert(1)' WHERE id = 'fc100000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'FAILED: non-https url accepted';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok  only https image urls';
END $$;
ROLLBACK;

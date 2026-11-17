-- Photo buckets can be listed only by their owner (migration 20261115000019). Run from the repo root.
-- Builds a stand-in for storage.objects with the original public policies, then applies the migration.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS storage;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated;
CREATE TABLE storage.objects (bucket_id text, name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON storage.objects TO anon, authenticated;
CREATE POLICY "avatars: public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "feed: public read"    ON storage.objects FOR SELECT USING (bucket_id = 'feed');
CREATE POLICY "stories_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'stories');
INSERT INTO storage.objects VALUES
  ('feed', '00000000-0000-0000-0000-0000000000a1/run1/x.jpg'),
  ('feed', '00000000-0000-0000-0000-0000000000b1/run2/y.jpg'),
  ('avatars', '00000000-0000-0000-0000-0000000000a1/me.jpg');
CREATE FUNCTION pg_temp.listed(role_name text, uid text) RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  PERFORM set_config('test.uid', uid, true);
  EXECUTE format('SET LOCAL ROLE %I', role_name);
  SELECT count(*) INTO n FROM storage.objects;
  RESET ROLE; RETURN n;
END $$;

SELECT pg_temp.check(pg_temp.listed('anon', '') = 3, 'before: a signed-out caller can list everything');
\i supabase/archive/migrations_2026/20261115000019_storage_no_public_listing.sql
SELECT pg_temp.check(pg_temp.listed('anon', '') = 0, 'after: a signed-out caller lists nothing');
SELECT pg_temp.check(pg_temp.listed('authenticated', '00000000-0000-0000-0000-0000000000a1') = 2, 'after: a runner lists only their own files');
SELECT pg_temp.check(pg_temp.listed('authenticated', '00000000-0000-0000-0000-0000000000b1') = 1, 'after: another runner sees only theirs');
ROLLBACK;

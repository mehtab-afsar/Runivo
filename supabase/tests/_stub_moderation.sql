-- Minimal stand-ins for the tables moderation.test.sql touches, so the test runs
-- without the whole schema (same approach as the other _stub_*.sql files).
-- Real columns are a superset of these; the migration only uses what is here.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.profiles (id uuid PRIMARY KEY, username text, avatar_color text, bio text, display_name text);
CREATE TABLE IF NOT EXISTS public.feed_posts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.profiles(id));
CREATE TABLE IF NOT EXISTS public.feed_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), post_id uuid REFERENCES public.feed_posts(id),
  user_id uuid REFERENCES public.profiles(id), content text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.clubs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text UNIQUE NOT NULL, description text, owner_id uuid);
CREATE TABLE IF NOT EXISTS public.events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text);
CREATE TABLE IF NOT EXISTS public.lobby_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.profiles(id), content text NOT NULL);
CREATE OR REPLACE FUNCTION public.is_blocked_between(a uuid, b uuid) RETURNS boolean LANGUAGE sql AS 'select false';
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;

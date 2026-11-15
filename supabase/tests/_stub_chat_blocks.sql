-- Minimal tables for chat_blocks.test.sql (same approach as the other _stub_*.sql files).
-- The "before" policy is the one from 20260710000109 so the test exercises the real change.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO authenticated;

CREATE TABLE IF NOT EXISTS public.lobbies (id uuid PRIMARY KEY, created_by uuid, club_id uuid);
CREATE TABLE IF NOT EXISTS public.club_members (club_id uuid, user_id uuid);
CREATE TABLE IF NOT EXISTS public.lobby_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lobby_id uuid, user_id uuid, content text);
CREATE TABLE IF NOT EXISTS public.user_blocks (blocker_id uuid, blocked_id uuid);
CREATE OR REPLACE FUNCTION public.is_blocked_between(a uuid, b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a IS NOT NULL AND b IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_blocks WHERE (blocker_id = a AND blocked_id = b) OR (blocker_id = b AND blocked_id = a));
$$;
ALTER TABLE public.lobby_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lobby_messages: participants can read" ON public.lobby_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.lobbies l WHERE l.id = lobby_messages.lobby_id AND (
    (l.created_by IS NULL AND l.club_id IS NULL) OR l.created_by = auth.uid()
    OR (l.club_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.club_members cm WHERE cm.club_id = l.club_id AND cm.user_id = auth.uid())))));
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

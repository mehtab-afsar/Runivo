-- ============================================================
-- Migration 020: Fix Realtime "column email does not exist"
-- ============================================================
-- Supabase Realtime's WAL decoder uses REPLICA IDENTITY to read
-- the before/after state of rows. With the default REPLICA IDENTITY
-- (primary key only), the decoder can fail with
-- "column X does not exist" when it tries to look up values not
-- captured in the WAL record.
--
-- REPLICA IDENTITY FULL tells Postgres to write all column values
-- to the WAL for every change — the Realtime engine can then
-- decode them without guessing the schema.
-- ============================================================

alter table public.territories       replica identity full;
alter table public.lobbies            replica identity full;
alter table public.lobby_messages     replica identity full;
alter table public.feed_posts         replica identity full;
alter table public.feed_post_comments replica identity full;
alter table public.club_messages      replica identity full;
alter table public.notifications      replica identity full;

-- ============================================================
-- C8: lobby chat schema mismatch — client used fabricated room ids
-- ============================================================
-- The lobbies/lobby_messages schema (20260301000006) and its membership RLS
-- (20260701000077) were built and are correct — the client just never
-- targeted a real lobbies.id. LobbyChatScreen used 5 hardcoded string ids
-- ('global','training',...) as if they were lobby_messages.room_id (a column
-- that never existed — the real column is lobby_id, a UUID FK to lobbies),
-- and ClubDetailScreen passed a fabricated `club_${clubId}` string that could
-- never match a UUID column at all. Every fetch errored, every send silently
-- failed, and the realtime filter could never match.
--
-- Fix: seed those 5 topic rooms as real public (club-less, creator-less)
-- lobbies rows with fixed ids the client can reference directly, and extend
-- the P0-5 membership policy so club-less/creator-less rows are readable and
-- postable by any authenticated user (they're intentionally public discovery
-- rooms, not private club lobbies). Per-club lobbies (ClubDetailScreen) are
-- created lazily by the client on first chat open — see the app-side fix.

ALTER TABLE public.lobbies ALTER COLUMN created_by DROP NOT NULL;

INSERT INTO public.lobbies (id, name, status, created_by, club_id) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Global Runners',    'open', NULL, NULL),
  ('00000000-0000-0000-0000-000000000002', 'Training Talk',     'open', NULL, NULL),
  ('00000000-0000-0000-0000-000000000003', 'Race Reports',      'open', NULL, NULL),
  ('00000000-0000-0000-0000-000000000004', 'Speed & Intervals', 'open', NULL, NULL),
  ('00000000-0000-0000-0000-000000000005', 'Night Runners',     'open', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "lobby_messages: participants can read" ON public.lobby_messages;
CREATE POLICY "lobby_messages: participants can read"
  ON public.lobby_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lobbies l
      WHERE l.id = lobby_messages.lobby_id
        AND (
          (l.created_by IS NULL AND l.club_id IS NULL) -- public discovery rooms
          OR l.created_by = auth.uid()
          OR (
            l.club_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.club_members cm
              WHERE cm.club_id = l.club_id AND cm.user_id = auth.uid()
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "lobby_messages: participants can send" ON public.lobby_messages;
CREATE POLICY "lobby_messages: participants can send"
  ON public.lobby_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.lobbies l
      WHERE l.id = lobby_messages.lobby_id
        AND (
          (l.created_by IS NULL AND l.club_id IS NULL)
          OR l.created_by = auth.uid()
          OR (
            l.club_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.club_members cm
              WHERE cm.club_id = l.club_id AND cm.user_id = auth.uid()
            )
          )
        )
    )
  );

-- Club members can also read/create their club's lobby (previously only the
-- creator could, via "lobbies: anyone can read" — that policy already allows
-- reads; INSERT was creator-only, which blocks the lazy-create-on-first-open
-- flow for any member other than whoever happens to create it first). Any
-- club member may create the club's lobby row if one doesn't exist yet.
DROP POLICY IF EXISTS "lobbies: authenticated can create" ON public.lobbies;
CREATE POLICY "lobbies: authenticated can create"
  ON public.lobbies FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND (
      club_id IS NULL
      OR EXISTS (SELECT 1 FROM public.club_members cm WHERE cm.club_id = lobbies.club_id AND cm.user_id = auth.uid())
    )
  );

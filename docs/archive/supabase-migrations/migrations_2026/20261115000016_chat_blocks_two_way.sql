-- ============================================================
-- Blocking now holds in club and lobby chat, in both directions.
--
-- Blocking was enforced for the feed, comments, profiles and leaderboards, but
-- chat only hid the blocked runner on the blocker's own screen (a client-side
-- filter in useLobbyChat). The blocked runner could still read the blocker's
-- messages, and anyone using a modified app could read the blocked runner's.
--
-- lobby_messages' read policy now also requires that there is no block between
-- the reader and the author. Realtime (postgres_changes) applies the same read
-- policy, so live delivery follows it too. Everything else about who may read a
-- room is unchanged from 20260710000109_lobby_public_rooms.sql.
-- ============================================================

GRANT EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "lobby_messages: participants can read" ON public.lobby_messages;
CREATE POLICY "lobby_messages: participants can read"
  ON public.lobby_messages FOR SELECT
  USING (
    NOT public.is_blocked_between(auth.uid(), lobby_messages.user_id)
    AND EXISTS (
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

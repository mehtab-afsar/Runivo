-- ============================================================
-- P0-4 + P0-5: Close notification-phishing and open lobby chat
-- ============================================================

-- ── P0-4: notifications INSERT ──────────────────────────────
-- The INSERT policy was `with check (true)` (20260301000009_runs.sql:72) despite
-- being named "service role can insert" — so any authenticated client could insert
-- a notification (with a clickable action_url) addressed to ANY user: a phishing
-- vector. Notifications are created server-side by edge functions using the
-- service-role key, which bypasses RLS, so restricting the policy to
-- `auth.uid() = user_id` breaks nothing legitimate (the client only ever reads /
-- marks-read notifications, never inserts) while making it impossible to target
-- another user.
DROP POLICY IF EXISTS "notifications: service role can insert" ON public.notifications;

CREATE POLICY "notifications: self or service role insert"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── P0-5: lobby_messages membership scoping ─────────────────
-- Both policies were world-open: SELECT `using (true)` and INSERT checking only the
-- sender id (20260301000006_notifications.sql:53-56), and lobby_messages is in the
-- realtime publication — so anyone could read or post into any lobby without being a
-- member. There is no lobby_members table; a lobby's participants are the members of
-- its club (lobbies.club_id) plus the lobby creator. Scope read+write to that set,
-- mirroring the club_messages pattern (20260301000012_club_chat.sql). Club-less
-- lobbies (club_id IS NULL) are restricted to their creator — the safest default for
-- a feature that is FEATURES-flagged off in v1 anyway.
DROP POLICY IF EXISTS "lobby_messages: anyone can read"      ON public.lobby_messages;
DROP POLICY IF EXISTS "lobby_messages: authenticated can send" ON public.lobby_messages;

CREATE POLICY "lobby_messages: participants can read"
  ON public.lobby_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lobbies l
      WHERE l.id = lobby_messages.lobby_id
        AND (
          l.created_by = auth.uid()
          OR (
            l.club_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.club_members cm
              WHERE cm.club_id = l.club_id AND cm.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "lobby_messages: participants can send"
  ON public.lobby_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.lobbies l
      WHERE l.id = lobby_messages.lobby_id
        AND (
          l.created_by = auth.uid()
          OR (
            l.club_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.club_members cm
              WHERE cm.club_id = l.club_id AND cm.user_id = auth.uid()
            )
          )
        )
    )
  );

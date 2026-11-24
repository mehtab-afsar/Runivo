-- Club chat: members only, one room per club.
--
-- 1. The lobby_messages policies let a lobby's creator read and post in it
--    whatever else was true. A club's room is created by whichever member
--    opens the chat first, so that person kept access after leaving the club
--    or being removed or banned. For club rooms, only current membership counts
--    now; the creator rule stays for non-club lobbies.
-- 2. Nothing stopped two members opening the chat at the same moment from
--    creating two rooms for one club, splitting the conversation. Duplicate
--    rooms are merged into the oldest and a unique index prevents new ones.

-- Merge duplicate club rooms into the oldest.
WITH ranked AS (
  SELECT id, club_id, first_value(id) OVER (PARTITION BY club_id ORDER BY created_at, id) AS keep
    FROM public.lobbies WHERE club_id IS NOT NULL
)
UPDATE public.lobby_messages m SET lobby_id = r.keep
  FROM ranked r WHERE m.lobby_id = r.id AND r.id <> r.keep;
WITH ranked AS (
  SELECT id, first_value(id) OVER (PARTITION BY club_id ORDER BY created_at, id) AS keep
    FROM public.lobbies WHERE club_id IS NOT NULL
)
DELETE FROM public.lobbies l USING ranked r WHERE l.id = r.id AND r.id <> r.keep;
CREATE UNIQUE INDEX IF NOT EXISTS lobbies_one_per_club ON public.lobbies (club_id) WHERE club_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.can_use_lobby(p_lobby uuid, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM lobbies l
     WHERE l.id = p_lobby
       AND CASE
             WHEN l.club_id IS NOT NULL THEN EXISTS (SELECT 1 FROM club_members cm WHERE cm.club_id = l.club_id AND cm.user_id = p_user)
             ELSE l.created_by IS NULL OR l.created_by = p_user
           END
  );
$$;
REVOKE ALL ON FUNCTION public.can_use_lobby(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_lobby(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "lobby_messages: participants can read" ON public.lobby_messages;
CREATE POLICY "lobby_messages: participants can read" ON public.lobby_messages FOR SELECT
  USING (NOT public.is_blocked_between(auth.uid(), user_id) AND public.can_use_lobby(lobby_id, auth.uid()));

DROP POLICY IF EXISTS "lobby_messages: participants can send" ON public.lobby_messages;
CREATE POLICY "lobby_messages: participants can send" ON public.lobby_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.can_use_lobby(lobby_id, auth.uid()));

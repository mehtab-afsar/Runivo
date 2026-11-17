-- Deleting a club (owner only, from the club's Admin tab).
--
-- A plain DELETE on clubs left the club's chat lobby and its scheduled club
-- runs behind with club_id set to NULL: the runs then showed up as ordinary
-- public events and the chat lived on with no club. This removes them with the
-- club, tells the members, and refuses anyone but the owner.
-- Past club runs that people finished are kept (their finishers and PACE stay
-- valid); only the link to the club goes.

CREATE OR REPLACE FUNCTION public.delete_club(p_club_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me    uuid := auth.uid();
  v_owner uuid;
  v_name  text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT owner_id, name INTO v_owner, v_name FROM clubs WHERE id = p_club_id FOR UPDATE;
  IF v_owner IS NULL THEN RETURN 'not_found'; END IF;
  IF v_owner <> v_me THEN RETURN 'not_owner'; END IF;

  INSERT INTO notifications (user_id, type, title, body, action_url, dedupe_key)
  SELECT m.user_id, 'system', v_name || ' was closed', 'The club owner deleted the club.', '/clubs',
         'club_deleted:' || p_club_id::text || ':' || m.user_id::text
    FROM club_members m
   WHERE m.club_id = p_club_id AND m.user_id <> v_me
  ON CONFLICT DO NOTHING;

  -- Club runs that haven't happened, and the club chat, go with the club.
  DELETE FROM events  WHERE club_id = p_club_id AND starts_at > now()
    AND NOT EXISTS (SELECT 1 FROM event_finishers f WHERE f.event_id = events.id);
  DELETE FROM lobbies WHERE club_id = p_club_id;
  DELETE FROM clubs   WHERE id = p_club_id;   -- members, messages, requests, bans cascade
  RETURN 'deleted';
END;
$$;
REVOKE ALL ON FUNCTION public.delete_club(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_club(uuid) TO authenticated;

-- The owner leaving without deleting: a readable answer instead of the
-- trigger's exception text (used by the club page's Leave button).
CREATE OR REPLACE FUNCTION public.leave_club(p_club_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF EXISTS (SELECT 1 FROM clubs WHERE id = p_club_id AND owner_id = v_me) THEN RETURN 'owner'; END IF;
  DELETE FROM club_members WHERE club_id = p_club_id AND user_id = v_me;
  RETURN CASE WHEN FOUND THEN 'left' ELSE 'not_member' END;
END;
$$;
REVOKE ALL ON FUNCTION public.leave_club(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_club(uuid) TO authenticated;

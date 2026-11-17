-- Who posted an event, and cancelling it.
--
-- events had no creator column: a runner who posted an event could never edit
-- or cancel it (only admins could delete), and a club admin couldn't cancel a
-- club run. created_by is filled from the signed-in user on insert (the app's
-- insert and the SECURITY DEFINER club-event functions both run as that user).
-- cancel_event lets the poster, or an owner/admin of the event's club, cancel
-- an event that hasn't started; everyone who said they're going is told.

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.events ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Never trust a client-supplied creator.
CREATE OR REPLACE FUNCTION public.events_set_creator()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS events_set_creator ON public.events;
CREATE TRIGGER events_set_creator BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_set_creator();

CREATE OR REPLACE FUNCTION public.can_manage_event(p_event uuid, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM events e
     WHERE e.id = p_event
       AND (e.created_by = p_user
         OR (e.club_id IS NOT NULL AND (
               EXISTS (SELECT 1 FROM clubs c WHERE c.id = e.club_id AND c.owner_id = p_user)
            OR EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = e.club_id AND m.user_id = p_user AND m.role IN ('owner', 'admin')))))
  );
$$;
REVOKE ALL ON FUNCTION public.can_manage_event(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_event(uuid, uuid) TO authenticated;

/** Returns cancelled, not_allowed, started or not_found. */
CREATE OR REPLACE FUNCTION public.cancel_event(p_event uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me uuid := auth.uid();
  ev   events%ROWTYPE;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT * INTO ev FROM events WHERE id = p_event FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF NOT public.can_manage_event(p_event, v_me) THEN RETURN 'not_allowed'; END IF;
  IF ev.starts_at <= now() THEN RETURN 'started'; END IF;

  INSERT INTO notifications (user_id, type, title, body, action_url, dedupe_key)
  SELECT p.user_id, 'event_reminder', ev.title || ' is cancelled',
         'The organiser cancelled it.',
         '/events', 'event_cancelled:' || ev.id::text || ':' || p.user_id::text
    FROM event_participants p
   WHERE p.event_id = ev.id AND p.user_id <> v_me
  ON CONFLICT DO NOTHING;

  DELETE FROM events WHERE id = ev.id;   -- participants and bookmarks cascade
  RETURN 'cancelled';
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_event(uuid) TO authenticated;

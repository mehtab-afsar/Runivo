-- Events batch:
--   E5  bookmarks saved on the server
--   E3  hosted events: pace groups, a route (events.route_points, from C1), and live arrival check-in
--   E4  event result: everyone who ran in the window near the start, with a finisher badge
--   E6  territory events: a club's hour over an area, double PACE for zones claimed there

-- ── E5 ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_bookmarks (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);
ALTER TABLE public.event_bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS eb_own ON public.event_bookmarks;
CREATE POLICY eb_own ON public.event_bookmarks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── E3 ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS pace_groups text[];
ALTER TABLE public.event_participants
  ADD COLUMN IF NOT EXISTS pace_group text,
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_event_pace_group(p_event uuid, p_group text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE event_participants SET pace_group = NULLIF(trim(p_group), '')
   WHERE event_id = p_event AND user_id = auth.uid()
     AND (p_group IS NULL OR p_group = ANY (COALESCE((SELECT pace_groups FROM events WHERE id = p_event), ARRAY[]::text[])));
$$;

-- Check in on arrival: within 300 m of the start, from an hour before to the end.
CREATE OR REPLACE FUNCTION public.check_in_event(p_event uuid, p_lat float8, p_lng float8)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e events%ROWTYPE;
BEGIN
  SELECT * INTO e FROM events WHERE id = p_event;
  IF NOT FOUND OR e.lat IS NULL THEN RETURN false; END IF;
  IF now() < e.starts_at - interval '1 hour' OR now() > COALESCE(e.ends_at, e.starts_at + interval '4 hours') THEN RETURN false; END IF;
  IF ST_Distance(ST_MakePoint(p_lng, p_lat)::geography, ST_MakePoint(e.lng::float8, e.lat::float8)::geography) > 300 THEN RETURN false; END IF;
  UPDATE event_participants SET arrived_at = COALESCE(arrived_at, now()) WHERE event_id = p_event AND user_id = auth.uid();
  RETURN FOUND;
END;
$$;

-- Who's going, by pace group, and who has arrived.
CREATE OR REPLACE FUNCTION public.event_attendees(p_event uuid)
RETURNS TABLE (user_id uuid, username text, avatar_color text, pace_group text, arrived boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ep.user_id, p.username, p.avatar_color, ep.pace_group, ep.arrived_at IS NOT NULL
    FROM event_participants ep JOIN profiles p ON p.id = ep.user_id
   WHERE ep.event_id = p_event
     AND auth.uid() IS NOT NULL
     AND ep.user_id NOT IN (SELECT hidden_user_ids(auth.uid()))
   ORDER BY ep.arrived_at NULLS LAST, p.username
   LIMIT 200;
$$;

-- ── E4 ──────────────────────────────────────────────────────────────────────
-- Runs that started in the event window within 1 km of its start point.
CREATE OR REPLACE FUNCTION public.event_result(p_event uuid)
RETURNS TABLE (user_id uuid, username text, avatar_color text, distance_km numeric, duration_sec int, is_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH e AS (
    SELECT * FROM events WHERE id = p_event AND lat IS NOT NULL AND starts_at < now()
  )
  SELECT DISTINCT ON (r.user_id) r.user_id, p.username, p.avatar_color,
         round(r.distance_m / 1000.0, 2), r.duration_sec, r.user_id = auth.uid()
    FROM e
    JOIN runs r ON r.started_at BETWEEN e.starts_at - interval '45 minutes' AND COALESCE(e.ends_at, e.starts_at + interval '4 hours')
               AND jsonb_array_length(COALESCE(r.gps_points, '[]'::jsonb)) > 0
               AND NOT COALESCE(r.excluded, false)
    JOIN profiles p ON p.id = r.user_id
   WHERE ST_DWithin(
           ST_MakePoint((r.gps_points->0->>'lng')::float8, (r.gps_points->0->>'lat')::float8)::geography,
           ST_MakePoint(e.lng::float8, e.lat::float8)::geography, 1000)
     AND r.user_id NOT IN (SELECT hidden_user_ids(auth.uid()))
     AND (NOT p.hide_from_leaderboards OR r.user_id = auth.uid())
   ORDER BY r.user_id, r.distance_m DESC;
$$;

-- The finisher badge: any runner in the result can claim it once per event.
CREATE TABLE IF NOT EXISTS public.event_finishers (
  event_id  uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
ALTER TABLE public.event_finishers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ef_read ON public.event_finishers;
CREATE POLICY ef_read ON public.event_finishers FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.claim_event_finish(p_event uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM event_result(p_event) WHERE is_me) THEN RETURN false; END IF;
  INSERT INTO event_finishers (event_id, user_id) VALUES (p_event, auth.uid()) ON CONFLICT DO NOTHING;
  INSERT INTO user_awards (user_id, award_id) VALUES (auth.uid(), 'event_finisher') ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

-- ── E6 ──────────────────────────────────────────────────────────────────────
-- event_type 'territory-war' + club_id + location + radius: zones claimed in that
-- area during the hour earn double zone PACE for the club's members.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS radius_m int CHECK (radius_m IS NULL OR radius_m BETWEEN 200 AND 5000);

CREATE OR REPLACE FUNCTION public.territory_event_multiplier(p_user uuid, p_at timestamptz, p_lat float8, p_lng float8)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM events e
     WHERE e.event_type = 'territory-war' AND e.is_active
       AND p_at BETWEEN e.starts_at AND COALESCE(e.ends_at, e.starts_at + interval '1 hour')
       AND e.lat IS NOT NULL
       AND ST_DWithin(ST_MakePoint(p_lng, p_lat)::geography, ST_MakePoint(e.lng::float8, e.lat::float8)::geography, COALESCE(e.radius_m, 1000))
       AND (e.club_id IS NULL OR EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = e.club_id AND m.user_id = p_user))
  ) THEN 2 ELSE 1 END;
$$;

-- Club owners and admins schedule one.
CREATE OR REPLACE FUNCTION public.create_territory_event(p_club uuid, p_title text, p_starts_at timestamptz, p_minutes int, p_lat float8, p_lng float8, p_radius_m int, p_place text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT is_club_moderator(p_club, auth.uid()) THEN RAISE EXCEPTION 'only club owners and admins can do this'; END IF;
  IF p_minutes NOT BETWEEN 30 AND 180 THEN RAISE EXCEPTION 'between 30 minutes and 3 hours'; END IF;
  IF p_starts_at < now() - interval '5 minutes' THEN RAISE EXCEPTION 'pick a time in the future'; END IF;
  INSERT INTO events (title, description, event_type, starts_at, ends_at, lat, lng, location, location_name, radius_m, club_id, source, is_active, organizer)
  VALUES (trim(p_title), 'Zones claimed inside the area during the event earn double PACE for club members.', 'territory-war',
          p_starts_at, p_starts_at + make_interval(mins => p_minutes), p_lat, p_lng,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326), p_place, p_radius_m, p_club, 'hosted', true,
          (SELECT name FROM clubs WHERE id = p_club))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_event_pace_group(uuid, text), public.check_in_event(uuid, float8, float8), public.event_attendees(uuid),
  public.event_result(uuid), public.claim_event_finish(uuid), public.territory_event_multiplier(uuid, timestamptz, float8, float8),
  public.create_territory_event(uuid, text, timestamptz, int, float8, float8, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_event_pace_group(uuid, text), public.check_in_event(uuid, float8, float8), public.event_attendees(uuid),
  public.event_result(uuid), public.claim_event_finish(uuid),
  public.create_territory_event(uuid, text, timestamptz, int, float8, float8, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.territory_event_multiplier(uuid, timestamptz, float8, float8) TO service_role;

-- Territory-event bonus PACE is its own ledger line, paid once per run.
ALTER TABLE public.pace_awards DROP CONSTRAINT IF EXISTS pace_awards_source_check;
ALTER TABLE public.pace_awards ADD CONSTRAINT pace_awards_source_check
  CHECK (source = ANY (ARRAY['run', 'mission', 'campaign', 'adjustment', 'territory_event']));

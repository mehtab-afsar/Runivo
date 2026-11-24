-- ============================================================
-- Routes for club runs (PRD C1): the host can attach a route (from their
-- saved routes) that members see and follow. Up to 1,500 points.
-- ============================================================

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS route_points jsonb;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_route_points_size;
ALTER TABLE public.events ADD CONSTRAINT events_route_points_size
  CHECK (route_points IS NULL OR (jsonb_typeof(route_points) = 'array' AND jsonb_array_length(route_points) <= 1500));

DROP FUNCTION IF EXISTS public.create_club_event(uuid, text, timestamptz, text, integer, text, integer, numeric, numeric);
CREATE FUNCTION public.create_club_event(
  p_club_id     uuid,
  p_title       text,
  p_starts_at   timestamptz,
  p_location    text,
  p_distance_m  integer DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_weeks       integer DEFAULT 1,
  p_lat         numeric DEFAULT NULL,
  p_lng         numeric DEFAULT NULL,
  p_route       jsonb DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_n integer := LEAST(GREATEST(COALESCE(p_weeks, 1), 1), 12); i integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_club_moderator(p_club_id, auth.uid()) THEN
    RAISE EXCEPTION 'only club owners and admins can schedule club runs' USING ERRCODE = '42501';
  END IF;
  IF length(trim(COALESCE(p_title, ''))) < 3 THEN RAISE EXCEPTION 'add a title' USING ERRCODE = '22023'; END IF;
  IF p_starts_at < now() THEN RAISE EXCEPTION 'pick a time in the future' USING ERRCODE = '22023'; END IF;
  IF p_route IS NOT NULL AND (jsonb_typeof(p_route) <> 'array' OR jsonb_array_length(p_route) < 2) THEN
    RAISE EXCEPTION 'a route needs at least two points' USING ERRCODE = '22023';
  END IF;
  FOR i IN 0 .. v_n - 1 LOOP
    INSERT INTO public.events (title, description, event_type, starts_at, ends_at, location_name, distance_m,
                               is_active, participant_count, source, club_id, discipline, lat, lng, route_points)
    VALUES (trim(p_title), NULLIF(trim(COALESCE(p_description, '')), ''), 'community-run',
            p_starts_at + (i * interval '7 days'), p_starts_at + (i * interval '7 days') + interval '2 hours',
            NULLIF(trim(COALESCE(p_location, '')), ''), p_distance_m, true, 0, 'hosted', p_club_id, 'community_run', p_lat, p_lng, p_route);
  END LOOP;
  RETURN v_n;
END;
$$;

DROP FUNCTION IF EXISTS public.get_club_events(uuid);
CREATE FUNCTION public.get_club_events(p_club_id uuid)
RETURNS TABLE(id uuid, title text, description text, starts_at timestamptz, location_name text, distance_m integer,
              participant_count integer, going boolean, route_points jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, e.title, e.description, e.starts_at, e.location_name, e.distance_m, e.participant_count,
         EXISTS (SELECT 1 FROM public.event_participants ep WHERE ep.event_id = e.id AND ep.user_id = auth.uid()),
         e.route_points
    FROM public.events e
   WHERE e.club_id = p_club_id AND e.is_active AND e.ends_at > now()
   ORDER BY e.starts_at
   LIMIT 30;
$$;

GRANT EXECUTE ON FUNCTION public.create_club_event(uuid, text, timestamptz, text, integer, text, integer, numeric, numeric, jsonb),
  public.get_club_events(uuid) TO authenticated;

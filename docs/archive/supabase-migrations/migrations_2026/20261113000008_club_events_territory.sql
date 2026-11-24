-- ============================================================
-- Club events (PRD C1) and club territory (PRD C2)
-- ============================================================
-- C1: club owners and admins schedule group runs for their club (no Plus
--     needed: the club is the host). Optionally weekly for up to 12 weeks.
--     They are ordinary hosted events with club_id, so RSVP is unchanged.
-- C2: a club's territory is every zone its members hold; the score is
--     the total area. Clubs are ranked by it.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_club_event(
  p_club_id     uuid,
  p_title       text,
  p_starts_at   timestamptz,
  p_location    text,
  p_distance_m  integer DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_weeks       integer DEFAULT 1,
  p_lat         numeric DEFAULT NULL,
  p_lng         numeric DEFAULT NULL
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
  FOR i IN 0 .. v_n - 1 LOOP
    INSERT INTO public.events (title, description, event_type, starts_at, ends_at, location_name, distance_m,
                               is_active, participant_count, source, club_id, discipline, lat, lng)
    VALUES (trim(p_title), NULLIF(trim(COALESCE(p_description, '')), ''), 'community-run',
            p_starts_at + (i * interval '7 days'), p_starts_at + (i * interval '7 days') + interval '2 hours',
            NULLIF(trim(COALESCE(p_location, '')), ''), p_distance_m, true, 0, 'hosted', p_club_id, 'community_run', p_lat, p_lng);
  END LOOP;
  RETURN v_n;
END;
$$;

-- Upcoming club runs with whether you're going.
CREATE OR REPLACE FUNCTION public.get_club_events(p_club_id uuid)
RETURNS TABLE(id uuid, title text, description text, starts_at timestamptz, location_name text, distance_m integer, participant_count integer, going boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, e.title, e.description, e.starts_at, e.location_name, e.distance_m, e.participant_count,
         EXISTS (SELECT 1 FROM public.event_participants ep WHERE ep.event_id = e.id AND ep.user_id = auth.uid())
    FROM public.events e
   WHERE e.club_id = p_club_id AND e.is_active AND e.ends_at > now()
   ORDER BY e.starts_at
   LIMIT 30;
$$;

-- Every zone the club's members hold.
CREATE OR REPLACE FUNCTION public.get_club_territory(p_club_id uuid)
RETURNS TABLE(id uuid, owner_id uuid, owner_name text, polygon_coords jsonb, area_m2 double precision, freshness smallint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.owner_id, p.username, t.polygon_coords, t.area_m2, t.freshness
    FROM public.territory_polygons t
    JOIN public.club_members m ON m.user_id = t.owner_id AND m.club_id = p_club_id
    JOIN public.profiles p ON p.id = t.owner_id
   LIMIT 2000;
$$;

-- Clubs ranked by the area their members hold.
CREATE OR REPLACE FUNCTION public.get_club_territory_board(p_limit integer DEFAULT 50)
RETURNS TABLE(club_id uuid, name text, badge_emoji text, members integer, zones integer, area_m2 double precision, rank integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH c AS (
    SELECT cl.id, cl.name, cl.badge_emoji, cl.member_count,
           count(t.id)::int AS zones, COALESCE(sum(t.area_m2), 0) AS area
      FROM public.clubs cl
      JOIN public.club_members m ON m.club_id = cl.id
      LEFT JOIN public.territory_polygons t ON t.owner_id = m.user_id
     GROUP BY cl.id
  )
  SELECT id, name, badge_emoji, member_count, zones, area, (rank() OVER (ORDER BY area DESC))::int
    FROM c WHERE area > 0
   ORDER BY area DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$$;

GRANT EXECUTE ON FUNCTION public.create_club_event(uuid, text, timestamptz, text, integer, text, integer, numeric, numeric),
  public.get_club_events(uuid), public.get_club_territory(uuid), public.get_club_territory_board(integer) TO authenticated;

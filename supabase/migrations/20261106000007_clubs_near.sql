-- ============================================================================
-- Clubs near you.
--
-- Onboarding's "Find your people" and the Clubs tab only showed the most
-- popular clubs worldwide. Clubs now have an approximate home point and
-- clubs_near() lists the closest ones.
--
-- Privacy: a club's default point comes from its creator's last known
-- location, which is close to where they live (see
-- 20260723000001_profiles_pii_lockdown.sql). So:
--   * it lives in its own table, club_locations, with RLS on and no policies:
--     no client can select it, not even with select=* on clubs;
--   * it is snapped to a ~100 m grid before it is stored;
--   * clubs_near() returns distance rounded to 0.1 km and never coordinates;
--   * the club owner can move the point to a public meeting spot
--     (set_club_location), which also replaces the creator-derived one.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.club_locations (
  club_id       uuid        PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
  home_location geography(Point, 4326) NOT NULL,
  city          text,
  source        text        NOT NULL DEFAULT 'creator' CHECK (source IN ('creator', 'owner_set')),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS club_locations_geo_idx ON public.club_locations USING GIST (home_location);
ALTER TABLE public.club_locations ENABLE ROW LEVEL SECURITY;
-- No policies: read only through clubs_near() below.
REVOKE ALL ON public.club_locations FROM anon, authenticated;

-- Snap to a 0.001° grid (~110 m north-south, less east-west away from the equator).
CREATE OR REPLACE FUNCTION public.approx_point(p_lat float8, p_lng float8)
RETURNS geography LANGUAGE sql IMMUTABLE AS $$
  SELECT ST_SetSRID(ST_MakePoint(round(p_lng::numeric, 3)::float8, round(p_lat::numeric, 3)::float8), 4326)::geography;
$$;

-- New clubs start at the creator's approximate location, if we have one.
CREATE OR REPLACE FUNCTION public.club_default_location()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_loc geometry;
BEGIN
  SELECT last_known_location INTO v_loc FROM profiles WHERE id = NEW.owner_id;
  IF v_loc IS NOT NULL THEN
    INSERT INTO club_locations (club_id, home_location, source)
    VALUES (NEW.id, approx_point(ST_Y(v_loc), ST_X(v_loc)), 'creator')
    ON CONFLICT (club_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_club_default_location ON public.clubs;
CREATE TRIGGER trg_club_default_location
  AFTER INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.club_default_location();

-- Backfill existing clubs from their owners.
INSERT INTO public.club_locations (club_id, home_location, source)
SELECT c.id, public.approx_point(ST_Y(p.last_known_location), ST_X(p.last_known_location)), 'creator'
  FROM public.clubs c
  JOIN public.profiles p ON p.id = c.owner_id
 WHERE p.last_known_location IS NOT NULL
ON CONFLICT (club_id) DO NOTHING;

-- Owner moves the club to a public meeting point (a park gate, a café).
CREATE OR REPLACE FUNCTION public.set_club_location(p_club_id uuid, p_lat float8, p_lng float8, p_city text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM clubs WHERE id = p_club_id AND owner_id = auth.uid()) THEN
    RETURN false;
  END IF;
  INSERT INTO club_locations (club_id, home_location, city, source, updated_at)
  VALUES (p_club_id, approx_point(p_lat, p_lng), left(NULLIF(trim(p_city), ''), 80), 'owner_set', now())
  ON CONFLICT (club_id) DO UPDATE
    SET home_location = EXCLUDED.home_location,
        city          = COALESCE(EXCLUDED.city, club_locations.city),
        source        = 'owner_set',
        updated_at    = now();
  RETURN true;
END;
$$;

-- Closest clubs to a point; the most popular clubs when there's no point or
-- nothing within the radius (nearby = false on those rows).
-- SECURITY DEFINER only to read club_locations; it returns nothing a caller
-- can't already see on clubs except a rounded distance.
CREATE OR REPLACE FUNCTION public.clubs_near(
  p_lat       float8,
  p_lng       float8,
  p_radius_km float8 DEFAULT 15,
  p_limit     int    DEFAULT 20
)
RETURNS TABLE (
  id           uuid,
  name         text,
  description  text,
  badge_emoji  text,
  join_policy  text,
  member_count int,
  total_km     numeric,
  city         text,
  distance_km  numeric,
  nearby       boolean,
  joined       boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_radius_m float8 := LEAST(GREATEST(COALESCE(p_radius_km, 15), 1), 50) * 1000;
  v_limit    int    := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_me       uuid   := auth.uid();
  v_point    geography;
BEGIN
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL
     AND p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180 THEN
    v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

    RETURN QUERY
      SELECT c.id, c.name, c.description, c.badge_emoji, c.join_policy, c.member_count, c.total_km,
             l.city,
             round((ST_Distance(l.home_location, v_point) / 1000.0)::numeric, 1),
             true,
             EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = c.id AND m.user_id = v_me)
        FROM clubs c
        JOIN club_locations l ON l.club_id = c.id
       WHERE ST_DWithin(l.home_location, v_point, v_radius_m)
       ORDER BY ST_Distance(l.home_location, v_point), c.member_count DESC
       LIMIT v_limit;
    IF FOUND THEN RETURN; END IF;
  END IF;

  RETURN QUERY
    SELECT c.id, c.name, c.description, c.badge_emoji, c.join_policy, c.member_count, c.total_km,
           l.city, NULL::numeric, false,
           EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = c.id AND m.user_id = v_me)
      FROM clubs c
      LEFT JOIN club_locations l ON l.club_id = c.id
     ORDER BY c.member_count DESC, c.created_at
     LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.clubs_near(float8, float8, float8, int)            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_club_location(uuid, float8, float8, text)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.club_default_location()                            FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clubs_near(float8, float8, float8, int)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_club_location(uuid, float8, float8, text)   TO authenticated;

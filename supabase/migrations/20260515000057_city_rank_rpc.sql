ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_known_location GEOMETRY(Point, 4326);

CREATE INDEX IF NOT EXISTS profiles_location_idx
  ON profiles USING GIST (last_known_location);

CREATE OR REPLACE FUNCTION get_city_rank(
  p_user_id   UUID,
  p_lat       DOUBLE PRECISION,
  p_lng       DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 10
)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COUNT(*)::INTEGER + 1
  FROM (
    SELECT t.owner_id, SUM(t.area_m2) AS total_area
    FROM territory_polygons t
    JOIN profiles p ON p.id = t.owner_id
    WHERE t.owner_id != p_user_id
      AND p.last_known_location IS NOT NULL
      AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
          p.last_known_location::geography,
          p_radius_km * 1000
      )
    GROUP BY t.owner_id
  ) rivals
  WHERE rivals.total_area > (
    SELECT COALESCE(SUM(area_m2), 0)
    FROM territory_polygons
    WHERE owner_id = p_user_id
  );
$$;

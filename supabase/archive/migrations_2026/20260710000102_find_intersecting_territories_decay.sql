-- ============================================================
-- H11: freshness decay never applied server-side
-- ============================================================
-- find_intersecting_territories (20260515000059) returned the raw stored
-- `freshness` column, which defaults to 100 and is only ever bumped up by
-- defend_own_territories — it's never decayed in the database, decay is applied
-- only for on-device display (computeFreshness in claimEngine.ts). Server-side
-- "isFresh" checks in process-run-territory therefore always saw freshness 100,
-- so a territory abandoned for months was still practically unstealable except
-- via the small forced-overlap threshold, killing the advertised
-- decay-then-capture mechanic. Apply the identical decay formula used by
-- get_territory_score (20260515000056) and the client's computeFreshness:
-- floor(days since last_defended_at) * 10 points/day, floored at 0.

CREATE OR REPLACE FUNCTION find_intersecting_territories(
  p_wkt      TEXT,
  p_owner_id UUID
)
RETURNS TABLE(
  id                UUID,
  owner_id          UUID,
  freshness         SMALLINT,
  area_m2           FLOAT8,
  intersection_area FLOAT8
)
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT
    tp.id,
    tp.owner_id,
    GREATEST(0, tp.freshness - (
      EXTRACT(EPOCH FROM (now() - tp.last_defended_at)) / 86400 * 10
    )::INT)::SMALLINT AS freshness,
    tp.area_m2,
    ST_Area(ST_Intersection(tp.geom, ST_GeomFromText(p_wkt, 4326))::geography) AS intersection_area
  FROM territory_polygons tp
  WHERE tp.owner_id != p_owner_id
    AND tp.geom IS NOT NULL
    AND ST_Intersects(tp.geom, ST_GeomFromText(p_wkt, 4326));
$$;

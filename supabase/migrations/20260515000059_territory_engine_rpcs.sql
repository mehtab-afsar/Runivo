-- PostGIS RPCs required by the process-run-territory edge function.
-- Also updates get_map_polygons to return polygon_coords JSONB (readable by the JS client
-- without PostGIS geometry decoding).

-- ── get_map_polygons — add polygon_coords to return type ─────────────────────

DROP FUNCTION IF EXISTS get_map_polygons(FLOAT8, FLOAT8, FLOAT8, FLOAT8);

CREATE OR REPLACE FUNCTION get_map_polygons(
  min_lat FLOAT8, min_lng FLOAT8,
  max_lat FLOAT8, max_lng FLOAT8
)
RETURNS TABLE(
  id               UUID,
  owner_id         UUID,
  owner_name       TEXT,
  area_m2          FLOAT8,
  freshness        SMALLINT,
  last_defended_at TIMESTAMPTZ,
  is_loop_fill     BOOLEAN,
  tier             TEXT,
  polygon_coords   JSONB
)
LANGUAGE SQL STABLE AS $$
  SELECT
    tp.id,
    tp.owner_id,
    COALESCE(tp.owner_name, p.username) AS owner_name,
    tp.area_m2,
    tp.freshness,
    tp.last_defended_at,
    tp.is_loop_fill,
    tp.tier,
    tp.polygon_coords
  FROM territory_polygons tp
  JOIN profiles p ON p.id = tp.owner_id
  WHERE tp.geom IS NOT NULL
    AND tp.polygon_coords IS NOT NULL
    AND jsonb_array_length(tp.polygon_coords) >= 4
    AND ST_Intersects(
      tp.geom,
      ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    )
  LIMIT 500;
$$;

-- ── Helper: extract largest polygon from potentially multi-part geometry ──────

CREATE OR REPLACE FUNCTION largest_polygon(geom GEOMETRY)
RETURNS GEOMETRY LANGUAGE SQL IMMUTABLE STRICT AS $$
  SELECT g FROM (
    SELECT (ST_Dump(geom)).geom AS g
  ) sub
  ORDER BY ST_Area(g) DESC
  LIMIT 1;
$$;

-- ── find_intersecting_territories ─────────────────────────────────────────────
-- Returns rival polygons (not owned by p_owner_id) that intersect the run corridor.
-- intersection_area is in m².

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
    tp.freshness,
    tp.area_m2,
    ST_Area(ST_Intersection(tp.geom, ST_GeomFromText(p_wkt, 4326))::geography) AS intersection_area
  FROM territory_polygons tp
  WHERE tp.owner_id != p_owner_id
    AND tp.geom IS NOT NULL
    AND ST_Intersects(tp.geom, ST_GeomFromText(p_wkt, 4326));
$$;

-- ── steal_territory_portion ───────────────────────────────────────────────────
-- Clips the rival's polygon by the runner's corridor, removes the stolen area,
-- and inserts the stolen portion as a new territory for the new owner.

CREATE OR REPLACE FUNCTION steal_territory_portion(
  p_rival_id   UUID,
  p_new_wkt    TEXT,
  p_new_owner  UUID,
  p_run_id     UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rival_geom    GEOMETRY;
  run_geom      GEOMETRY;
  stolen_geom   GEOMETRY;
  remain_geom   GEOMETRY;
  stolen_area   FLOAT8;
  remain_area   FLOAT8;
  stolen_coords JSONB;
  remain_coords JSONB;
BEGIN
  SELECT geom INTO rival_geom FROM territory_polygons WHERE id = p_rival_id;
  IF rival_geom IS NULL THEN RETURN; END IF;

  run_geom    := ST_GeomFromText(p_new_wkt, 4326);
  stolen_geom := ST_Intersection(rival_geom, run_geom);
  remain_geom := ST_Difference(rival_geom, run_geom);

  IF ST_IsEmpty(stolen_geom) THEN RETURN; END IF;

  -- Take the largest single polygon when the result is multi-part
  stolen_geom := largest_polygon(stolen_geom);
  stolen_area := ST_Area(stolen_geom::geography);

  -- Update or delete the rival polygon
  IF ST_IsEmpty(remain_geom) THEN
    DELETE FROM territory_polygons WHERE id = p_rival_id;
  ELSE
    remain_geom   := largest_polygon(remain_geom);
    remain_area   := ST_Area(remain_geom::geography);
    remain_coords := (ST_AsGeoJSON(remain_geom)::jsonb -> 'coordinates' -> 0);

    IF remain_area < 100 OR jsonb_array_length(remain_coords) < 4 THEN
      DELETE FROM territory_polygons WHERE id = p_rival_id;
    ELSE
      -- Updating polygon_coords triggers tp_geom_trigger which recomputes geom
      UPDATE territory_polygons SET
        polygon_coords = remain_coords,
        area_m2        = remain_area,
        freshness      = GREATEST(0, freshness - 20)
      WHERE id = p_rival_id;
    END IF;
  END IF;

  -- Insert stolen portion as new territory for the runner (skip tiny fragments)
  IF stolen_area < 50 THEN RETURN; END IF;
  stolen_coords := (ST_AsGeoJSON(stolen_geom)::jsonb -> 'coordinates' -> 0);
  IF stolen_coords IS NULL OR jsonb_array_length(stolen_coords) < 4 THEN RETURN; END IF;

  INSERT INTO territory_polygons (
    id, run_id, owner_id,
    polygon_coords, area_m2,
    freshness, last_defended_at, claimed_at,
    is_loop_fill, tier
  ) VALUES (
    gen_random_uuid(), p_run_id, p_new_owner,
    stolen_coords, stolen_area,
    100, now(), now(),
    false,
    CASE
      WHEN stolen_area <     5000 THEN 'patch'
      WHEN stolen_area <    50000 THEN 'block'
      WHEN stolen_area <   200000 THEN 'district'
      WHEN stolen_area <   500000 THEN 'quarter'
                                   ELSE 'domain'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION steal_territory_portion TO service_role;

-- ── claim_unclaimed_area ──────────────────────────────────────────────────────
-- Inserts the portion of the run corridor not overlapping any existing territory.
-- Returns TRUE if a new polygon was inserted.

CREATE OR REPLACE FUNCTION claim_unclaimed_area(
  p_wkt      TEXT,
  p_owner_id UUID,
  p_run_id   UUID
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  run_geom       GEOMETRY;
  all_existing   GEOMETRY;
  unclaimed_geom GEOMETRY;
  unclaimed_area FLOAT8;
  unclaimed_coords JSONB;
BEGIN
  run_geom := ST_GeomFromText(p_wkt, 4326);

  -- Union of all existing territories that intersect the run corridor
  SELECT ST_Union(geom) INTO all_existing
  FROM territory_polygons
  WHERE geom IS NOT NULL AND ST_Intersects(geom, run_geom);

  IF all_existing IS NULL THEN
    -- Nothing overlaps — the entire corridor is unclaimed
    unclaimed_geom := run_geom;
  ELSE
    unclaimed_geom := ST_Difference(run_geom, all_existing);
  END IF;

  IF unclaimed_geom IS NULL OR ST_IsEmpty(unclaimed_geom) THEN RETURN FALSE; END IF;

  unclaimed_geom  := largest_polygon(unclaimed_geom);
  unclaimed_area  := ST_Area(unclaimed_geom::geography);
  IF unclaimed_area < 100 THEN RETURN FALSE; END IF;

  unclaimed_coords := (ST_AsGeoJSON(unclaimed_geom)::jsonb -> 'coordinates' -> 0);
  IF unclaimed_coords IS NULL OR jsonb_array_length(unclaimed_coords) < 4 THEN RETURN FALSE; END IF;

  INSERT INTO territory_polygons (
    id, run_id, owner_id,
    polygon_coords, area_m2,
    freshness, last_defended_at, claimed_at,
    is_loop_fill, tier
  ) VALUES (
    gen_random_uuid(), p_run_id, p_owner_id,
    unclaimed_coords, unclaimed_area,
    100, now(), now(),
    false,
    CASE
      WHEN unclaimed_area <     5000 THEN 'patch'
      WHEN unclaimed_area <    50000 THEN 'block'
      WHEN unclaimed_area <   200000 THEN 'district'
      WHEN unclaimed_area <   500000 THEN 'quarter'
                                      ELSE 'domain'
    END
  );
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_unclaimed_area TO service_role;

-- ── defend_own_territories ────────────────────────────────────────────────────
-- Refreshes freshness (+10, capped at 100) on the owner's polygons that the
-- run corridor passes through.

CREATE OR REPLACE FUNCTION defend_own_territories(
  p_wkt      TEXT,
  p_owner_id UUID
)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE territory_polygons
  SET freshness        = LEAST(100, freshness + 10),
      last_defended_at = now()
  WHERE owner_id = p_owner_id
    AND geom IS NOT NULL
    AND ST_Intersects(geom, ST_GeomFromText(p_wkt, 4326));
$$;

GRANT EXECUTE ON FUNCTION defend_own_territories TO service_role;

-- ── apply_pace_adjustment ─────────────────────────────────────────────────────
-- Credits PACE to the player's profile (balance + total + weekly).
-- Called by process-run-territory after computing stolen/claimed zones.

CREATE OR REPLACE FUNCTION apply_pace_adjustment(
  p_user_id    UUID,
  p_pace_delta INT
)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE profiles
  SET
    pace_balance       = GREATEST(0, pace_balance       + p_pace_delta),
    pace_total_earned  =             pace_total_earned   + p_pace_delta,
    pace_weekly_earned =             pace_weekly_earned  + p_pace_delta
  WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION apply_pace_adjustment TO service_role;

-- ── find_intersecting_territories grant ───────────────────────────────────────
GRANT EXECUTE ON FUNCTION find_intersecting_territories TO service_role;
GRANT EXECUTE ON FUNCTION largest_polygon              TO service_role;

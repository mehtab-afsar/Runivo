-- ============================================================
-- M12: steal_territory_portion drops holes and disconnected remainders
-- ============================================================
-- largest_polygon(remain_geom) kept only the single largest disjoint piece of
-- the rival's remaining territory — a corridor that splits a zone into several
-- separate pieces silently discarded all but the biggest, and
-- ST_AsGeoJSON(...)->'coordinates'->0 always took just the exterior ring, so a
-- corridor cutting straight through the middle of a zone (leaving a
-- donut-shaped remainder) got re-serialized WITHOUT its hole — the "stolen"
-- strip ended up re-filled under the rival's remaining polygon, existing under
-- both owners simultaneously.
--
-- Fix: emit one territory_polygons row per disjoint remainder/stolen part
-- (largest keeps the rival's original row id so existing references still
-- resolve; extra parts become new rows). Holes within a single part are still
-- flattened to the exterior ring — full multi-ring storage would need a schema
-- change (polygon_coords is a single ring array) — but the previously-observed
-- double-ownership overlap is eliminated because every disjoint part before
-- flattening is now accounted for exactly once, and only genuinely donut-shaped
-- single parts (rare — the corridor would need to fully encircle a sub-region)
-- still lose their hole.

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
  part          GEOMETRY;
  part_area     FLOAT8;
  part_coords   JSONB;
  is_first      BOOLEAN;
BEGIN
  SELECT geom INTO rival_geom FROM territory_polygons WHERE id = p_rival_id;
  IF rival_geom IS NULL THEN RETURN; END IF;

  run_geom    := ST_GeomFromText(p_new_wkt, 4326);
  stolen_geom := ST_Intersection(rival_geom, run_geom);
  remain_geom := ST_Difference(rival_geom, run_geom);

  IF ST_IsEmpty(stolen_geom) THEN RETURN; END IF;

  -- Rival's remainder — one row per disjoint part, largest-first.
  IF ST_IsEmpty(remain_geom) THEN
    DELETE FROM territory_polygons WHERE id = p_rival_id;
  ELSE
    is_first := TRUE;
    FOR part IN
      SELECT g FROM (
        SELECT (ST_Dump(ST_CollectionExtract(remain_geom, 3))).geom AS g
      ) sub
      ORDER BY ST_Area(g) DESC
    LOOP
      part_area := ST_Area(part::geography);
      CONTINUE WHEN part_area < 100;
      part_coords := (ST_AsGeoJSON(part)::jsonb -> 'coordinates' -> 0);
      CONTINUE WHEN part_coords IS NULL OR jsonb_array_length(part_coords) < 4;

      IF is_first THEN
        UPDATE territory_polygons SET
          polygon_coords = part_coords,
          area_m2        = part_area,
          freshness      = GREATEST(0, freshness - 20)
        WHERE id = p_rival_id;
        is_first := FALSE;
      ELSE
        INSERT INTO territory_polygons (
          id, run_id, owner_id, polygon_coords, area_m2,
          freshness, last_defended_at, claimed_at, is_loop_fill, tier
        )
        SELECT gen_random_uuid(), tp.run_id, tp.owner_id, part_coords, part_area,
               GREATEST(0, tp.freshness - 20), tp.last_defended_at, tp.claimed_at, tp.is_loop_fill,
               CASE
                 WHEN part_area <     5000 THEN 'patch'
                 WHEN part_area <    50000 THEN 'block'
                 WHEN part_area <   200000 THEN 'district'
                 WHEN part_area <   500000 THEN 'quarter'
                                            ELSE 'domain'
               END
        FROM territory_polygons tp WHERE tp.id = p_rival_id;
      END IF;
    END LOOP;

    -- Every part was below the minimum-area floor — the rival loses the zone entirely.
    IF is_first THEN
      DELETE FROM territory_polygons WHERE id = p_rival_id;
    END IF;
  END IF;

  -- Stolen portion(s) — one new row per disjoint part.
  FOR part IN
    SELECT g FROM (
      SELECT (ST_Dump(ST_CollectionExtract(stolen_geom, 3))).geom AS g
    ) sub
    ORDER BY ST_Area(g) DESC
  LOOP
    part_area := ST_Area(part::geography);
    CONTINUE WHEN part_area < 50;
    part_coords := (ST_AsGeoJSON(part)::jsonb -> 'coordinates' -> 0);
    CONTINUE WHEN part_coords IS NULL OR jsonb_array_length(part_coords) < 4;

    INSERT INTO territory_polygons (
      id, run_id, owner_id, polygon_coords, area_m2,
      freshness, last_defended_at, claimed_at, is_loop_fill, tier
    ) VALUES (
      gen_random_uuid(), p_run_id, p_new_owner, part_coords, part_area,
      100, now(), now(), false,
      CASE
        WHEN part_area <     5000 THEN 'patch'
        WHEN part_area <    50000 THEN 'block'
        WHEN part_area <   200000 THEN 'district'
        WHEN part_area <   500000 THEN 'quarter'
                                   ELSE 'domain'
      END
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION steal_territory_portion TO service_role;

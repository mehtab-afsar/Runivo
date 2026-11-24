-- ========================================================================
-- Territory fixes (pre-launch audit, docs: /home/claude/audit/territory.md)
-- ========================================================================
-- T1-T3  A zone's geom is rebuilt from polygon_coords, which holds only the
--        outer ring. Any piece with a hole (a big loop run as a strip, a steal
--        through the middle of a zone, a loop around someone else's zone) was
--        stored solid: the runner silently owned the hole too. Pieces are now
--        cut into hole-free parts before they are stored.
-- T11    "Stale" for defending used the stored freshness, which never decays.
-- T12    Defending fully refreshes a zone (it used to add 10 to the stored,
--        undecayed value, which favoured long-abandoned zones).
-- T13    Two runs finishing over the same free ground could both claim it.
--        Claims and steals now take one transaction-level advisory lock.
-- T14    process-run-territory did each step in its own transaction, so a
--        failure halfway left steals and the streak written while the retry
--        lost the PACE for them. apply_run_territory does every territory
--        write in one transaction and records the outcome on run_processing,
--        so a retry reuses it.
-- T21    The map returned an arbitrary 500 zones; it now returns the largest.
-- T27    total_territories_claimed is server-owned (counted here), not pushed
--        by the app; runs.territories_claimed is written from the verdict.

SET check_function_bodies = false;
SET client_min_messages = warning;
SET search_path = public, extensions;

-- ── Stage of an interrupted processing attempt (T14) ─────────────────────

ALTER TABLE public.run_processing ADD COLUMN IF NOT EXISTS stage jsonb;

-- ── Hole-free parts (T1-T3) ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.hole_free_parts(g geometry, depth integer DEFAULT 0) RETURNS SETOF geometry
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  p     geometry;
  x     float8;
  b     box2d;
  blade geometry;
BEGIN
  IF g IS NULL OR ST_IsEmpty(g) THEN RETURN; END IF;
  FOR p IN SELECT (ST_Dump(ST_CollectionExtract(ST_MakeValid(g), 3))).geom LOOP
    IF ST_NumInteriorRings(p) = 0 OR depth >= 24 THEN
      RETURN NEXT p;
      CONTINUE;
    END IF;
    -- Cut north-south through the first hole: the hole opens up into the
    -- outline of the pieces on either side.
    x := ST_X(ST_Centroid(ST_InteriorRingN(p, 1)));
    b := p::box2d;
    blade := ST_SetSRID(ST_MakeLine(ST_MakePoint(x, ST_YMin(b) - 1), ST_MakePoint(x, ST_YMax(b) + 1)), ST_SRID(p));
    RETURN QUERY
      SELECT h FROM ST_Dump(ST_Split(p, blade)) d, public.hole_free_parts(d.geom, depth + 1) h;
  END LOOP;
END;
$$;

-- ── Claim free ground (T1, T3, T13) ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.claim_unclaimed_area(p_wkt text, p_owner_id uuid, p_run_id uuid, p_is_loop boolean DEFAULT false) RETURNS TABLE(pieces integer, area_m2 double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
#variable_conflict use_column
DECLARE
  v_run      geometry := ST_GeomFromText(p_wkt, 4326);
  v_existing geometry;
  v_free     geometry;
  v_part     geometry;
  v_area     float8;
  v_coords   jsonb;
  v_pieces   int := 0;
  v_total    float8 := 0;
BEGIN
  -- One claim or steal at a time: two runs over the same free ground used to
  -- both see it free and both claim it.
  PERFORM pg_advisory_xact_lock(hashtext('runivo_territory'));

  SELECT ST_Union(geom) INTO v_existing
  FROM public.territory_polygons
  WHERE geom IS NOT NULL AND ST_Intersects(geom, v_run);

  v_free := CASE WHEN v_existing IS NULL THEN v_run ELSE ST_Difference(v_run, v_existing) END;
  IF v_free IS NULL OR ST_IsEmpty(v_free) THEN
    pieces := 0; area_m2 := 0; RETURN NEXT; RETURN;
  END IF;

  FOR v_part IN
    SELECT h FROM public.hole_free_parts(v_free) h
    ORDER BY ST_Area(h::geography) DESC
  LOOP
    v_area := ST_Area(v_part::geography);
    CONTINUE WHEN v_area < 100;
    v_coords := (ST_AsGeoJSON(v_part)::jsonb -> 'coordinates' -> 0);
    CONTINUE WHEN v_coords IS NULL OR jsonb_array_length(v_coords) < 4;

    INSERT INTO public.territory_polygons (
      id, run_id, owner_id, polygon_coords, area_m2,
      freshness, last_defended_at, claimed_at, is_loop_fill, tier
    ) VALUES (
      gen_random_uuid(), p_run_id, p_owner_id, v_coords, v_area,
      100, now(), now(), p_is_loop,
      CASE
        WHEN v_area <   5000 THEN 'patch'
        WHEN v_area <  50000 THEN 'block'
        WHEN v_area < 200000 THEN 'district'
        WHEN v_area < 500000 THEN 'quarter'
        ELSE 'domain'
      END
    );
    v_pieces := v_pieces + 1;
    v_total  := v_total + v_area;
  END LOOP;

  pieces := v_pieces; area_m2 := v_total; RETURN NEXT;
END;
$$;

-- ── Steal part of a rival's zone (T2, T13) ───────────────────────────────

CREATE OR REPLACE FUNCTION public.steal_territory_portion(p_rival_id uuid, p_new_wkt text, p_new_owner uuid, p_run_id uuid) RETURNS double precision
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  rival_geom  geometry;
  run_geom    geometry;
  stolen_geom geometry;
  remain_geom geometry;
  part        geometry;
  part_area   float8;
  part_coords jsonb;
  is_first    boolean;
  v_taken     float8 := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('runivo_territory'));

  SELECT geom INTO rival_geom FROM public.territory_polygons WHERE id = p_rival_id FOR UPDATE;
  IF rival_geom IS NULL THEN RETURN 0; END IF;

  run_geom    := ST_GeomFromText(p_new_wkt, 4326);
  stolen_geom := ST_Intersection(rival_geom, run_geom);
  remain_geom := ST_Difference(rival_geom, run_geom);

  IF stolen_geom IS NULL OR ST_IsEmpty(stolen_geom) OR ST_Area(stolen_geom::geography) < 50 THEN
    RETURN 0;
  END IF;

  FOR part IN
    SELECT h FROM public.hole_free_parts(stolen_geom) h
    ORDER BY ST_Area(h::geography) DESC
  LOOP
    part_area := ST_Area(part::geography);
    CONTINUE WHEN part_area < 50;
    part_coords := (ST_AsGeoJSON(part)::jsonb -> 'coordinates' -> 0);
    CONTINUE WHEN part_coords IS NULL OR jsonb_array_length(part_coords) < 4;

    INSERT INTO public.territory_polygons (
      id, run_id, owner_id, polygon_coords, area_m2,
      freshness, last_defended_at, claimed_at, is_loop_fill, tier
    ) VALUES (
      gen_random_uuid(), p_run_id, p_new_owner, part_coords, part_area,
      100, now(), now(), false,
      CASE
        WHEN part_area <   5000 THEN 'patch'
        WHEN part_area <  50000 THEN 'block'
        WHEN part_area < 200000 THEN 'district'
        WHEN part_area < 500000 THEN 'quarter'
        ELSE 'domain'
      END
    );
    v_taken := v_taken + part_area;
  END LOOP;

  IF v_taken = 0 THEN
    RETURN 0;
  END IF;

  IF remain_geom IS NULL OR ST_IsEmpty(remain_geom) THEN
    DELETE FROM public.territory_polygons WHERE id = p_rival_id;
    RETURN v_taken;
  END IF;

  -- What the rival keeps, hole-free: a strip through the middle of a zone
  -- used to leave a hole that the stored outline filled straight back in.
  is_first := true;
  FOR part IN
    SELECT h FROM public.hole_free_parts(remain_geom) h
    ORDER BY ST_Area(h::geography) DESC
  LOOP
    part_area := ST_Area(part::geography);
    CONTINUE WHEN part_area < 100;
    part_coords := (ST_AsGeoJSON(part)::jsonb -> 'coordinates' -> 0);
    CONTINUE WHEN part_coords IS NULL OR jsonb_array_length(part_coords) < 4;

    IF is_first THEN
      UPDATE public.territory_polygons SET
        polygon_coords = part_coords,
        area_m2        = part_area,
        freshness      = GREATEST(0, freshness - 20),
        tier           = CASE
                           WHEN part_area <   5000 THEN 'patch'
                           WHEN part_area <  50000 THEN 'block'
                           WHEN part_area < 200000 THEN 'district'
                           WHEN part_area < 500000 THEN 'quarter'
                           ELSE 'domain'
                         END
      WHERE id = p_rival_id;
      is_first := false;
    ELSE
      INSERT INTO public.territory_polygons (
        id, run_id, owner_id, polygon_coords, area_m2,
        freshness, last_defended_at, claimed_at, is_loop_fill, tier
      )
      SELECT gen_random_uuid(), tp.run_id, tp.owner_id, part_coords, part_area,
             GREATEST(0, tp.freshness - 20), tp.last_defended_at, tp.claimed_at, tp.is_loop_fill,
             CASE
               WHEN part_area <   5000 THEN 'patch'
               WHEN part_area <  50000 THEN 'block'
               WHEN part_area < 200000 THEN 'district'
               WHEN part_area < 500000 THEN 'quarter'
               ELSE 'domain'
             END
      FROM public.territory_polygons tp WHERE tp.id = p_rival_id;
    END IF;
  END LOOP;

  IF is_first THEN
    DELETE FROM public.territory_polygons WHERE id = p_rival_id;
  END IF;

  RETURN v_taken;
END;
$$;

-- ── Defending (T11, T12) ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.count_defendable_stale_zones(p_wkt text, p_owner_id uuid, p_stale_at smallint) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  SELECT COUNT(*)::INT FROM public.territory_polygons
  WHERE owner_id = p_owner_id
    AND geom IS NOT NULL
    AND GREATEST(0, floor(freshness - EXTRACT(EPOCH FROM (now() - last_defended_at)) / 86400 * 10)) < p_stale_at
    AND ST_Intersects(geom, ST_GeomFromText(p_wkt, 4326));
$$;

CREATE OR REPLACE FUNCTION public.defend_own_territories(p_wkt text, p_owner_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  -- A run through your own zone fully refreshes it.
  UPDATE public.territory_polygons
  SET freshness        = 100,
      last_defended_at = now()
  WHERE owner_id = p_owner_id
    AND geom IS NOT NULL
    AND ST_Intersects(geom, ST_GeomFromText(p_wkt, 4326));
$$;

-- ── Every territory write of one run, in one transaction (T14) ───────────

CREATE OR REPLACE FUNCTION public.apply_run_territory(
  p_run_id uuid, p_owner_id uuid, p_wkt text, p_is_loop boolean, p_can_expand boolean,
  p_rival_ids uuid[], p_stale_at integer, p_streak_days integer, p_last_run_date date
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_rid     uuid;
  v_owner   uuid;
  v_taken   float8;
  v_stolen  jsonb := '[]'::jsonb;
  v_pieces  int := 0;
  v_claimed float8 := 0;
  v_stale   int := 0;
  v_tiers   text[] := '{}';
  v_result  jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('runivo_territory'));

  IF p_last_run_date IS NOT NULL THEN
    PERFORM set_config('runivo.trusted_writer', 'on', true);
    UPDATE public.profiles SET streak_days = p_streak_days, last_run_date = p_last_run_date WHERE id = p_owner_id;
    PERFORM set_config('runivo.trusted_writer', 'off', true);
  END IF;

  IF p_wkt IS NOT NULL THEN
    IF p_can_expand THEN
      FOREACH v_rid IN ARRAY COALESCE(p_rival_ids, '{}') LOOP
        SELECT owner_id INTO v_owner FROM public.territory_polygons WHERE id = v_rid;
        CONTINUE WHEN v_owner IS NULL OR v_owner = p_owner_id;
        v_taken := public.steal_territory_portion(v_rid, p_wkt, p_owner_id, p_run_id);
        IF v_taken > 0 THEN
          v_stolen := v_stolen || jsonb_build_object('territory_id', v_rid, 'owner_id', v_owner, 'area_m2', v_taken);
          v_tiers := v_tiers || CASE WHEN v_taken < 5000 THEN 'patch' WHEN v_taken < 50000 THEN 'block'
                                     WHEN v_taken < 200000 THEN 'district' WHEN v_taken < 500000 THEN 'quarter' ELSE 'domain' END;
        END IF;
      END LOOP;

      SELECT c.pieces, c.area_m2 INTO v_pieces, v_claimed
        FROM public.claim_unclaimed_area(p_wkt, p_owner_id, p_run_id, p_is_loop) c;
      IF COALESCE(v_pieces, 0) > 0 THEN
        v_tiers := v_tiers || CASE WHEN v_claimed < 5000 THEN 'patch' WHEN v_claimed < 50000 THEN 'block'
                                   WHEN v_claimed < 200000 THEN 'district' WHEN v_claimed < 500000 THEN 'quarter' ELSE 'domain' END;
      END IF;
    END IF;

    -- Counted before defending, so it reflects zones that were stale when the run passed.
    v_stale := public.count_defendable_stale_zones(p_wkt, p_owner_id, p_stale_at::smallint);
    PERFORM public.defend_own_territories(p_wkt, p_owner_id);
  END IF;

  -- Server-owned counters, written once with the verdict (T27).
  UPDATE public.runs SET territories_claimed = v_tiers WHERE id = p_run_id;
  IF cardinality(v_tiers) > 0 THEN
    PERFORM set_config('runivo.trusted_writer', 'on', true);
    UPDATE public.profiles SET total_territories_claimed = total_territories_claimed + cardinality(v_tiers) WHERE id = p_owner_id;
    PERFORM set_config('runivo.trusted_writer', 'off', true);
  END IF;

  v_result := jsonb_build_object(
    'stolen', v_stolen,
    'pieces', COALESCE(v_pieces, 0),
    'claimed_area_m2', COALESCE(v_claimed, 0),
    'defended_stale', COALESCE(v_stale, 0),
    'streak_advanced', p_last_run_date IS NOT NULL,
    'streak_days', p_streak_days
  );
  UPDATE public.run_processing SET stage = v_result WHERE run_id = p_run_id;
  RETURN v_result;
END;
$$;

-- ── Map: the largest zones first (T21) ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_map_polygons(min_lat double precision, min_lng double precision, max_lat double precision, max_lng double precision) RETURNS TABLE(id uuid, owner_id uuid, owner_name text, area_m2 double precision, freshness smallint, last_defended_at timestamp with time zone, is_loop_fill boolean, tier text, polygon_coords jsonb)
    LANGUAGE sql STABLE
    AS $$
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
  JOIN profiles_public p ON p.id = tp.owner_id
  WHERE tp.geom IS NOT NULL
    AND tp.polygon_coords IS NOT NULL
    AND jsonb_array_length(tp.polygon_coords) >= 4
    AND ST_Intersects(
      tp.geom,
      ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    )
  ORDER BY tp.area_m2 DESC
  LIMIT 500;
$$;

-- ── total_territories_claimed is server-owned (T27) ──────────────────────

CREATE OR REPLACE FUNCTION public.protect_profile_columns() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.role() = 'service_role'
     OR current_setting('runivo.trusted_writer', true) = 'on' THEN
    RETURN NEW;
  END IF;

  NEW.subscription_tier       := OLD.subscription_tier;
  NEW.subscription_expires_at := OLD.subscription_expires_at;
  NEW.subscription_event_at   := OLD.subscription_event_at;
  NEW.pace_balance            := OLD.pace_balance;
  NEW.pace_total_earned       := OLD.pace_total_earned;
  NEW.pace_weekly_earned      := OLD.pace_weekly_earned;
  NEW.pace_weekly_reset_at    := OLD.pace_weekly_reset_at;
  NEW.runner_rank             := OLD.runner_rank;
  NEW.territory_score         := OLD.territory_score;
  NEW.follower_count          := OLD.follower_count;
  NEW.following_count         := OLD.following_count;
  NEW.streak_days             := OLD.streak_days;
  NEW.last_run_date           := OLD.last_run_date;
  NEW.total_distance_km       := OLD.total_distance_km;
  NEW.total_runs              := OLD.total_runs;
  NEW.total_territories_claimed := OLD.total_territories_claimed;

  RETURN NEW;
END;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.hole_free_parts(geometry, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hole_free_parts(geometry, integer) TO service_role;

REVOKE ALL ON FUNCTION public.claim_unclaimed_area(text, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_unclaimed_area(text, uuid, uuid, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.steal_territory_portion(uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.steal_territory_portion(uuid, text, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.count_defendable_stale_zones(text, uuid, smallint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_defendable_stale_zones(text, uuid, smallint) TO service_role;

REVOKE ALL ON FUNCTION public.defend_own_territories(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.defend_own_territories(text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.apply_run_territory(uuid, uuid, text, boolean, boolean, uuid[], integer, integer, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_run_territory(uuid, uuid, text, boolean, boolean, uuid[], integer, integer, date) TO service_role;

REVOKE ALL ON FUNCTION public.protect_profile_columns() FROM PUBLIC, anon, authenticated;

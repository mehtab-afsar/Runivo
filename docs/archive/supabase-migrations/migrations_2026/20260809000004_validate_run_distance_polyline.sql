-- ============================================================
-- Cross-check distance_m against the submitted GPS polyline itself
-- ============================================================
-- 20260723000003 rejects implausible speed and requires >=10 GPS points past
-- 1000m, but never checks that distance_m has any relationship to the points'
-- own shape — a sparse, tightly-clustered 10-point trace can still claim any
-- distance the speed ceiling allows. get_run_km_by_user() (the global
-- distance leaderboard) sums raw distance_m straight from `runs`, so this is
-- a direct leaderboard-padding vector distinct from the total_distance_km
-- hole closed in lock_run_stat_columns.sql.
--
-- gps_polyline_length_m mirrors the haversineM() helper duplicated in
-- process-run-territory/index.ts and the client's claimEngine.ts — a third,
-- deliberate copy for the same reason those two are separate: this check
-- must hold even if the edge function is never reached.
--
-- Tolerance is generous (2.5x) on purpose. The client RDP-simplifies the
-- track before upload (sync.ts rdpSimplify, ~50-150 points per run) and
-- simplification only ever shortens a path, never lengthens it, so a
-- genuine run's polyline length is always a lower bound on its true
-- distance — but how much lower varies with route shape. 2.5x rejects only
-- traces with no real relationship to their claimed distance (e.g. a
-- stationary cluster of points claiming a multi-kilometre run), not normal
-- simplification loss.

CREATE OR REPLACE FUNCTION public.gps_polyline_length_m(points jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  pt       jsonb;
  prev_lat numeric;
  prev_lng numeric;
  cur_lat  numeric;
  cur_lng  numeric;
  d_lat    numeric;
  d_lng    numeric;
  a        numeric;
  total_m  numeric := 0;
BEGIN
  IF jsonb_typeof(points) IS DISTINCT FROM 'array' THEN
    RETURN 0;
  END IF;

  FOR pt IN SELECT * FROM jsonb_array_elements(points) LOOP
    cur_lat := (pt->>'lat')::numeric;
    cur_lng := (pt->>'lng')::numeric;

    IF prev_lat IS NOT NULL THEN
      d_lat := radians(cur_lat - prev_lat);
      d_lng := radians(cur_lng - prev_lng);
      a := sin(d_lat / 2) ^ 2
         + cos(radians(prev_lat)) * cos(radians(cur_lat)) * sin(d_lng / 2) ^ 2;
      total_m := total_m + 6371000 * 2 * atan2(sqrt(a), sqrt(1 - a));
    END IF;

    prev_lat := cur_lat;
    prev_lng := cur_lng;
  END LOOP;

  RETURN total_m;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_run_distance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  point_count      int := 0;
  max_plausible_m  numeric;
  polyline_m       numeric;
BEGIN
  -- process-run-territory and the sync backfill run as service_role and have already
  -- done (or are performing) the authoritative computation.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.distance_m IS NULL OR NEW.distance_m < 0 THEN
    RAISE EXCEPTION 'runs.distance_m must be a non-negative number';
  END IF;

  IF NEW.duration_sec IS NULL OR NEW.duration_sec < 0 THEN
    RAISE EXCEPTION 'runs.duration_sec must be a non-negative number';
  END IF;

  -- Speed gate. 5.5 m/s is MAX_RUN_SPEED_MS, shared by the client claim engine
  -- (packages/shared/src/services/config.ts:4) and the territory edge function
  -- (supabase/functions/process-run-territory/index.ts:4). 10% headroom absorbs
  -- GPS jitter and rounding. Only enforced for foot activities so that adding a
  -- cycling type later fails loudly in review rather than silently rejecting rides.
  IF COALESCE(NEW.activity_type, 'run') = 'run' THEN
    max_plausible_m := NEW.duration_sec * 5.5 * 1.1;
    IF NEW.distance_m > max_plausible_m THEN
      RAISE EXCEPTION
        'runs.distance_m % implausible for duration_sec % (max %m at 5.5 m/s)',
        NEW.distance_m, NEW.duration_sec, round(max_plausible_m);
    END IF;
  END IF;

  -- Anything beyond a token distance must carry a GPS trace. jsonb_array_length
  -- raises on a non-array, so only call it once the type is known to be an array.
  IF jsonb_typeof(NEW.gps_points) = 'array' THEN
    point_count := jsonb_array_length(NEW.gps_points);
  END IF;

  IF NEW.distance_m > 1000 AND point_count < 10 THEN
    RAISE EXCEPTION
      'runs.distance_m % requires a GPS trace (got % points)',
      NEW.distance_m, point_count;
  END IF;

  -- Polyline consistency — see migration header for the 2.5x rationale.
  IF NEW.distance_m > 1000 AND point_count >= 10 THEN
    polyline_m := public.gps_polyline_length_m(NEW.gps_points);
    IF polyline_m > 0 AND NEW.distance_m > polyline_m * 2.5 THEN
      RAISE EXCEPTION
        'runs.distance_m % implausible for a %m GPS trace (% points)',
        NEW.distance_m, round(polyline_m), point_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

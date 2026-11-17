-- R5: wheelchair and stroller runs pass the same checks as runs (wheelchairs
-- with a 9 m/s ceiling); treadmill runs are logged by hand without GPS and
-- never claim or earn (they are not in ENGINE.TERRITORY_ACTIVITIES).

CREATE OR REPLACE FUNCTION public.validate_run_distance()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  -- Rides (activity_type 'cycle') get their own cap: 22 m/s, the engine's
  -- MAX_RIDE_SEGMENT_SPEED_MS, plus the same 10% headroom.
  IF NEW.activity_type = 'cycle' THEN
    max_plausible_m := NEW.duration_sec * 22 * 1.1;
    IF NEW.distance_m > max_plausible_m THEN
      RAISE EXCEPTION
        'runs.distance_m % implausible for a ride of duration_sec % (max %m at 22 m/s)',
        NEW.distance_m, NEW.duration_sec, round(max_plausible_m);
    END IF;
  END IF;

  -- Self-propelled (ENGINE.TERRITORY_ACTIVITIES plus treadmill). Wheelchairs
  -- are faster downhill (9 m/s); a treadmill is a run with no GPS.
  IF COALESCE(NEW.activity_type, 'run') IN ('run', 'trail_run', 'trail', 'walk', 'hike', 'stroller', 'wheelchair', 'treadmill') THEN
    max_plausible_m := NEW.duration_sec * (CASE WHEN NEW.activity_type = 'wheelchair' THEN 9 WHEN NEW.activity_type = 'treadmill' THEN 6.5 ELSE 5.5 END) * 1.1;
    IF NEW.distance_m > max_plausible_m THEN
      RAISE EXCEPTION
        'runs.distance_m % implausible for duration_sec % (max %m at 5.5 m/s)',
        NEW.distance_m, NEW.duration_sec, round(max_plausible_m);
    END IF;

    -- No two runs for the same user can occupy overlapping time — see header.
    IF NEW.started_at IS NOT NULL AND NEW.finished_at IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.runs r
      WHERE r.user_id = NEW.user_id
        AND r.id <> NEW.id
        AND COALESCE(r.activity_type, 'run') IN ('run', 'trail_run', 'trail', 'walk', 'hike', 'stroller', 'wheelchair', 'treadmill')
        AND r.started_at < NEW.finished_at
        AND r.finished_at > NEW.started_at
    ) THEN
      RAISE EXCEPTION
        'runs: started_at/finished_at overlaps another run already recorded for this user';
    END IF;
  END IF;

  -- Anything beyond a token distance must carry a GPS trace. jsonb_array_length
  -- raises on a non-array, so only call it once the type is known to be an array.
  IF jsonb_typeof(NEW.gps_points) = 'array' THEN
    point_count := jsonb_array_length(NEW.gps_points);
  END IF;

  -- Treadmill runs carry no trace; they never claim zones or earn PACE.
  IF NEW.activity_type = 'treadmill' THEN
    RETURN NEW;
  END IF;

  IF NEW.distance_m > 1000 AND point_count < 10 THEN
    RAISE EXCEPTION
      'runs.distance_m % requires a GPS trace (got % points)',
      NEW.distance_m, point_count;
  END IF;

  -- Polyline consistency — see validate_run_distance_polyline.sql for the 2.5x rationale.
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
$function$;

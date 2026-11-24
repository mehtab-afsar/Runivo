-- ============================================================
-- H-6: Stop the client inventing distance for the leaderboard
-- ============================================================
-- The PACE economy is properly server-authoritative — process-run-territory
-- recomputes distance from accuracy-filtered GPS and ignores the client's figure
-- (index.ts:156-161, :330-350), and 20260701000075 reverts client writes to the
-- balance/tier/streak columns. But the `runs` ROW itself is still inserted directly
-- by the client (packages/shared/src/services/sync.ts:293) under
-- `with check (auth.uid() = user_id)`, and nothing cross-checks distance_m against
-- the gps_points in the same row.
--
-- Those values are not inert. They feed:
--   • get_run_km_by_user()      → the month / all-time distance leaderboard
--                                 (20260701000076_runs_owner_scope.sql:32-37)
--   • profiles.total_distance_km / total_runs via trg_sync_profile_run_stats
--                                 (20260301000033_runs_stats_synced.sql:70-72)
--
-- So one crafted PostgREST insert topped the distance leaderboard with no GPS trace.
--
-- This trigger rejects physically impossible rows rather than silently zeroing them:
-- a genuine run recorded by the app always satisfies both checks, and a hard error
-- surfaces a real bug instead of quietly corrupting a user's totals.

CREATE OR REPLACE FUNCTION public.validate_run_distance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  point_count int := 0;
  max_plausible_m numeric;
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS runs_validate_distance ON public.runs;

CREATE TRIGGER runs_validate_distance
  BEFORE INSERT OR UPDATE ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.validate_run_distance();

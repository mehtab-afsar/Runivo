-- ============================================================
-- Reject runs whose claimed time window overlaps another of the same user's runs
-- ============================================================
-- Nothing previously stopped rapid-fire submission of many fabricated runs to
-- farm the distance leaderboard: get_run_km_by_user() sums raw distance_m with
-- no weekly cap (unlike PACE, which is already capped by apply_pace_adjustment's
-- weekly ceiling), so distance is the one leaderboard number volume alone can
-- still inflate.
--
-- A wall-clock submission throttle (e.g. "can't submit sooner than
-- duration_sec after your last run") was considered and rejected: this app is
-- offline-first (packages/shared/src/services/sync.ts pushUnsyncedRuns), so a
-- user who ran twice today without connectivity legitimately batch-syncs two
-- real, non-overlapping runs back-to-back over the network when they're back
-- online — a wall-clock rule would reject the second one outright.
--
-- Rejecting overlapping *claimed* windows instead has no such false-positive:
-- two runs can never legitimately overlap for one person regardless of when
-- they're synced. It also bounds the maximum damage of pure-volume fabrication
-- as a side effect: combined with the existing 5.5 m/s speed ceiling, runs that
-- can't overlap in time can never sum to more than ~475km of claimed distance
-- in any rolling 24h window (24h * 3600s * 5.5m/s ≈ 475,200m) — generously
-- beyond any real runner, without constraining one at all.

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

    -- No two runs for the same user can occupy overlapping time — see header.
    IF NEW.started_at IS NOT NULL AND NEW.finished_at IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.runs r
      WHERE r.user_id = NEW.user_id
        AND r.id <> NEW.id
        AND COALESCE(r.activity_type, 'run') = 'run'
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
$$;

-- Activity types: run, trail run, walk and hike play the territory game;
-- rides are recorded but don't claim zones, earn PACE, move the streak or count
-- toward running totals and the weekly distance board.
-- Mirrors ENGINE.TERRITORY_ACTIVITIES / MAX_RIDE_SEGMENT_SPEED_MS in
-- packages/shared/src/engine/runEngine.ts.

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

  -- On foot: run, trail run, walk, hike (ENGINE.TERRITORY_ACTIVITIES).
  IF COALESCE(NEW.activity_type, 'run') IN ('run', 'trail_run', 'trail', 'walk', 'hike') THEN
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
        AND COALESCE(r.activity_type, 'run') IN ('run', 'trail_run', 'trail', 'walk', 'hike')
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
$function$;

CREATE OR REPLACE FUNCTION public.sync_profile_run_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  today    date := new.started_at::date;
  last_run date;
begin
  -- Skip if already processed (idempotency guard)
  if new.stats_synced then
    return new;
  end if;

  -- Rides don't count toward running totals or the streak (left unsynced, so
  -- revert_profile_run_stats has nothing to undo either).
  if coalesce(new.activity_type, 'run') not in ('run', 'trail_run', 'trail', 'walk', 'hike') then
    return new;
  end if;

  -- Increment lifetime stats
  update public.profiles
  set
    total_runs        = total_runs + 1,
    total_distance_km = total_distance_km + (new.distance_m / 1000.0)
  where id = new.user_id;

  -- Update streak server-side
  select last_run_date into last_run
  from   public.profiles
  where  id = new.user_id;

  if last_run is null or last_run < today - interval '1 day' then
    -- First run ever, or streak broken
    update public.profiles
    set streak_days   = 1,
        last_run_date = today
    where id = new.user_id;
  elsif last_run = today - interval '1 day' then
    -- Consecutive day — extend streak
    update public.profiles
    set streak_days   = streak_days + 1,
        last_run_date = today
    where id = new.user_id;
  elsif last_run = today then
    -- Already ran today — just update last_run_date, no streak change
    update public.profiles
    set last_run_date = today
    where id = new.user_id;
  end if;

  -- Mark this row as processed
  new.stats_synced := true;
  return new;
end;
$function$;

CREATE OR REPLACE VIEW public.leaderboard_weekly AS
SELECT p.id,
    p.username,
    p.avatar_url,
    p.runner_rank,
    p.territory_score,
    p.pace_weekly_earned AS weekly_pace,
    (COALESCE((sum(r.distance_m) / 1000.0), (0)::numeric))::numeric(10,3) AS weekly_km,
    (COALESCE(sum(cardinality(r.territories_claimed)), (0)::bigint))::integer AS weekly_territories,
    (dense_rank() OVER (ORDER BY p.territory_score DESC))::integer AS rank,
    p.country
   FROM (profiles p
     LEFT JOIN runs r ON (((r.user_id = p.id) AND (r.started_at >= date_trunc('week'::text, (now() AT TIME ZONE 'utc'::text))) AND (COALESCE(r.activity_type, 'run'::text) = ANY (ARRAY['run'::text, 'trail_run'::text, 'trail'::text, 'walk'::text, 'hike'::text])))))
  GROUP BY p.id, p.username, p.avatar_url, p.runner_rank, p.territory_score, p.pace_weekly_earned, p.country;

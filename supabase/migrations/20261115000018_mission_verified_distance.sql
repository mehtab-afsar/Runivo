-- ============================================================
-- Mission rewards now count only distance the server verified (audit H4).
--
-- mission_completed_today() summed runs.distance_m. Clients can insert their own
-- `runs` rows, so a fabricated run (or a treadmill entry, which carries no GPS)
-- could "complete" the distance missions and claim up to 35 PACE a day with no
-- movement. The distance now comes from run_processing.result.verifiedDistanceKm:
-- what process-run-territory measured from the GPS trace after dropping bad
-- fixes and impossible speeds, and only for runs that:
--   - finished server processing (a result exists),
--   - were not flagged (mock location earns a `flagged` result worth nothing),
--   - and passed the run integrity checks and are not excluded by the runner.
-- A claim made before the run is processed returns 0 PACE; the app keeps the
-- mission unclaimed and retries, so nothing is lost, only delayed.
--
-- Territory missions already read territory_polygons, which only the server writes.
-- Leaderboards already skip runs with integrity_status flagged or excluded; their
-- distance is still the runner's recorded distance (rank, not money).
-- ============================================================

CREATE OR REPLACE FUNCTION public.mission_completed_today(p_user_id uuid, p_title text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today       date := (now() AT TIME ZONE 'UTC')::date;
  v_distance_m  numeric;
  v_territories int;
  v_streak_days int;
BEGIN
  SELECT COALESCE(SUM((rp.result ->> 'verifiedDistanceKm')::numeric * 1000), 0) INTO v_distance_m
    FROM public.runs r
    JOIN public.run_processing rp ON rp.run_id = r.id
   WHERE r.user_id = p_user_id
     AND (r.started_at AT TIME ZONE 'UTC')::date = v_today
     AND rp.result IS NOT NULL
     AND rp.result ->> 'flagged' IS NULL
     AND NOT r.excluded
     AND r.integrity_status IN ('ok', 'cleared');

  SELECT COUNT(*) INTO v_territories
    FROM public.territory_polygons
    WHERE owner_id = p_user_id AND (claimed_at AT TIME ZONE 'UTC')::date = v_today;

  v_streak_days := public.nutrition_streak_days(p_user_id);

  RETURN CASE p_title
    WHEN 'Morning Miles'   THEN v_distance_m  >= 1000
    WHEN 'Calorie Crusher' THEN v_distance_m  >= 2000
    WHEN 'Steady State'    THEN v_distance_m  >= 1500
    WHEN 'Push Further'    THEN v_distance_m  >= 3000
    WHEN 'Fat Burn Zone'   THEN v_distance_m  >= 4000
    WHEN 'Endurance Test'  THEN v_distance_m  >= 5000
    WHEN 'Long Haul'       THEN v_distance_m  >= 8000
    WHEN 'Land Grab'       THEN v_territories >= 1
    WHEN 'Territorial'     THEN v_territories >= 3
    WHEN 'Empire Builder'  THEN v_territories >= 5
    WHEN 'Fuel Right'      THEN v_streak_days >= 5
    ELSE false
  END;
END;
$$;

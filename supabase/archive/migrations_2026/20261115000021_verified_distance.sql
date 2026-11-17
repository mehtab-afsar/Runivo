-- Leaderboards, missions, challenges and awards count server-checked distance
-- (security audit H4).
--
-- They summed runs.distance_m, which the phone writes. The insert trigger
-- checks it against the GPS trace, but the trace comes from the phone too.
-- process-run-territory recomputes the distance from the trace with the speed
-- and teleport rules, refuses mock-location runs, and checks the trace against
-- the stored run; that number is now stored in runs.verified_distance_m, which
-- only the server can write. Everything that pays PACE, a reward or a badge, or
-- ranks runners, counts that column instead. A run the server has not scored
-- yet (offline) counts once it is scored.
--
-- Personal views (your own history, Year in Runivo, the weekly digest) keep the
-- recorded distance.
--
-- "Fuel Right" (nutrition) can't be checked against anything, but it could be
-- backfilled: five days of meals logged in one go. Meals now count only on the
-- day they were logged (with a day of slack for time zones and offline sync),
-- and logged_at is set by the server.

ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS verified_distance_m numeric;

-- Existing history: the scored distance where the server scored it, otherwise
-- the recorded distance (checked by the insert trigger), so all-time boards
-- keep their history. Mock-location runs scored 0.
UPDATE public.runs r SET verified_distance_m = COALESCE(
    (SELECT (rp.result ->> 'verifiedDistanceKm')::numeric * 1000 FROM public.run_processing rp WHERE rp.run_id = r.id),
    r.distance_m)
 WHERE r.verified_distance_m IS NULL;

CREATE OR REPLACE FUNCTION public.protect_verified_distance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND current_setting('runivo.integrity_writer', true) IS DISTINCT FROM 'on' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.verified_distance_m := NULL;
    ELSE
      NEW.verified_distance_m := OLD.verified_distance_m;
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_verified_distance() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS runs_a_protect_verified_distance ON public.runs;
CREATE TRIGGER runs_a_protect_verified_distance
  BEFORE INSERT OR UPDATE ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.protect_verified_distance();

CREATE INDEX IF NOT EXISTS idx_runs_user_started_verified ON public.runs (user_id, started_at) WHERE verified_distance_m IS NOT NULL;

-- Meals count on the day they were logged.
CREATE OR REPLACE FUNCTION public.nutrition_logged_now()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.logged_at := now();
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.nutrition_logged_now() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS nutrition_logs_logged_now ON public.nutrition_logs;
CREATE TRIGGER nutrition_logs_logged_now
  BEFORE INSERT ON public.nutrition_logs
  FOR EACH ROW EXECUTE FUNCTION public.nutrition_logged_now();

CREATE OR REPLACE FUNCTION public.nutrition_streak_days(p_user_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::int FROM (
    SELECT log_date
    FROM public.nutrition_logs
    WHERE user_id = p_user_id
      AND log_date > (now() AT TIME ZONE 'UTC')::date - INTERVAL '7 days'
      AND log_date <= (now() AT TIME ZONE 'UTC')::date
      -- logged on the day (one day of slack either side), not backfilled later
      AND logged_at >= log_date - INTERVAL '1 day'
      AND logged_at <  log_date + INTERVAL '2 days'
    GROUP BY log_date
    HAVING COUNT(DISTINCT meal) >= 3
  ) AS qualifying_days
$function$;

-- ── Counting server-checked distance ──

CREATE OR REPLACE FUNCTION public.get_own_distance_rank(p_user_id uuid, p_cutoff timestamp with time zone)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT (COUNT(*) + 1)::int
  FROM (
    SELECT user_id, SUM(verified_distance_m) AS total
    FROM public.runs
    WHERE started_at >= p_cutoff AND COALESCE(activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike', 'wheelchair', 'stroller']) AND NOT excluded AND integrity_status IN ('ok', 'cleared')
    GROUP BY user_id
  ) totals
  WHERE totals.total > COALESCE((
    SELECT SUM(verified_distance_m) FROM public.runs
    WHERE user_id = p_user_id AND started_at >= p_cutoff AND COALESCE(activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike', 'wheelchair', 'stroller']) AND NOT excluded AND integrity_status IN ('ok', 'cleared')
  ), 0);
$function$
;

CREATE OR REPLACE FUNCTION public.get_run_km_by_user(p_cutoff timestamp with time zone)
 RETURNS TABLE(user_id uuid, total_km numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT r.user_id, COALESCE(SUM(r.verified_distance_m) / 1000.0, 0)::numeric
  FROM public.runs r
  WHERE r.started_at >= p_cutoff
  GROUP BY r.user_id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_run_km_by_user(p_cutoff timestamp with time zone, p_limit integer DEFAULT 100)
 RETURNS TABLE(user_id uuid, total_km numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT r.user_id, COALESCE(SUM(r.verified_distance_m) / 1000.0, 0)::numeric AS total_km
  FROM public.runs r
  WHERE r.started_at >= p_cutoff
    AND COALESCE(r.activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike'])
    AND NOT r.excluded
    AND r.integrity_status IN ('ok', 'cleared')
  GROUP BY r.user_id
  ORDER BY total_km DESC
  LIMIT p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.group_challenge_progress(p_challenge uuid)
 RETURNS TABLE(user_id uuid, username text, avatar_color text, status text, progress numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.user_id, p.username, p.avatar_color, m.status,
    CASE c.metric
      WHEN 'distance_km' THEN COALESCE((SELECT round(sum(r.verified_distance_m) / 1000.0, 1) FROM runs r
             WHERE r.user_id = m.user_id AND NOT COALESCE(r.excluded, false)
               AND r.started_at BETWEEN c.starts_at AND c.ends_at), 0)
      WHEN 'active_days' THEN COALESCE((SELECT count(DISTINCT (r.started_at AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date) FROM runs r
             WHERE r.user_id = m.user_id AND NOT COALESCE(r.excluded, false) AND r.verified_distance_m > 0
               AND r.started_at BETWEEN c.starts_at AND c.ends_at), 0)
      ELSE COALESCE((SELECT count(*) FROM zone_events e
             WHERE e.user_id = m.user_id AND e.kind IN ('claimed', 'stolen')
               AND e.at BETWEEN c.starts_at AND c.ends_at), 0)
    END
  FROM group_challenges c
  JOIN group_challenge_members m ON m.challenge_id = c.id
  JOIN profiles p ON p.id = m.user_id
  WHERE c.id = p_challenge
    AND EXISTS (SELECT 1 FROM group_challenge_members me WHERE me.challenge_id = c.id AND me.user_id = auth.uid())
    AND m.status <> 'declined'
  ORDER BY 5 DESC, p.username;
$function$
;

CREATE OR REPLACE FUNCTION public.leaderboard_values_all(p_metric text, p_period text)
 RETURNS TABLE(user_id uuid, value numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH b AS (SELECT public.leaderboard_period_start(p_period) AS since)
  SELECT r.user_id, SUM(r.verified_distance_m) / 1000.0
    FROM public.runs r, b
   WHERE p_metric = 'distance'
     AND r.started_at >= b.since
     AND COALESCE(r.activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike', 'wheelchair', 'stroller'])
     AND NOT r.excluded
     AND r.integrity_status IN ('ok', 'cleared')
   GROUP BY r.user_id
  HAVING SUM(r.verified_distance_m) > 0
  UNION ALL
  SELECT a.user_id, SUM(a.credited)::numeric
    FROM public.pace_awards a, b
   WHERE p_metric = 'pace' AND p_period <> 'all' AND a.created_at >= b.since
   GROUP BY a.user_id
  HAVING SUM(a.credited) > 0
  UNION ALL
  SELECT p.id, p.pace_total_earned::numeric
    FROM public.profiles p
   WHERE p_metric = 'pace' AND p_period = 'all' AND COALESCE(p.pace_total_earned, 0) > 0
  UNION ALL
  SELECT t.owner_id, SUM(t.area_m2)::numeric
    FROM public.territory_polygons t, b
   WHERE p_metric = 'territory' AND p_period <> 'all' AND t.claimed_at >= b.since
   GROUP BY t.owner_id
  HAVING SUM(t.area_m2) > 0
  UNION ALL
  SELECT p.id, p.territory_score::numeric
    FROM public.profiles p
   WHERE p_metric = 'territory' AND p_period = 'all' AND COALESCE(p.territory_score, 0) > 0;
$function$
;

CREATE OR REPLACE FUNCTION public.mission_completed_today(p_user_id uuid, p_title text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today       date := (now() AT TIME ZONE 'UTC')::date;
  v_distance_m  numeric;
  v_territories int;
  v_streak_days int;
BEGIN
  -- verified_distance_m is 0 until the server has processed the run and for
  -- flagged (mock-location) runs, which covers 20261115000018's processed and
  -- not-flagged checks; its integrity filters stay.
  SELECT COALESCE(SUM(verified_distance_m), 0) INTO v_distance_m
    FROM public.runs
    WHERE user_id = p_user_id AND (started_at AT TIME ZONE 'UTC')::date = v_today
      AND NOT excluded
      AND integrity_status IN ('ok', 'cleared');

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
    ELSE false -- capture_enemy / speed_run / defend_zone / steal_rival / unknown titles: no server signal yet
  END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sponsored_progress(p_challenge uuid, p_user uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE c.metric
    WHEN 'distance_km' THEN COALESCE((SELECT round(sum(r.verified_distance_m) / 1000.0, 1) FROM runs r
           WHERE r.user_id = p_user AND NOT COALESCE(r.excluded, false)
             AND COALESCE(r.activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike', 'wheelchair', 'stroller'])
             AND r.started_at BETWEEN GREATEST(c.starts_at, e.joined_at) AND c.ends_at), 0)
    WHEN 'active_days' THEN COALESCE((SELECT count(DISTINCT r.started_at::date) FROM runs r
           WHERE r.user_id = p_user AND NOT COALESCE(r.excluded, false) AND r.verified_distance_m > 0
             AND r.started_at BETWEEN GREATEST(c.starts_at, e.joined_at) AND c.ends_at), 0)
    ELSE COALESCE((SELECT count(*) FROM zone_events z
           WHERE z.user_id = p_user AND z.kind IN ('claimed', 'stolen')
             AND z.at BETWEEN GREATEST(c.starts_at, e.joined_at) AND c.ends_at), 0)
  END
  FROM sponsored_challenges c
  JOIN sponsored_challenge_entries e ON e.challenge_id = c.id AND e.user_id = p_user
  WHERE c.id = p_challenge;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_user_awards(p_user_id uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_total_km       FLOAT8;
  v_best_run_km    FLOAT8;
  v_month_km       FLOAT8;
  v_early_count    INT;
  v_streak_days    INT;
  v_pace_total     INT;
  v_runner_rank    TEXT;
  v_owns_any       BOOLEAN;
  v_owns_district  BOOLEAN;
  v_owns_quarter   BOOLEAN;
  v_owns_domain    BOOLEAN;
  v_owns_loop_fill BOOLEAN;
  v_territory_area FLOAT8;
  v_candidate      TEXT;
  v_granted        TEXT[] := '{}';
BEGIN
  SELECT COALESCE(SUM(verified_distance_m), 0) / 1000.0, COALESCE(MAX(verified_distance_m), 0) / 1000.0
    INTO v_total_km, v_best_run_km
    FROM runs WHERE user_id = p_user_id AND activity_type = 'run';

  SELECT COALESCE(MAX(month_km), 0) INTO v_month_km FROM (
    SELECT SUM(verified_distance_m) / 1000.0 AS month_km
    FROM runs WHERE user_id = p_user_id AND activity_type = 'run'
    GROUP BY date_trunc('month', started_at)
  ) months;

  -- UTC hour, not the runner's local time (the server has no notion of it —
  -- same caveat already documented for streak crediting in process-run-territory).
  SELECT COUNT(*) INTO v_early_count
    FROM runs
    WHERE user_id = p_user_id AND activity_type = 'run'
      AND EXTRACT(HOUR FROM started_at AT TIME ZONE 'utc') < 6;

  SELECT streak_days, pace_total_earned, runner_rank
    INTO v_streak_days, v_pace_total, v_runner_rank
    FROM profiles WHERE id = p_user_id;

  SELECT
    bool_or(TRUE),
    bool_or(tier IN ('district', 'quarter', 'domain')),
    bool_or(tier IN ('quarter', 'domain')),
    bool_or(tier = 'domain'),
    bool_or(is_loop_fill),
    COALESCE(SUM(area_m2), 0)
  INTO v_owns_any, v_owns_district, v_owns_quarter, v_owns_domain, v_owns_loop_fill, v_territory_area
  FROM territory_polygons WHERE owner_id = p_user_id;

  FOR v_candidate IN
    SELECT unnest(ARRAY[
      CASE WHEN v_owns_any                                  THEN 'first_claim' END,
      CASE WHEN v_owns_district                             THEN 'district_owner' END,
      CASE WHEN v_owns_quarter                              THEN 'quarter_owner' END,
      CASE WHEN v_owns_domain                                THEN 'domain_lord' END,
      CASE WHEN v_owns_loop_fill                             THEN 'park_capture' END,
      CASE WHEN v_territory_area >= 500000                   THEN 'city_builder' END,
      CASE WHEN v_runner_rank = 'sovereign' OR v_pace_total >= 4000 THEN 'sovereign_rank' END,
      CASE WHEN v_best_run_km >= 5                           THEN 'first_5k' END,
      CASE WHEN v_best_run_km >= 10                          THEN 'first_10k' END,
      CASE WHEN v_best_run_km >= 21                          THEN 'first_halfmarathon' END,
      CASE WHEN v_total_km >= 100                            THEN 'km_100' END,
      CASE WHEN v_total_km >= 500                            THEN 'km_500' END,
      CASE WHEN v_total_km >= 1000                           THEN 'km_1000' END,
      CASE WHEN v_month_km >= 100                            THEN 'monthly_100' END,
      CASE WHEN v_streak_days >= 7                           THEN 'streak_7' END,
      CASE WHEN v_streak_days >= 30                          THEN 'streak_30' END,
      CASE WHEN v_early_count >= 5                           THEN 'early_bird' END
    ])
  LOOP
    CONTINUE WHEN v_candidate IS NULL;
    INSERT INTO user_awards (user_id, award_id) VALUES (p_user_id, v_candidate)
      ON CONFLICT (user_id, award_id) DO NOTHING;
    IF FOUND THEN
      v_granted := array_append(v_granted, v_candidate);
    END IF;
  END LOOP;

  RETURN v_granted;
END;
$function$
;


CREATE OR REPLACE VIEW public.leaderboard_weekly AS
SELECT p.id,
    p.username,
    p.avatar_url,
    p.runner_rank,
    p.territory_score,
    p.pace_weekly_earned AS weekly_pace,
    (COALESCE((sum(r.verified_distance_m) / 1000.0), (0)::numeric))::numeric(10,3) AS weekly_km,
    (COALESCE(sum(cardinality(r.territories_claimed)), (0)::bigint))::integer AS weekly_territories,
    (dense_rank() OVER (ORDER BY p.territory_score DESC))::integer AS rank,
    p.country
   FROM (profiles p
     LEFT JOIN runs r ON (((r.user_id = p.id) AND (r.started_at >= date_trunc('week'::text, (now() AT TIME ZONE 'utc'::text))) AND (COALESCE(r.activity_type, 'run'::text) = ANY (ARRAY['run'::text, 'trail_run'::text, 'trail'::text, 'walk'::text, 'hike'::text, 'wheelchair'::text, 'stroller'::text])) AND (NOT r.excluded) AND (r.integrity_status = ANY (ARRAY['ok'::text, 'cleared'::text])))))
  GROUP BY p.id, p.username, p.avatar_url, p.runner_rank, p.territory_score, p.pace_weekly_earned, p.country;

-- ============================================================
-- Leaderboards: one ranked source for every metric and period
-- ============================================================
-- Before this, "This month" on the Territory and PACE boards sorted lifetime
-- totals (so it equalled "All time"), "month" was a rolling 30 days, the
-- month/all-time distance board added rides to running distance, and the
-- runner's own row was ranked globally even in National scope.
--
-- Periods are calendar periods in UTC, the same week the PACE cap uses:
--   week  = since Monday 00:00 UTC
--   month = since the 1st 00:00 UTC
--   all   = everything
-- Metrics:
--   distance  = km of on-foot activities (run, trail run, walk, hike); rides never count
--   pace      = PACE credited by the ledger in the period; all time = lifetime PACE
--   territory = m² of ground claimed in the period and still held; all time = territory score

CREATE OR REPLACE FUNCTION public.leaderboard_period_start(p_period text)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT CASE p_period
    WHEN 'week'  THEN date_trunc('week',  now() AT TIME ZONE 'utc') AT TIME ZONE 'utc'
    WHEN 'month' THEN date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc'
    ELSE '-infinity'::timestamptz
  END;
$$;

-- Every runner's value for one metric and period (only values above zero).
CREATE OR REPLACE FUNCTION public.leaderboard_values(p_metric text, p_period text)
RETURNS TABLE(user_id uuid, value numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH b AS (SELECT public.leaderboard_period_start(p_period) AS since)
  SELECT r.user_id, SUM(r.distance_m) / 1000.0
    FROM public.runs r, b
   WHERE p_metric = 'distance'
     AND r.started_at >= b.since
     AND COALESCE(r.activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike'])
   GROUP BY r.user_id
  HAVING SUM(r.distance_m) > 0
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
$$;

REVOKE ALL ON FUNCTION public.leaderboard_values(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leaderboard_values(text, text) FROM authenticated;

CREATE OR REPLACE FUNCTION public.leaderboard_check_args(p_metric text, p_period text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_metric NOT IN ('distance', 'pace', 'territory') THEN
    RAISE EXCEPTION 'metric must be distance, pace or territory' USING ERRCODE = '22023';
  END IF;
  IF p_period NOT IN ('week', 'month', 'all') THEN
    RAISE EXCEPTION 'period must be week, month or all' USING ERRCODE = '22023';
  END IF;
END;
$$;

-- The top of a board. Ranks are counted after the country filter, ties share a rank.
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_metric  text,
  p_period  text,
  p_country text DEFAULT NULL,
  p_limit   integer DEFAULT 100
)
RETURNS TABLE(user_id uuid, username text, runner_rank text, country text, value numeric, rank integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.leaderboard_check_args(p_metric, p_period);
  RETURN QUERY
  SELECT v.user_id, pr.username, COALESCE(pr.runner_rank, 'pacer'), pr.country,
         round(v.value, 1),
         (rank() OVER (ORDER BY v.value DESC))::integer
    FROM public.leaderboard_values(p_metric, p_period) v
    JOIN public.profiles pr ON pr.id = v.user_id
   WHERE p_country IS NULL OR pr.country = p_country
   ORDER BY v.value DESC, pr.username
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);
END;
$$;

-- The signed-in runner's own value and rank on that board (same filter).
CREATE OR REPLACE FUNCTION public.get_my_leaderboard_rank(
  p_metric  text,
  p_period  text,
  p_country text DEFAULT NULL
)
RETURNS TABLE(value numeric, rank integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_val numeric;
BEGIN
  PERFORM public.leaderboard_check_args(p_metric, p_period);
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT v.value INTO v_val FROM public.leaderboard_values(p_metric, p_period) v WHERE v.user_id = v_uid;
  IF v_val IS NULL THEN
    RETURN QUERY SELECT 0::numeric, NULL::integer;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT round(v_val, 1),
         (1 + COUNT(*))::integer
    FROM public.leaderboard_values(p_metric, p_period) v
    JOIN public.profiles pr ON pr.id = v.user_id
   WHERE v.value > v_val
     AND (p_country IS NULL OR pr.country = p_country);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_leaderboard_rank(text, text, text) TO authenticated;

-- The old distance RPCs stay for older app versions, now on-foot only too.
CREATE OR REPLACE FUNCTION public.get_run_km_by_user(p_cutoff timestamptz, p_limit int DEFAULT 100)
RETURNS TABLE(user_id uuid, total_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.user_id, COALESCE(SUM(r.distance_m) / 1000.0, 0)::numeric AS total_km
  FROM public.runs r
  WHERE r.started_at >= p_cutoff
    AND COALESCE(r.activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike'])
  GROUP BY r.user_id
  ORDER BY total_km DESC
  LIMIT p_limit;
$$;

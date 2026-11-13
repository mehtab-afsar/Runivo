-- ============================================================
-- Year in Runivo (PRD P6): one runner's year, for the recap and share card.
-- On-foot activities only, "Don't count this" runs left out, calendar year
-- in UTC. Zones claimed come from the runner's run posts; steals from their
-- conquest and attack posts; PACE from the ledger.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_year_in_runivo(p_year integer)
RETURNS TABLE(
  activities integer, km numeric, hours numeric, longest_km numeric, active_days integer,
  zones_claimed integer, pace_earned integer,
  biggest_steal_m2 numeric, biggest_steal_from text, times_stolen_from integer,
  biggest_zone_m2 numeric, best_month integer, best_month_km numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_from timestamptz := make_timestamptz(p_year, 1, 1, 0, 0, 0, 'UTC');
  v_to   timestamptz := make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'UTC');
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH r AS (
    SELECT distance_m, duration_sec, started_at FROM public.runs
     WHERE user_id = v_uid AND started_at >= v_from AND started_at < v_to
       AND COALESCE(activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike'])
       AND NOT excluded
  ), m AS (
    SELECT extract(month FROM started_at)::int AS mo, sum(distance_m) / 1000.0 AS mkm FROM r GROUP BY 1 ORDER BY 2 DESC LIMIT 1
  ), steal AS (
    SELECT stolen_area_m2, stolen_from_username FROM public.feed_posts
     WHERE user_id = v_uid AND post_type = 'conquest' AND created_at >= v_from AND created_at < v_to
     ORDER BY stolen_area_m2 DESC NULLS LAST LIMIT 1
  )
  SELECT
    (SELECT count(*)::int FROM r),
    round(COALESCE((SELECT sum(distance_m) FROM r), 0) / 1000.0, 1),
    round(COALESCE((SELECT sum(duration_sec) FROM r), 0) / 3600.0, 1),
    round(COALESCE((SELECT max(distance_m) FROM r), 0) / 1000.0, 2),
    (SELECT count(DISTINCT started_at::date)::int FROM r),
    COALESCE((SELECT sum(territories_claimed)::int FROM public.feed_posts
               WHERE user_id = v_uid AND post_type = 'run' AND created_at >= v_from AND created_at < v_to), 0),
    COALESCE((SELECT sum(credited)::int FROM public.pace_awards
               WHERE user_id = v_uid AND created_at >= v_from AND created_at < v_to), 0),
    (SELECT round(stolen_area_m2::numeric) FROM steal),
    (SELECT stolen_from_username FROM steal),
    (SELECT count(*)::int FROM public.feed_posts
      WHERE user_id = v_uid AND post_type = 'attack' AND created_at >= v_from AND created_at < v_to),
    (SELECT round(max(area_m2)::numeric) FROM public.territory_polygons WHERE owner_id = v_uid),
    (SELECT mo FROM m),
    (SELECT round(mkm::numeric, 1) FROM m);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_year_in_runivo(integer) TO authenticated;

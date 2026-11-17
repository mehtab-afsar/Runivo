-- ============================================================
-- City and neighbourhood boards (PRD B4)
-- ============================================================
-- Ranks runners whose last known location is within p_radius_km of the
-- viewer's own last known location (10 km ≈ city, 2 km ≈ neighbourhood).
-- Same metrics and periods as get_leaderboard; blocked and muted runners
-- left out. Nobody's location is returned, only rank and value.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_local_leaderboard(
  p_metric    text,
  p_period    text,
  p_radius_km double precision DEFAULT 10,
  p_limit     integer DEFAULT 100
)
RETURNS TABLE(user_id uuid, username text, runner_rank text, value numeric, rank integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_at  geometry;
BEGIN
  PERFORM public.leaderboard_check_args(p_metric, p_period);
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT last_known_location INTO v_at FROM public.profiles WHERE id = v_uid;
  IF v_at IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT v.user_id, pr.username, COALESCE(pr.runner_rank, 'pacer'), round(v.value, 1),
         (rank() OVER (ORDER BY v.value DESC))::integer
    FROM public.leaderboard_values(p_metric, p_period) v
    JOIN public.profiles pr ON pr.id = v.user_id
   WHERE pr.last_known_location IS NOT NULL
     AND ST_DWithin(pr.last_known_location::geography, v_at::geography, LEAST(GREATEST(COALESCE(p_radius_km, 10), 0.5), 50) * 1000)
     AND (v.user_id = v_uid OR v.user_id NOT IN (SELECT public.hidden_user_ids(v_uid)))
   ORDER BY v.value DESC, pr.username
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_local_leaderboard(text, text, double precision, integer) TO authenticated;

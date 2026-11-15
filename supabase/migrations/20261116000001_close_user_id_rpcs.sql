-- Close RPCs that took a user id and trusted it (Nov 2026 re-check, finding H2),
-- and hide the placeholder store reward (no mock data in the store).
--
-- 1. get_profile_stats(p_user_id, p_period) and get_consistency_history(p_user_id, p_weeks)
--    are SECURITY DEFINER and were callable by anyone with the public key. They read
--    runs / weekly_consistency of ANY user, past the runs RLS and the profile
--    visibility setting.
--      - get_profile_stats: kept callable (the profile screen shows other runners),
--        but only for a profile the caller may view (can_view_profile: self, public,
--        or follower of a followers-only profile, and not blocked), or the service role.
--      - get_consistency_history: private training data; own rows or service role only
--        (the ai-coach function calls it with the service key).
-- 2. Server-side helpers with no client caller are revoked from the public roles.
--    Other SECURITY DEFINER functions still reach them (they run as the owner).
-- 3. get_run_km_by_user (both overloads) has no caller anywhere and returned every
--    runner's km regardless of hide_from_leaderboards. Dropped.
-- 4. The "Brooks 20% off" reward seeded by 20260518000069 was a placeholder that
--    nobody honours. It is hidden unless a partner is attached to it.

-- ── 1a. get_profile_stats ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_profile_stats(
  p_user_id UUID,
  p_period  TEXT DEFAULT 'all'
) RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_vis    TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    SELECT profile_visibility INTO v_vis FROM public.profiles WHERE id = p_user_id;
    IF NOT FOUND OR NOT public.can_view_profile(auth.uid(), p_user_id, v_vis) THEN
      RETURN json_build_object(
        'totalKm', 0, 'totalRuns', 0, 'avgPaceSec', 0, 'totalCalories', 0, 'totalZones', 0
      );
    END IF;
  END IF;

  v_cutoff := CASE p_period
    WHEN 'week'  THEN date_trunc('week',  now() AT TIME ZONE 'utc')
    WHEN 'month' THEN date_trunc('month', now() AT TIME ZONE 'utc')
    WHEN 'year'  THEN date_trunc('year',  now() AT TIME ZONE 'utc')
    ELSE '1970-01-01'::TIMESTAMPTZ
  END;
  RETURN (
    SELECT json_build_object(
      'totalKm',       COALESCE(SUM(distance_m) / 1000.0, 0),
      'totalRuns',     COUNT(*),
      'avgPaceSec',    COALESCE(AVG(NULLIF(duration_sec::FLOAT / NULLIF(distance_m / 1000.0, 0), 0)), 0)::INT,
      'totalCalories', COALESCE(SUM(calories_burned), 0),
      'totalZones',    COALESCE(SUM(CARDINALITY(territories_claimed)), 0)
    )
    FROM public.runs
    WHERE user_id = p_user_id AND started_at >= v_cutoff
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_profile_stats(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_stats(UUID, TEXT) TO authenticated, service_role;

-- ── 1b. get_consistency_history ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_consistency_history(
  p_user_id UUID,
  p_weeks   INT DEFAULT 8
)
RETURNS TABLE(
  week_start          DATE,
  consistency_score   INT,
  sessions_completed  INT,
  sessions_planned    INT,
  km_actual           FLOAT8,
  streak_days_eow     INT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT wc.week_start, wc.consistency_score, wc.sessions_completed,
         wc.sessions_planned, wc.km_actual, wc.streak_days_eow
    FROM public.weekly_consistency wc
   WHERE wc.user_id = p_user_id
     AND (auth.role() = 'service_role' OR p_user_id = auth.uid())
   ORDER BY wc.week_start DESC
   LIMIT LEAST(GREATEST(p_weeks, 1), 52);
$$;
REVOKE ALL ON FUNCTION public.get_consistency_history(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_consistency_history(UUID, INT) TO authenticated, service_role;

-- ── 2. Helpers with no client caller ─────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('nutrition_streak_days', 'get_own_distance_rank',
                         'mission_completed_today', 'sponsored_progress')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- ── 3. Unused all-runners km dump ────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_run_km_by_user(timestamptz);
DROP FUNCTION IF EXISTS public.get_run_km_by_user(timestamptz, integer);

-- ── 4. Placeholder reward ────────────────────────────────────────────────────
UPDATE public.pace_store_rewards
   SET status = 'hidden'
 WHERE brand = 'Brooks'
   AND title = '20% off Brooks Running'
   AND partner_id IS NULL;

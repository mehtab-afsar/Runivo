-- ============================================================
-- P0-2: Stop leaking every user's raw GPS traces (PII)
-- ============================================================
-- runs.gps_points holds raw [{lat,lng,timestamp,...}] for every run, and the runs
-- SELECT policy (20260301000002_social.sql:104) was `using (true)` — so any
-- authenticated user could read anyone's exact routes (home, work, daily schedule).
-- Scope runs SELECT to the owner.
--
-- The only thing that read the runs table cross-user was the leaderboard's
-- month/all-time km column (apps/mobile/src/features/leaderboard/services/
-- leaderboardService.ts), which needs only aggregate distance — never coordinates.
-- We replace that access with a SECURITY DEFINER RPC that returns per-user km sums
-- and nothing sensitive. Everything else is already safe:
--   • the WEEKLY leaderboard uses the leaderboard_weekly view (owner-privileged,
--     bypasses RLS, selects no gps_points);
--   • the social feed uses feed_posts.route_points, not runs;
--   • coach / pullRuns read only the caller's own runs (`.eq('user_id', me)`).

DROP POLICY IF EXISTS "runs: anyone can read" ON public.runs;

CREATE POLICY "runs: owner can read"
  ON public.runs FOR SELECT
  USING (auth.uid() = user_id);

-- Aggregate-only, coordinate-free km totals per user since a cutoff, for the
-- month/all-time leaderboard distance tab. SECURITY DEFINER so it can aggregate
-- across users without exposing any row (and never returns gps_points).
CREATE OR REPLACE FUNCTION public.get_run_km_by_user(p_cutoff timestamptz)
RETURNS TABLE(user_id uuid, total_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.user_id, COALESCE(SUM(r.distance_m) / 1000.0, 0)::numeric
  FROM public.runs r
  WHERE r.started_at >= p_cutoff
  GROUP BY r.user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_run_km_by_user(timestamptz) TO authenticated;

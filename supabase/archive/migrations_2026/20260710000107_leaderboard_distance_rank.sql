-- ============================================================
-- H14/M13/M14: leaderboard distance ranking, bounded queries, own-rank fallback
-- ============================================================
-- get_run_km_by_user (20260701000076) returned every user's aggregate km
-- unbounded — the client fetched the whole result to sort/limit itself (M13).
-- Add ordering + a limit so the top-N comes back pre-sorted from the database.
--
-- get_own_distance_rank lets the client show the caller's real rank even when
-- they're outside the fetched top-N (M14), without transferring every other
-- user's row to compute it — it's a single aggregate count.

CREATE OR REPLACE FUNCTION public.get_run_km_by_user(p_cutoff timestamptz, p_limit int DEFAULT 100)
RETURNS TABLE(user_id uuid, total_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.user_id, COALESCE(SUM(r.distance_m) / 1000.0, 0)::numeric AS total_km
  FROM public.runs r
  WHERE r.started_at >= p_cutoff
  GROUP BY r.user_id
  ORDER BY total_km DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_run_km_by_user(timestamptz, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_own_distance_rank(p_user_id uuid, p_cutoff timestamptz)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (COUNT(*) + 1)::int
  FROM (
    SELECT user_id, SUM(distance_m) AS total
    FROM public.runs
    WHERE started_at >= p_cutoff
    GROUP BY user_id
  ) totals
  WHERE totals.total > COALESCE((
    SELECT SUM(distance_m) FROM public.runs
    WHERE user_id = p_user_id AND started_at >= p_cutoff
  ), 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_own_distance_rank(uuid, timestamptz) TO authenticated;

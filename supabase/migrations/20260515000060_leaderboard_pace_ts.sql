-- ============================================================
-- Migration 060: Leaderboard — replace XP sort with Territory Score + PACE
-- ============================================================
-- The old leaderboard_weekly view sorted by sum(runs.xp_earned).
-- xp_earned is hardcoded 0 on all new runs — the leaderboard was useless.
--
-- New view:
--   • Primary sort: territory_score (from profiles, set by get_territory_score() RPC)
--   • weekly_pace: read directly from profiles.pace_weekly_earned
--   • weekly_km: still aggregated from runs (unchanged)
--   • runner_rank: from profiles (replaces level)
--   • Removes: weekly_xp, level columns
-- ============================================================

-- DROP required because CREATE OR REPLACE cannot rename existing columns (level → runner_rank)
DROP VIEW IF EXISTS public.leaderboard_weekly CASCADE;

CREATE VIEW public.leaderboard_weekly AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.runner_rank,
  p.territory_score,
  p.pace_weekly_earned                                            AS weekly_pace,
  COALESCE(SUM(r.distance_m) / 1000.0, 0)::numeric(10,3)        AS weekly_km,
  COALESCE(SUM(CARDINALITY(r.territories_claimed)), 0)::int      AS weekly_territories,
  DENSE_RANK() OVER (ORDER BY p.territory_score DESC)::int       AS rank
FROM public.profiles p
LEFT JOIN public.runs r
  ON r.user_id = p.id
  AND r.started_at >= date_trunc('week', now() AT TIME ZONE 'utc')
GROUP BY
  p.id, p.username, p.avatar_url, p.runner_rank,
  p.territory_score, p.pace_weekly_earned;

COMMENT ON VIEW public.leaderboard_weekly IS
  'Weekly leaderboard — sorted by territory_score. Recalculated on every query.';

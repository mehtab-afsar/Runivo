-- ============================================================
-- M16: Global/National/Local scope pills were dead — add real National scoping
-- ============================================================
-- profiles.country (20260701000072) is the only geographic column that exists
-- (no city/region), so "Local" has been removed client-side (types.ts) and
-- National now filters by country. Add country to leaderboard_weekly so the
-- weekly view can be filtered without an extra profiles join client-side.
-- CREATE OR REPLACE can append a trailing column without the DROP VIEW dance
-- migration 060 needed (that was for renaming/removing a column).

CREATE OR REPLACE VIEW public.leaderboard_weekly AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.runner_rank,
  p.territory_score,
  p.pace_weekly_earned                                            AS weekly_pace,
  COALESCE(SUM(r.distance_m) / 1000.0, 0)::numeric(10,3)        AS weekly_km,
  COALESCE(SUM(CARDINALITY(r.territories_claimed)), 0)::int      AS weekly_territories,
  DENSE_RANK() OVER (ORDER BY p.territory_score DESC)::int       AS rank,
  p.country
FROM public.profiles p
LEFT JOIN public.runs r
  ON r.user_id = p.id
  AND r.started_at >= date_trunc('week', now() AT TIME ZONE 'utc')
GROUP BY
  p.id, p.username, p.avatar_url, p.runner_rank,
  p.territory_score, p.pace_weekly_earned, p.country;

COMMENT ON VIEW public.leaderboard_weekly IS
  'Weekly leaderboard — sorted by territory_score. Recalculated on every query.';

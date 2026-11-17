-- ============================================================
-- M20: get_profile_stats references a nonexistent column
-- ============================================================
-- runs.distance_m (20260301000002) was referenced as `distance_meters` in
-- get_profile_stats (20260518000067) — the RPC errors on every call, so the
-- profile Stats screen's week/month/year period selector silently falls back
-- to all-time local values regardless of the selected period.

CREATE OR REPLACE FUNCTION get_profile_stats(
  p_user_id UUID,
  p_period  TEXT DEFAULT 'all'
) RETURNS JSON AS $$
DECLARE v_cutoff TIMESTAMPTZ;
BEGIN
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
    FROM runs
    WHERE user_id = p_user_id AND started_at >= v_cutoff
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

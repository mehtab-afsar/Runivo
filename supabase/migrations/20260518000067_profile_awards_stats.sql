-- Awards table
CREATE TABLE IF NOT EXISTS user_awards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  award_id    TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_duplicate_award UNIQUE (user_id, award_id)
);
ALTER TABLE user_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "awards_read_own" ON user_awards FOR SELECT
  USING (user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND is_public = true));
CREATE POLICY "awards_insert_own" ON user_awards FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Pinned run on profile
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pinned_run_id UUID REFERENCES runs(id) ON DELETE SET NULL;

-- Personal records
CREATE TABLE IF NOT EXISTS personal_records (
  user_id         UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  fastest_1k_sec  INT,
  fastest_5k_sec  INT,
  fastest_10k_sec INT,
  longest_run_m   FLOAT8,
  best_pace_sec   INT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pr_read"  ON personal_records FOR SELECT USING (true);
CREATE POLICY "pr_write" ON personal_records FOR ALL  USING (user_id = auth.uid());

-- Profile stats RPC
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
      'totalKm',       COALESCE(SUM(distance_meters) / 1000.0, 0),
      'totalRuns',     COUNT(*),
      'avgPaceSec',    COALESCE(AVG(NULLIF(duration_sec::FLOAT / NULLIF(distance_meters / 1000.0, 0), 0)), 0)::INT,
      'totalCalories', COALESCE(SUM(calories_burned), 0),
      'totalZones',    COALESCE(SUM(CARDINALITY(territories_claimed)), 0)
    )
    FROM runs
    WHERE user_id = p_user_id AND started_at >= v_cutoff
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

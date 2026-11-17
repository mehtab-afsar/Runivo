CREATE TABLE IF NOT EXISTS weekly_consistency (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start          DATE NOT NULL,
  plan_id             UUID REFERENCES training_plans(id) ON DELETE SET NULL,
  sessions_planned    INT NOT NULL DEFAULT 0,
  sessions_completed  INT NOT NULL DEFAULT 0,
  sessions_missed     INT NOT NULL DEFAULT 0,
  km_actual           FLOAT8 NOT NULL DEFAULT 0,
  consistency_score   INT NOT NULL DEFAULT 0,
  streak_days_eow     INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_duplicate_week UNIQUE (user_id, week_start)
);

ALTER TABLE weekly_consistency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wc_own" ON weekly_consistency FOR ALL USING (user_id = auth.uid());

CREATE INDEX wc_user_week ON weekly_consistency (user_id, week_start DESC);

CREATE OR REPLACE FUNCTION get_consistency_history(
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
) AS $$
  SELECT
    week_start, consistency_score, sessions_completed,
    sessions_planned, km_actual, streak_days_eow
  FROM weekly_consistency
  WHERE user_id = p_user_id
  ORDER BY week_start DESC
  LIMIT p_weeks;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

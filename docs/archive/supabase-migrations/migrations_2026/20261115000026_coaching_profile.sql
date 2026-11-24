-- ============================================================
-- What onboarding now asks so PaceX and the plan builder fit the runner:
-- a race (distance, date, goal time), their week (run days, long-run day,
-- usual time, time on a weekday), and their body (niggles, coming back from
-- a break). All optional. profiles is owner-read only, and profiles_public
-- (20261115000022) lists its columns explicitly, so none of this is visible
-- to other runners.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS race_distance        text,
  ADD COLUMN IF NOT EXISTS race_date            date,
  ADD COLUMN IF NOT EXISTS race_goal_seconds    integer,
  ADD COLUMN IF NOT EXISTS run_days             smallint[],
  ADD COLUMN IF NOT EXISTS long_run_day         smallint,
  ADD COLUMN IF NOT EXISTS usual_run_time       text,
  ADD COLUMN IF NOT EXISTS weekday_minutes      smallint,
  ADD COLUMN IF NOT EXISTS niggles              text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS returning_from_break boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_race_distance_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_race_distance_check
  CHECK (race_distance IS NULL OR race_distance IN ('5k', '10k', 'half', 'marathon'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_race_goal_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_race_goal_check
  CHECK (race_goal_seconds IS NULL OR race_goal_seconds BETWEEN 600 AND 36000);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_run_days_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_run_days_check
  CHECK (run_days IS NULL OR (cardinality(run_days) <= 7 AND run_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_long_run_day_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_long_run_day_check
  CHECK (long_run_day IS NULL OR long_run_day BETWEEN 0 AND 6);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_usual_run_time_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_usual_run_time_check
  CHECK (usual_run_time IS NULL OR usual_run_time IN ('early', 'morning', 'evening', 'varies'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_weekday_minutes_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_weekday_minutes_check
  CHECK (weekday_minutes IS NULL OR weekday_minutes BETWEEN 10 AND 240);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_niggles_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_niggles_check
  CHECK (niggles <@ ARRAY['knee', 'shin', 'calf', 'hip', 'foot']::text[]);

COMMENT ON COLUMN public.profiles.run_days IS '0 = Monday … 6 = Sunday, the days the runner said they can run.';
COMMENT ON COLUMN public.profiles.niggles IS 'Self-reported sore spots; plans go cautious and PaceX avoids loading them. Owner-only.';

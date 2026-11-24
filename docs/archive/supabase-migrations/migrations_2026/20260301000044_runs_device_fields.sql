-- Adds wearable-enrichment columns to runs.
-- These are populated by device-webhook when an activity from a
-- paired device (Garmin, Coros, Polar) matches an existing run,
-- or when a run is imported directly from Apple Health.

ALTER TABLE public.runs
  ADD COLUMN IF NOT EXISTS avg_hr           INT,
  ADD COLUMN IF NOT EXISTS max_hr           INT,
  ADD COLUMN IF NOT EXISTS avg_cadence      INT,          -- steps/min (running) or rpm (cycling)
  ADD COLUMN IF NOT EXISTS elevation_gain_m NUMERIC,      -- metres
  ADD COLUMN IF NOT EXISTS hrv_ms           NUMERIC,      -- resting RMSSD in ms
  ADD COLUMN IF NOT EXISTS calories_kcal    INT,
  ADD COLUMN IF NOT EXISTS import_source    TEXT          -- 'apple_health' | 'garmin' | 'coros' | 'polar'
    CHECK (import_source IN ('apple_health', 'garmin', 'coros', 'polar'));

-- Expose to the shoe_stats view / ai-coach query (no schema change needed — view is SELECT *)
COMMENT ON COLUMN public.runs.avg_hr           IS 'Average heart rate in BPM from paired wearable';
COMMENT ON COLUMN public.runs.max_hr           IS 'Peak heart rate in BPM from paired wearable';
COMMENT ON COLUMN public.runs.avg_cadence      IS 'Average step cadence in steps/min';
COMMENT ON COLUMN public.runs.elevation_gain_m IS 'Total elevation gain in metres';
COMMENT ON COLUMN public.runs.hrv_ms           IS 'HRV (RMSSD) at run start for recovery context';
COMMENT ON COLUMN public.runs.calories_kcal    IS 'Active calories burned during run';
COMMENT ON COLUMN public.runs.import_source    IS 'Source platform when run was imported from a device';

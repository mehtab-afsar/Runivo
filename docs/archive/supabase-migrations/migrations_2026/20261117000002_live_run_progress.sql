-- Friend live page (mock "Friend running"): show how far into their run a
-- friend is. The runner's app adds its own distance, moving time and start
-- time to the live row it already shares. Same row, same RLS (mutual follows
-- who share live, fresh within 30 s), so nobody new can see anything.
ALTER TABLE public.live_run_positions
  ADD COLUMN IF NOT EXISTS started_at  timestamptz,
  ADD COLUMN IF NOT EXISTS distance_m  real CHECK (distance_m IS NULL OR distance_m BETWEEN 0 AND 500000),
  ADD COLUMN IF NOT EXISTS elapsed_sec integer CHECK (elapsed_sec IS NULL OR elapsed_sec BETWEEN 0 AND 172800);

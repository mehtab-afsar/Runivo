-- Fix BUG-01/02: Run DELETE does not revert profile stats
-- The insert trigger (trg_sync_profile_run_stats) fires on INSERT only.
-- Adding a DELETE trigger to reverse total_runs and total_distance_km.
-- Note: profiles.xp is client-driven (set via pushProfile, not by trigger),
-- so XP reversal must be handled client-side when deleting a run.

CREATE OR REPLACE FUNCTION public.revert_profile_run_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only revert stats that were counted (stats_synced = true means trigger ran on INSERT)
  IF OLD.stats_synced THEN
    UPDATE public.profiles
    SET
      total_runs        = GREATEST(total_runs - 1, 0),
      total_distance_km = GREATEST(total_distance_km - (OLD.distance_m / 1000.0), 0)
    WHERE id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_revert_profile_run_stats
  AFTER DELETE ON public.runs
  FOR EACH ROW
  EXECUTE FUNCTION public.revert_profile_run_stats();

COMMENT ON FUNCTION public.revert_profile_run_stats IS
  'Reverses total_runs and total_distance_km on run DELETE.
   Only acts when stats_synced=true (confirming the INSERT trigger already counted this run).
   profiles.xp is NOT reversed here — it is client-driven via pushProfile().';

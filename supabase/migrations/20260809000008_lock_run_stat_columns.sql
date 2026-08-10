-- ============================================================
-- Lock total_distance_km / total_runs against client writes
-- ============================================================
-- 20260701000075 deliberately left these two client-writable: the only
-- authoritative writer was sync_profile_run_stats (a BEFORE INSERT trigger on
-- `runs`), which runs inside the CLIENT's own authenticated request — so it
-- could not be told apart from a spoofed profiles UPDATE by
-- protect_profile_columns()'s auth.role() check. clubService.ts's
-- fetchClubMembers ranks members by exactly this column with no server
-- recomputation ever reading it back, so
--   UPDATE profiles SET total_distance_km = 999999 WHERE id = auth.uid()
-- topped every club leaderboard in the app with zero runs behind it.
--
-- Same fix as streak_days (20260722000001): process-run-territory already
-- computes an independent, GPS-derived distance for every run
-- (serverDistanceKm, from accuracy-filtered Haversine) — it now becomes the
-- sole writer of total_distance_km/total_runs too, via this atomic RPC,
-- called with the service_role key. sync_profile_run_stats keeps
-- incrementing them as before; that write is simply reverted by
-- protect_profile_columns() for the non-service-role trigger context, the
-- same way it's already reverted for streak_days — left as dead weight
-- rather than removed here, to keep this migration to the minimum needed to
-- close the hole (see docs/CHANGES.md P0-1 for the follow-up covering the
-- remaining client-writable economy columns: level, xp, coins, energy,
-- total_territories_claimed, runner_rank).

CREATE OR REPLACE FUNCTION public.increment_run_stats(
  p_user_id     uuid,
  p_distance_km numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET total_distance_km = total_distance_km + GREATEST(p_distance_km, 0),
      total_runs        = total_runs + 1
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_run_stats(uuid, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Webhooks / edge functions using the service-role key may change anything.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.subscription_tier       := OLD.subscription_tier;
  NEW.subscription_expires_at := OLD.subscription_expires_at;
  NEW.pace_balance            := OLD.pace_balance;
  NEW.pace_total_earned       := OLD.pace_total_earned;
  NEW.pace_weekly_earned      := OLD.pace_weekly_earned;
  NEW.territory_score         := OLD.territory_score;
  NEW.follower_count          := OLD.follower_count;
  NEW.following_count         := OLD.following_count;
  NEW.streak_days             := OLD.streak_days;
  NEW.last_run_date           := OLD.last_run_date;
  NEW.total_distance_km       := OLD.total_distance_km;
  NEW.total_runs              := OLD.total_runs;

  RETURN NEW;
END;
$$;

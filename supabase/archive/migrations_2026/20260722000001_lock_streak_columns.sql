-- ============================================================
-- Lock streak_days / last_run_date against client writes
-- ============================================================
-- streak_days feeds process-run-territory's PACE streak bonus (+3 PACE every 7th
-- consecutive day) directly. 20260701000075_profiles_column_protection.sql
-- deliberately left streak_days/last_run_date client-writable (offline-first sync
-- of "secondary economy" fields), but that means a client can push an arbitrary
-- streak_days value via the profiles upsert (e.g. any multiple of 7) and farm the
-- streak bonus on every subsequent run indefinitely, with no real streak behind it.
--
-- process-run-territory now computes and persists streak_days/last_run_date
-- server-side (from the profile's own previously-stored last_run_date vs. the
-- current run's UTC date) instead of trusting the client's value — the same
-- pattern already used for pace_balance et al. This migration closes the loop by
-- making that server write the only one that sticks.
--
-- The client still computes and pushes an optimistic streak locally for immediate
-- UI feedback; the push is now silently ignored here and pullProfile() reconciles
-- the authoritative value back, same as every other protected column.

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

  RETURN NEW;
END;
$$;

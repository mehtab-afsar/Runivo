-- ============================================================
-- P0-1: Protect money / server-authoritative columns on profiles
-- ============================================================
-- The profiles UPDATE policy (20260301000001_core_schema.sql:116) is
-- `for update using (auth.uid() = id)` with NO `with check` clause, so any
-- authenticated user, with the public anon key, can
--   UPDATE profiles SET subscription_tier='premium' WHERE id = auth.uid()
-- self-granting premium (and equally faking the leaderboard's sort key or their
-- PACE balance). This trigger silently forces a protected set of columns back to
-- their prior values for any NON-service-role caller.
--
-- Why silent-reset instead of RAISE: it can never break a legitimate client sync
-- (the offline-first client's pushProfile upsert simply has its protected-column
-- values ignored), while still refusing the change. service_role callers (webhooks,
-- the process-run-territory edge function) pass through untouched.
--
-- The locked set is exactly the columns NObody writes from an authenticated-user
-- context, so locking them is provably non-breaking:
--   • subscription_tier / subscription_expires_at — set ONLY by the Stripe/RC
--     webhooks (service_role).
--   • pace_balance / pace_total_earned / pace_weekly_earned — set ONLY by
--     apply_pace_adjustment() (GRANTed to service_role only, called from the
--     process-run-territory edge function). The client no longer pushes them.
--   • territory_score — the leaderboard's primary sort key; get_territory_score()
--     is STABLE (read-only) and NOTHING writes this column, so locking it purely
--     prevents a cheater from being the only party able to set it.
--   • follower_count / following_count — maintained by DB triggers (004_feed.sql);
--     the client never pushes them.
--
-- INTENTIONALLY NOT locked (client-authoritative under the current offline-first
-- design — locking them here would break run sync): level, xp, coins, energy,
-- total_distance_km, total_runs, total_territories_claimed, streak_days, runner_rank.
-- Hardening those requires moving the economy server-side (a separate follow-up —
-- see docs/CHANGES.md P1/P2). The leaderboard SORT (territory_score) and all money
-- columns ARE covered here, so the critical monetization/ranking holes are closed.

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

  RETURN NEW;
END;
$$;

-- Runs before the existing profiles_updated_at trigger alphabetically
-- ("profiles_protect_columns" < "profiles_updated_at"); order is irrelevant here
-- since they touch disjoint columns.
DROP TRIGGER IF EXISTS profiles_protect_columns ON public.profiles;
CREATE TRIGGER profiles_protect_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

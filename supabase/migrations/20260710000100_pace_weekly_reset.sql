-- ============================================================
-- P0: Weekly PACE cap was actually a lifetime cap
-- ============================================================
-- profiles.pace_weekly_earned is only ever incremented by apply_pace_adjustment.
-- Nothing resets it: there is no cron job, and the client's own weekly reset
-- (checkAndResetWeeklyPace in useGameEngine.ts) only zeroes the LOCAL value —
-- the very next pullProfile() after a run overwrites it with the server's
-- ever-growing total. Once a free user accumulates PACE_WEEKLY_CAP_FREE (100)
-- lifetime, remainingCap in process-run-territory is 0 forever and they earn
-- no more PACE, ever.
--
-- Fix: make apply_pace_adjustment week-aware. profiles.pace_weekly_reset_at
-- already exists (20260515000056) and is legitimately client-pushed (it isn't
-- money, just a timestamp) — reuse it as the source of truth for "which week
-- is the accumulator counting". If it's stale (before the current UTC week's
-- Monday), reset pace_weekly_earned to just this delta and bump the reset
-- timestamp; otherwise accumulate as before. No pg_cron dependency — the reset
-- happens lazily on the next PACE-earning run of a new week, which is the only
-- moment the cap is actually checked.

CREATE OR REPLACE FUNCTION apply_pace_adjustment(
  p_user_id    UUID,
  p_pace_delta INT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reset_at   TIMESTAMPTZ;
  v_week_start TIMESTAMPTZ := date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
  SELECT pace_weekly_reset_at INTO v_reset_at FROM profiles WHERE id = p_user_id;

  IF v_reset_at IS NULL OR v_reset_at < v_week_start THEN
    UPDATE profiles
    SET pace_balance         = GREATEST(0, pace_balance + p_pace_delta),
        pace_total_earned    = pace_total_earned + p_pace_delta,
        pace_weekly_earned   = GREATEST(0, p_pace_delta),
        pace_weekly_reset_at = v_week_start
    WHERE id = p_user_id;
  ELSE
    UPDATE profiles
    SET pace_balance       = GREATEST(0, pace_balance + p_pace_delta),
        pace_total_earned  = pace_total_earned + p_pace_delta,
        pace_weekly_earned = pace_weekly_earned + p_pace_delta
    WHERE id = p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_pace_adjustment TO service_role;

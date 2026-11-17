-- Read-only diagnostic for the PACE ledger corruption risk found while tracing the
-- pullProfile() fix: useGameEngine.ts's endRunSession credits PACE onto in-memory
-- player state that's only reloaded from disk on app mount, so a corrupted local
-- balance (from the old pullProfile() bug) could have been pushed back to the server
-- via pushProfile()'s flat upsert, overwriting the correct atomically-incremented
-- server value — for any user who relaunched the app between two runs while the bug
-- was live. PACE Store redemption is not live yet (nothing has ever spent PACE), so
-- pace_balance should equal pace_total_earned for every uncorrupted user today.
--
-- This function WRITES NOTHING — it only reports which profiles look affected and by
-- how much, using SUM(runs.xp_earned) (the repurposed-as-PACE per-run column) as an
-- independent floor. Review the output before deciding whether/how to run a repair.
--
-- Restricted to service_role only (same as apply_pace_adjustment in
-- 20260515000059_territory_engine_rpcs.sql) — NOT gated on
-- `subscription_tier = 'admin'` like pace_store_rewards' admin policy, because
-- 20260301000042_consolidate_tiers.sql's CHECK constraint only allows
-- subscription_tier IN ('free', 'premium'). No profile row can ever be 'admin' under
-- that constraint, so that pattern would make this function permanently uncallable.
-- Run this from the Supabase SQL editor or a service-role script, not from the app.
CREATE OR REPLACE FUNCTION diagnose_pace_ledger()
RETURNS TABLE (
  user_id           UUID,
  username          TEXT,
  pace_balance      INT,
  pace_total_earned INT,
  runs_xp_sum       BIGINT,
  gap               BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.username,
    p.pace_balance,
    p.pace_total_earned,
    COALESCE(r.run_sum, 0) AS runs_xp_sum,
    GREATEST(p.pace_balance, p.pace_total_earned, COALESCE(r.run_sum, 0)) - p.pace_balance AS gap
  FROM public.profiles p
  LEFT JOIN (
    SELECT user_id, SUM(xp_earned) AS run_sum FROM public.runs GROUP BY user_id
  ) r ON r.user_id = p.id
  WHERE GREATEST(p.pace_balance, p.pace_total_earned, COALESCE(r.run_sum, 0)) > p.pace_balance
  ORDER BY gap DESC;
$$;

GRANT EXECUTE ON FUNCTION diagnose_pace_ledger TO service_role;

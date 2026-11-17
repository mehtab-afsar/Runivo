-- ============================================================
-- Server-authoritative mission reward claiming
-- ============================================================
-- The mission system was rearchitected at some point to generate missions
-- entirely client-side, deterministically, from a seeded RNG keyed on the
-- calendar date (packages/shared/src/services/missions.ts generateDailyMissions)
-- — nothing ever populates mission_progress anymore, so the old
-- claim_mission_reward(text, int, int) RPC (migration 027) always returned
-- false (mission_progress row never found) and was confirmed dead: zero
-- callers. The client's actual claim path (missionStore.ts/.native.ts
-- claimMissionReward) instead mutated pace_balance/pace_total_earned/
-- pace_weekly_earned directly on the LOCAL player record — fields that
-- 20260701000075_profiles_column_protection.sql already silently ignores from
-- any non-service-role write, so those "rewards" were purely cosmetic: visible
-- immediately, then silently reverted the next time pullProfile() ran.
--
-- This migration replaces the dead RPC with one that fits how missions are
-- actually generated today: the client passes the mission's id and title (not
-- a reward amount — the old RPC trusted a client-supplied p_xp/p_coins, which
-- was itself a real hole even before it became unreachable); the server looks
-- up the canonical PACE reward for that title, enforces the same weekly cap
-- as every other PACE-earning path, and credits it via the existing
-- apply_pace_adjustment (so this reuses the one already-hardened money path
-- rather than writing profiles directly). A claims ledger makes each mission
-- id claimable exactly once.
--
-- Deliberately NOT attempted here: verifying mission *completion* itself
-- against server-known data (e.g. "did this user really run 3km today").
-- Missions are deterministic from client-visible template data, so this
-- closes the "arbitrary reward amount" and "replay" holes, but a determined
-- attacker could still call this RPC for a mission they didn't actually
-- complete. Real completion verification needs per-mission-type server
-- checks against runs/territories/nutrition_logs — meaningfully larger scope,
-- flagged here as deliberately deferred rather than silently skipped.

DROP FUNCTION IF EXISTS public.claim_mission_reward(text, int, int);

CREATE TABLE IF NOT EXISTS public.mission_claims (
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mission_id  text NOT NULL,
  pace_earned int  NOT NULL DEFAULT 0,
  claimed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, mission_id)
);

ALTER TABLE public.mission_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can read their own mission claims" ON public.mission_claims;
CREATE POLICY "users can read their own mission claims"
  ON public.mission_claims FOR SELECT
  USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policy for authenticated users — RLS default-denies
-- direct writes; only the SECURITY DEFINER claim_mission_reward() below (which
-- runs as its owner, bypassing RLS) can write this table.

-- Canonical mission-title → PACE reward. Mirrors MISSION_TEMPLATES in
-- packages/shared/src/services/missions.ts — if that list changes, this must
-- change with it (there is no single source of truth shared between SQL and
-- TS today; a future pass could generate this from a shared JSON fixture).
CREATE OR REPLACE FUNCTION public.mission_pace_reward(p_title text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_title
    WHEN 'Morning Miles'      THEN 4
    WHEN 'Land Grab'          THEN 5
    WHEN 'Calorie Crusher'    THEN 7
    WHEN 'Steady State'       THEN 6
    WHEN 'Push Further'       THEN 10
    WHEN 'Territorial'        THEN 12
    WHEN 'Hostile Takeover'   THEN 8
    WHEN 'Speed Demon'        THEN 9
    WHEN 'Fat Burn Zone'      THEN 15
    WHEN 'Defend Your Turf'   THEN 20
    WHEN 'Endurance Test'     THEN 25
    WHEN 'Empire Builder'     THEN 30
    WHEN 'War Machine'        THEN 40
    WHEN 'Long Haul'          THEN 35
    WHEN 'Sprint Intervals'   THEN 22
    WHEN 'Take Their Ground'  THEN 30
    WHEN 'Fuel Right'         THEN 15
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.claim_mission_reward(
  p_mission_id text,
  p_title      text
)
RETURNS int -- PACE actually credited (0 if unknown title, already claimed, or capped to 0)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward          int;
  v_weekly_earned   int;
  v_reset_at        timestamptz;
  v_is_premium      boolean;
  v_cap             int;
  v_credited        int;
  v_week_start      timestamptz := date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
  v_reward := public.mission_pace_reward(p_title);
  IF v_reward IS NULL THEN
    RETURN 0;
  END IF;

  -- Idempotent: a mission_id can only ever be claimed once per user.
  INSERT INTO public.mission_claims (user_id, mission_id, pace_earned)
  VALUES (auth.uid(), p_mission_id, 0)
  ON CONFLICT (user_id, mission_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT pace_weekly_earned, pace_weekly_reset_at, (subscription_tier = 'premium')
    INTO v_weekly_earned, v_reset_at, v_is_premium
    FROM public.profiles WHERE id = auth.uid();

  v_cap := CASE WHEN v_is_premium THEN 150 ELSE 100 END; -- mirrors GAME_CONFIG.PACE_WEEKLY_CAP_*
  IF v_reset_at IS NULL OR v_reset_at < v_week_start THEN
    v_weekly_earned := 0;
  END IF;

  v_credited := LEAST(v_reward, GREATEST(0, v_cap - v_weekly_earned));

  UPDATE public.mission_claims SET pace_earned = v_credited
    WHERE user_id = auth.uid() AND mission_id = p_mission_id;

  IF v_credited > 0 THEN
    PERFORM public.apply_pace_adjustment(auth.uid(), v_credited);
  END IF;

  RETURN v_credited;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_mission_reward(text, text) TO authenticated;

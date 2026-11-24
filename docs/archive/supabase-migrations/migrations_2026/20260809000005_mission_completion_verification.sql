-- ============================================================
-- Server-side mission completion verification
-- ============================================================
-- 20260722000002_mission_claims.sql shipped weekly-cap enforcement and a
-- once-per-mission-id ledger for PACE claims, but its own header comment
-- flagged the gap left deliberately open: "a determined attacker could still
-- call this RPC for a mission they didn't actually complete." That gap was
-- inert only because no screen ever called claim_mission_reward() at all
-- (useMissions/MissionCard had zero importers). Now that the client wires
-- the claim button up, the gap becomes live — without this, missions become
-- a way to hit the weekly PACE cap without running a single step.
--
-- Only the 3 mission types that have a real, verifiable server-side signal
-- get an actual check: run_distance and claim_territories (against runs /
-- territory_polygons), and nutrition_streak (against nutrition_logs, as
-- "days in the last 7 with 3+ distinct meals logged" — a reasonable proxy
-- for the client's own local-history streak count, not a byte-identical
-- replica of it). capture_enemy / speed_run / defend_zone / steal_rival have
-- no such signal yet (see missions.ts's client-side hardcoded-0 progress for
-- those types) and fall through to the ELSE branch, i.e. they can never be
-- claimed server-side either, matching their removal from the client's
-- active rotation.
--
-- Verification runs BEFORE the mission_claims insert (unlike a naive
-- ordering) so a legitimate claim attempted before that run's postRunSync
-- has finished pushing to the `runs` table isn't permanently burned: it
-- returns 0 without consuming the mission_id, so the client's existing
-- "still claimed locally, retried on the next successful call" fallback
-- (missionStore.native.ts) picks it up once the run lands.

CREATE OR REPLACE FUNCTION public.nutrition_streak_days(p_user_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM (
    SELECT log_date
    FROM public.nutrition_logs
    WHERE user_id = p_user_id
      AND log_date > (now() AT TIME ZONE 'UTC')::date - INTERVAL '7 days'
      AND log_date <= (now() AT TIME ZONE 'UTC')::date
    GROUP BY log_date
    HAVING COUNT(DISTINCT meal) >= 3
  ) AS qualifying_days
$$;

-- Mirrors MISSION_TEMPLATES in packages/shared/src/services/missions.ts —
-- same caveat as mission_pace_reward: no single source of truth shared
-- between SQL and TS today, so a change to a target there must be mirrored
-- here by hand.
CREATE OR REPLACE FUNCTION public.mission_completed_today(p_user_id uuid, p_title text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today       date := (now() AT TIME ZONE 'UTC')::date;
  v_distance_m  numeric;
  v_territories int;
  v_streak_days int;
BEGIN
  SELECT COALESCE(SUM(distance_m), 0) INTO v_distance_m
    FROM public.runs
    WHERE user_id = p_user_id AND (started_at AT TIME ZONE 'UTC')::date = v_today;

  SELECT COUNT(*) INTO v_territories
    FROM public.territory_polygons
    WHERE owner_id = p_user_id AND (claimed_at AT TIME ZONE 'UTC')::date = v_today;

  v_streak_days := public.nutrition_streak_days(p_user_id);

  RETURN CASE p_title
    WHEN 'Morning Miles'   THEN v_distance_m  >= 1000
    WHEN 'Calorie Crusher' THEN v_distance_m  >= 2000
    WHEN 'Steady State'    THEN v_distance_m  >= 1500
    WHEN 'Push Further'    THEN v_distance_m  >= 3000
    WHEN 'Fat Burn Zone'   THEN v_distance_m  >= 4000
    WHEN 'Endurance Test'  THEN v_distance_m  >= 5000
    WHEN 'Long Haul'       THEN v_distance_m  >= 8000
    WHEN 'Land Grab'       THEN v_territories >= 1
    WHEN 'Territorial'     THEN v_territories >= 3
    WHEN 'Empire Builder'  THEN v_territories >= 5
    WHEN 'Fuel Right'      THEN v_streak_days >= 5
    ELSE false -- capture_enemy / speed_run / defend_zone / steal_rival / unknown titles: no server signal yet
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_mission_reward(
  p_mission_id text,
  p_title      text
)
RETURNS int -- PACE actually credited (0 if unknown title, unverified, already claimed, or capped to 0)
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

  -- Verify before touching the claims ledger — see migration header.
  IF NOT public.mission_completed_today(auth.uid(), p_title) THEN
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

GRANT EXECUTE ON FUNCTION public.nutrition_streak_days(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mission_completed_today(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mission_reward(text, text) TO authenticated;

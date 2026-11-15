-- City-only rewards check where the runner actually runs (security audit M13).
--
-- reward_block_reason decided "is this runner in Bengaluru?" from p_point (the
-- coordinates the app sends with a redemption) or profiles.last_known_location
-- (also written by the app). Either can be set to any city. Now a city reward
-- needs a scored run (checked by the server, not excluded, not flagged) that
-- started in that city within the last 30 days. Browsing the store still uses
-- the phone's location to choose which city's rewards to show; only unlocking
-- uses runs.

CREATE OR REPLACE FUNCTION public.runner_recent_cities(p_user uuid, p_now timestamptz DEFAULT now())
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT c), '{}')
    FROM (
      SELECT public.city_for_point(ST_StartPoint(r.route)) AS c
        FROM public.runs r
       WHERE r.user_id = p_user
         AND r.started_at > p_now - interval '30 days'
         AND r.started_at <= p_now
         AND r.route IS NOT NULL
         AND COALESCE(r.verified_distance_m, 0) > 0
         AND NOT COALESCE(r.excluded, false)
         AND r.integrity_status IN ('ok', 'cleared')
    ) x
   WHERE c IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.runner_recent_cities(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reward_block_reason(p_reward_id uuid, p_user_id uuid, p_check_balance boolean DEFAULT true, p_now timestamp with time zone DEFAULT now(), p_point geometry DEFAULT NULL::geometry)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r  pace_store_rewards%ROWTYPE;
  p  record;
  v_city text;
BEGIN
  SELECT * INTO r FROM pace_store_rewards WHERE id = p_reward_id;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;

  SELECT id, pace_balance, created_at, total_runs, runner_rank, subscription_tier, country, last_known_location
    INTO p FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN 'profile_not_found'; END IF;

  IF r.status <> 'available' THEN
    RETURN CASE r.status WHEN 'sold_out' THEN 'sold_out' ELSE 'not_available' END;
  END IF;
  IF r.starts_at IS NOT NULL AND r.starts_at > p_now THEN RETURN 'not_started'; END IF;
  IF r.expires_at IS NOT NULL AND r.expires_at <= p_now THEN RETURN 'expired'; END IF;

  IF r.countries IS NOT NULL AND cardinality(r.countries) > 0
     AND (p.country IS NULL OR NOT (p.country = ANY (r.countries))) THEN
    RETURN 'not_in_region';
  END IF;
  IF r.cities IS NOT NULL AND cardinality(r.cities) > 0 THEN
    -- Where the runner has actually run (scored runs, last 30 days), not where
    -- the phone says it is: p_point and last_known_location both come from the app.
    IF NOT (r.cities && public.runner_recent_cities(p_user_id, p_now)) THEN
      RETURN 'not_in_region';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM pace_redemptions WHERE user_id = p_user_id AND reward_id = p_reward_id) THEN
    RETURN 'already_redeemed';
  END IF;

  IF r.plus_only AND public.effective_tier(p.subscription_tier) NOT IN ('premium', 'admin') THEN
    RETURN 'plus_only';
  END IF;
  IF r.min_rank IS NOT NULL AND rank_index(p.runner_rank) < rank_index(r.min_rank) THEN
    RETURN 'rank_locked';
  END IF;
  IF p.created_at > p_now - interval '14 days' OR COALESCE(p.total_runs, 0) < 3 THEN
    RETURN 'new_account';
  END IF;

  IF r.stock IS NOT NULL AND r.stock <= 0 THEN RETURN 'sold_out'; END IF;
  IF r.code_mode = 'pool'
     AND NOT EXISTS (SELECT 1 FROM reward_codes WHERE reward_id = r.id AND assigned_to IS NULL) THEN
    RETURN 'sold_out';
  END IF;

  IF p_check_balance AND COALESCE(p.pace_balance, 0) < r.pace_cost THEN
    RETURN 'not_enough_pace';
  END IF;
  RETURN NULL;
END;
$function$;

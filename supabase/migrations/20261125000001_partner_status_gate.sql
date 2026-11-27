-- Brand status gates its rewards (found by supabase/tests/partner_journey.test.sql).
-- Before this, pausing, ending or rejecting a partner in the admin changed only
-- the partners row: its rewards stayed listed and redeemable in the app, so a
-- brand that had stopped honouring codes kept getting redemptions. Rewards
-- without a partner (Runivo's own) are unaffected.

CREATE OR REPLACE FUNCTION public.reward_partner_live(p_partner_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p_partner_id IS NULL
      OR EXISTS (SELECT 1 FROM partners WHERE id = p_partner_id AND status = 'active');
$$;
REVOKE ALL ON FUNCTION public.reward_partner_live(uuid) FROM PUBLIC, anon, authenticated, service_role;
-- authenticated needs it for the rewards_public_read policy below.
GRANT EXECUTE ON FUNCTION public.reward_partner_live(uuid) TO authenticated, service_role;

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
  -- A brand that isn't active (applied, paused, ended, rejected) has nothing on offer.
  IF NOT public.reward_partner_live(r.partner_id) THEN RETURN 'not_available'; END IF;
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

CREATE OR REPLACE FUNCTION public.store_catalog(p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision)
 RETURNS TABLE(id uuid, brand text, title text, description text, pace_cost integer, tier text, brand_color text, brand_initial text, value_label text, category text, status text, sort_order integer, starts_at timestamp with time zone, expires_at timestamp with time zone, plus_only boolean, min_rank text, stock_left integer, lock_reason text, redeemed boolean, my_code text, how_to_use text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_point   geometry := point_from_latlng(p_lat, p_lng);
  v_country text;
  v_city    text;
BEGIN
  SELECT pr.country, city_for_point(COALESCE(v_point, pr.last_known_location)) INTO v_country, v_city
    FROM profiles pr WHERE pr.id = v_uid;

  RETURN QUERY
  SELECT r.id, r.brand, r.title, r.description, r.pace_cost, r.tier,
         r.brand_color, r.brand_initial, r.value_label, r.category, r.status,
         r.sort_order, r.starts_at, r.expires_at, r.plus_only, r.min_rank,
         CASE WHEN r.code_mode = 'pool'
              THEN (SELECT count(*)::int FROM reward_codes c WHERE c.reward_id = r.id AND c.assigned_to IS NULL)
              ELSE r.stock END,
         CASE WHEN v_uid IS NULL THEN 'signed_out' ELSE reward_block_reason(r.id, v_uid, true, now(), v_point) END,
         (red.id IS NOT NULL),
         red.fulfillment_code,
         CASE WHEN red.id IS NOT NULL THEN r.how_to_use END
    FROM pace_store_rewards r
    LEFT JOIN pace_redemptions red ON red.reward_id = r.id AND red.user_id = v_uid
   WHERE r.status <> 'hidden'
     -- A brand that isn't active shows nothing, except codes runners already have.
     AND (public.reward_partner_live(r.partner_id) OR red.id IS NOT NULL)
     -- Keep finished rewards visible only to people who redeemed them.
     AND (r.expires_at IS NULL OR r.expires_at > now() - interval '7 days' OR red.id IS NOT NULL)
     -- Other countries' and cities' rewards aren't shown at all.
     AND (r.countries IS NULL OR cardinality(r.countries) = 0 OR v_country = ANY (r.countries))
     AND (r.cities IS NULL OR cardinality(r.cities) = 0 OR v_city = ANY (r.cities))
   ORDER BY r.sort_order, r.created_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.reward_block_reason(p_reward_id uuid, p_user_id uuid, p_check_balance boolean, p_now timestamp with time zone, p_point public.geometry) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.reward_block_reason(p_reward_id uuid, p_user_id uuid, p_check_balance boolean, p_now timestamp with time zone, p_point public.geometry) TO service_role;
REVOKE ALL ON FUNCTION public.store_catalog(p_lat double precision, p_lng double precision) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.store_catalog(p_lat double precision, p_lng double precision) TO authenticated;
GRANT ALL ON FUNCTION public.store_catalog(p_lat double precision, p_lng double precision) TO service_role;

-- The app's fallback reads the table directly: same rule there.
ALTER POLICY rewards_public_read ON public.pace_store_rewards
  USING (status <> 'hidden' AND public.reward_partner_live(partner_id));

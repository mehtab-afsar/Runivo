-- ============================================================================
-- Partner applications and city rewards without a saved location.
--
-- 1. Partners apply from runivo.app/partners. The public route calls
--    submit_partner_application() with the service role; the function
--    whitelists fields, caps applications per email per day, and inserts a
--    partners row with status 'applied' for the team to review in the admin.
--
-- 2. City-limited rewards used only profiles.last_known_location, so a runner
--    with no saved location never saw them. store_catalog(), redeem_reward()
--    and log_reward_view() now take an optional device point (p_lat, p_lng).
--    It is validated, used for this one check, and never stored. Without a
--    valid point they fall back to last_known_location, exactly as before.
-- ============================================================================

-- ── 1. Applications ─────────────────────────────────────────────────────────

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS website         text,
  ADD COLUMN IF NOT EXISTS offer           text,
  ADD COLUMN IF NOT EXISTS estimated_stock int CHECK (estimated_stock IS NULL OR estimated_stock >= 0),
  ADD COLUMN IF NOT EXISTS applied_at      timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at     timestamptz;

CREATE INDEX IF NOT EXISTS idx_partners_applied_email
  ON public.partners (lower(contact_email), applied_at) WHERE status = 'applied';

-- Returns the new partner id, or raises a short, safe message the route
-- maps to a reply: 'rate_limited' or 'invalid'.
CREATE OR REPLACE FUNCTION public.submit_partner_application(
  p_name            text,
  p_category        text,
  p_contact_name    text,
  p_contact_email   text,
  p_website         text,
  p_countries       text[],
  p_cities          text[],
  p_offer           text,
  p_estimated_stock int
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text := lower(btrim(p_contact_email));
  v_id    uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'submit_partner_application is service_role only';
  END IF;

  IF length(btrim(COALESCE(p_name, ''))) NOT BETWEEN 2 AND 120
     OR v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 200
     OR length(btrim(COALESCE(p_offer, ''))) NOT BETWEEN 5 AND 1000
     OR p_category NOT IN ('shoes', 'apparel', 'gear', 'nutrition', 'cafe', 'physio', 'races', 'gym', 'insurance', 'tech', 'other')
     OR (p_estimated_stock IS NOT NULL AND (p_estimated_stock < 0 OR p_estimated_stock > 1000000)) THEN
    RAISE EXCEPTION 'invalid' USING ERRCODE = '22023';
  END IF;

  -- At most 3 applications per email per day.
  IF (SELECT count(*) FROM partners
       WHERE status = 'applied' AND lower(contact_email) = v_email
         AND applied_at > now() - interval '1 day') >= 3 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO partners (name, category, contact_name, contact_email, website, countries, cities,
                        offer, estimated_stock, status, applied_at)
  VALUES (btrim(p_name), p_category, NULLIF(btrim(COALESCE(p_contact_name, '')), ''), v_email,
          NULLIF(btrim(COALESCE(p_website, '')), ''),
          CASE WHEN cardinality(p_countries) > 0 THEN p_countries[1:20] END,
          CASE WHEN cardinality(p_cities) > 0 THEN p_cities[1:50] END,
          btrim(p_offer), p_estimated_stock, 'applied', now())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_partner_application(text, text, text, text, text, text[], text[], text, int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_partner_application(text, text, text, text, text, text[], text[], text, int)
  TO service_role;

-- ── 2. A device point, validated, never stored ──────────────────────────────

-- A point from the app's last known position, or null if it isn't a real
-- coordinate (null, NaN, infinite or out of range). NaN sorts above every
-- number in Postgres, so BETWEEN rejects it too.
CREATE OR REPLACE FUNCTION public.point_from_latlng(p_lat float8, p_lng float8)
RETURNS geometry LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_lat IS NULL OR p_lng IS NULL THEN NULL
    WHEN p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180
      THEN ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
  END;
$$;

-- reward_block_reason gains p_point: the device point to use for the city
-- check in place of the saved location.
DROP FUNCTION IF EXISTS public.reward_block_reason(uuid, uuid, boolean, timestamptz);

CREATE FUNCTION public.reward_block_reason(
  p_reward_id     uuid,
  p_user_id       uuid,
  p_check_balance boolean     DEFAULT true,
  p_now           timestamptz DEFAULT now(),
  p_point         geometry    DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    v_city := city_for_point(COALESCE(p_point, p.last_known_location));
    IF v_city IS NULL OR NOT (v_city = ANY (r.cities)) THEN
      RETURN 'not_in_region';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM pace_redemptions WHERE user_id = p_user_id AND reward_id = p_reward_id) THEN
    RETURN 'already_redeemed';
  END IF;

  IF r.plus_only AND COALESCE(p.subscription_tier, 'free') NOT IN ('premium', 'admin') THEN
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
$$;

REVOKE ALL ON FUNCTION public.reward_block_reason(uuid, uuid, boolean, timestamptz, geometry) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reward_block_reason(uuid, uuid, boolean, timestamptz, geometry) TO service_role;

-- redeem_reward(p_user_id, p_reward_id) keeps working; p_lat/p_lng are optional.
DROP FUNCTION IF EXISTS public.redeem_reward(uuid, uuid);

CREATE FUNCTION public.redeem_reward(
  p_user_id   uuid,
  p_reward_id uuid,
  p_lat       float8 DEFAULT NULL,
  p_lng       float8 DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r        pace_store_rewards%ROWTYPE;
  p        record;
  v_point  geometry := point_from_latlng(p_lat, p_lng);
  v_reason text;
  v_code   text;
  v_code_id uuid;
  v_balance int;
  v_redemption uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'redeem_reward is service_role only';
  END IF;

  -- Lock order: reward, then profile (credit_pace_capped only locks the
  -- profile), so concurrent redemptions of one reward queue up here.
  SELECT * INTO r FROM pace_store_rewards WHERE id = p_reward_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  SELECT id, pace_balance, runner_rank, subscription_tier, country, last_known_location
    INTO p FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found');
  END IF;

  v_reason := reward_block_reason(p_reward_id, p_user_id, true, now(), v_point);
  IF v_reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_reason, 'balance', p.pace_balance);
  END IF;

  IF r.code_mode = 'pool' THEN
    SELECT id, code INTO v_code_id, v_code
      FROM reward_codes
     WHERE reward_id = r.id AND assigned_to IS NULL
     ORDER BY created_at, id
     LIMIT 1
     FOR UPDATE SKIP LOCKED;
    IF v_code_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'sold_out', 'balance', p.pace_balance);
    END IF;
    UPDATE reward_codes SET assigned_to = p_user_id, assigned_at = now() WHERE id = v_code_id;
  ELSIF r.code_mode = 'static' THEN
    v_code := r.static_code;
  END IF;

  IF r.stock IS NOT NULL THEN
    UPDATE pace_store_rewards SET stock = stock - 1 WHERE id = r.id;
  END IF;

  -- Spend only: lifetime and weekly earned are never touched.
  PERFORM set_config('runivo.trusted_writer', 'on', true);
  UPDATE profiles SET pace_balance = pace_balance - r.pace_cost
   WHERE id = p_user_id
  RETURNING pace_balance INTO v_balance;
  PERFORM set_config('runivo.trusted_writer', 'off', true);

  INSERT INTO pace_redemptions (user_id, reward_id, pace_spent, fulfillment_code, fulfilled_at)
  VALUES (p_user_id, r.id, r.pace_cost, v_code, CASE WHEN v_code IS NOT NULL THEN now() END)
  RETURNING id INTO v_redemption;

  INSERT INTO reward_events (reward_id, partner_id, event, country, city, rank, plus)
  VALUES (r.id, r.partner_id, 'redeem', p.country, city_for_point(COALESCE(v_point, p.last_known_location)), p.runner_rank,
          COALESCE(p.subscription_tier, 'free') IN ('premium', 'admin'));

  RETURN jsonb_build_object(
    'ok', true, 'reason', NULL, 'code', v_code, 'how_to_use', r.how_to_use,
    'balance', v_balance, 'redemption_id', v_redemption);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_reward(uuid, uuid, float8, float8) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid, float8, float8) TO service_role;

-- store_catalog() keeps working; p_lat/p_lng are optional.
DROP FUNCTION IF EXISTS public.store_catalog();

CREATE FUNCTION public.store_catalog(p_lat float8 DEFAULT NULL, p_lng float8 DEFAULT NULL)
RETURNS TABLE (
  id uuid, brand text, title text, description text, pace_cost int, tier text,
  brand_color text, brand_initial text, value_label text, category text, status text,
  sort_order int, starts_at timestamptz, expires_at timestamptz,
  plus_only boolean, min_rank text, stock_left int,
  lock_reason text, redeemed boolean, my_code text, how_to_use text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
     -- Keep finished rewards visible only to people who redeemed them.
     AND (r.expires_at IS NULL OR r.expires_at > now() - interval '7 days' OR red.id IS NOT NULL)
     -- Other countries' and cities' rewards aren't shown at all.
     AND (r.countries IS NULL OR cardinality(r.countries) = 0 OR v_country = ANY (r.countries))
     AND (r.cities IS NULL OR cardinality(r.cities) = 0 OR v_city = ANY (r.cities))
   ORDER BY r.sort_order, r.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.store_catalog(float8, float8) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_catalog(float8, float8) TO authenticated, service_role;

-- log_reward_view(p_reward_id) keeps working; the point only sets the
-- report's city.
DROP FUNCTION IF EXISTS public.log_reward_view(uuid);

CREATE FUNCTION public.log_reward_view(p_reward_id uuid, p_lat float8 DEFAULT NULL, p_lng float8 DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_point geometry := point_from_latlng(p_lat, p_lng);
  p record;
  v_partner uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  SELECT partner_id INTO v_partner FROM pace_store_rewards WHERE id = p_reward_id AND status <> 'hidden';
  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO reward_view_keys (key)
  VALUES (md5(v_uid::text || ':' || p_reward_id::text || ':' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')))
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;  -- already counted today

  SELECT country, runner_rank, subscription_tier, last_known_location INTO p FROM profiles WHERE id = v_uid;
  INSERT INTO reward_events (reward_id, partner_id, event, country, city, rank, plus)
  VALUES (p_reward_id, v_partner, 'view', p.country, city_for_point(COALESCE(v_point, p.last_known_location)), p.runner_rank,
          COALESCE(p.subscription_tier, 'free') IN ('premium', 'admin'));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.log_reward_view(uuid, float8, float8) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_reward_view(uuid, float8, float8) TO authenticated, service_role;

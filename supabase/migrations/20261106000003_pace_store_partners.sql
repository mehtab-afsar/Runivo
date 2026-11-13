-- ============================================================================
-- V1 PACE Store partners: partners, code pools, gated redemption, reports.
--
-- PRD rules (PACE Store and partners):
--   * Partners fund rewards; PACE is a loyalty point (never bought or cashed).
--   * One redemption per runner per reward; limited stock; PACE never expires,
--     rewards do.
--   * Fraud: only accounts older than 14 days with at least 3 runs redeem;
--     codes are single-use and handed out by the server from a pool.
--   * Partners get monthly reports with aggregates only, never personal data.
--   * First partners list free; cost per redemption from their billing start.
--
-- What this adds:
--   partners                 who funds a reward, how they pay us
--   store_cities             launch cities (centre + radius) so rewards can be
--                            local and reports can group by city without
--                            storing where anyone runs
--   pace_store_rewards       + partner, Plus-only, rank gate, countries/cities,
--                            start date, code mode (pool / static / none)
--   reward_codes             single-use code pool, assigned by redeem_reward
--   reward_events            'view' / 'redeem' with city, country, rank, tier:
--                            no user id, so reports can't identify anyone
--   reward_block_reason()    the one place every gate lives
--   redeem_reward()          rewritten: all gates, atomic, returns jsonb
--   store_catalog()          what the app shows: live rewards for my region,
--                            each with my lock reason and my code if redeemed
--   log_reward_view()        anonymous view counter for reports
--   partner_monthly_report() per-reward / city / rank aggregates + fee owed
-- ============================================================================

-- ── 1. Partners ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.partners (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  category            text        NOT NULL DEFAULT 'gear'
                        CHECK (category IN ('shoes', 'apparel', 'gear', 'nutrition', 'cafe', 'physio', 'races', 'gym', 'insurance', 'tech', 'other')),
  contact_name        text,
  contact_email       text,
  cities              text[],
  countries           text[],
  billing_model       text        NOT NULL DEFAULT 'free_listing'
                        CHECK (billing_model IN ('free_listing', 'cost_per_redemption')),
  fee_per_redemption  numeric(8,2) NOT NULL DEFAULT 0 CHECK (fee_per_redemption >= 0),
  fee_currency        text        NOT NULL DEFAULT 'USD',
  billing_starts_on   date,                 -- cost per redemption applies from this month
  status              text        NOT NULL DEFAULT 'applied'
                        CHECK (status IN ('applied', 'active', 'paused', 'ended', 'rejected')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;  -- service role only

-- ── 2. Launch cities ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.store_cities (
  name       text PRIMARY KEY,
  country    text NOT NULL,
  center     geometry(Point, 4326) NOT NULL,
  radius_km  numeric NOT NULL DEFAULT 35
);
ALTER TABLE public.store_cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS store_cities_read ON public.store_cities;
CREATE POLICY store_cities_read ON public.store_cities FOR SELECT USING (true);

INSERT INTO public.store_cities (name, country, center) VALUES
  ('Bengaluru', 'IN', ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)),
  ('Mumbai',    'IN', ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326)),
  ('Delhi',     'IN', ST_SetSRID(ST_MakePoint(77.2090, 28.6139), 4326)),
  ('Pune',      'IN', ST_SetSRID(ST_MakePoint(73.8567, 18.5204), 4326)),
  ('Hyderabad', 'IN', ST_SetSRID(ST_MakePoint(78.4867, 17.3850), 4326)),
  ('Chennai',   'IN', ST_SetSRID(ST_MakePoint(80.2707, 13.0827), 4326)),
  ('Kolkata',   'IN', ST_SetSRID(ST_MakePoint(88.3639, 22.5726), 4326))
ON CONFLICT (name) DO NOTHING;

-- Nearest launch city within its radius, or null.
CREATE OR REPLACE FUNCTION public.city_for_point(p_point geometry)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT c.name
    FROM store_cities c
   WHERE p_point IS NOT NULL
     AND ST_DWithin(c.center::geography, p_point::geography, c.radius_km * 1000)
   ORDER BY ST_Distance(c.center::geography, p_point::geography)
   LIMIT 1;
$$;

-- ── 3. Rewards: targeting, gates, codes ─────────────────────────────────────

ALTER TABLE public.pace_store_rewards
  ADD COLUMN IF NOT EXISTS partner_id   uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plus_only    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_rank     text CHECK (min_rank IS NULL OR min_rank IN ('pacer', 'strider', 'chaser', 'hunter', 'sovereign')),
  ADD COLUMN IF NOT EXISTS countries    text[],
  ADD COLUMN IF NOT EXISTS cities       text[],
  ADD COLUMN IF NOT EXISTS starts_at    timestamptz,
  ADD COLUMN IF NOT EXISTS code_mode    text NOT NULL DEFAULT 'none' CHECK (code_mode IN ('pool', 'static', 'none')),
  ADD COLUMN IF NOT EXISTS static_code  text,
  ADD COLUMN IF NOT EXISTS how_to_use   text;

CREATE INDEX IF NOT EXISTS idx_rewards_partner ON public.pace_store_rewards(partner_id);

CREATE TABLE IF NOT EXISTS public.reward_codes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id    uuid        NOT NULL REFERENCES public.pace_store_rewards(id) ON DELETE CASCADE,
  code         text        NOT NULL CHECK (length(btrim(code)) > 0),
  assigned_to  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reward_id, code)
);
CREATE INDEX IF NOT EXISTS idx_reward_codes_free ON public.reward_codes(reward_id, created_at) WHERE assigned_to IS NULL;
ALTER TABLE public.reward_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reward_codes_read_own ON public.reward_codes;
CREATE POLICY reward_codes_read_own ON public.reward_codes
  FOR SELECT TO authenticated USING (assigned_to = auth.uid());

-- The code a runner got is kept on their redemption too.
ALTER TABLE public.pace_redemptions
  ADD COLUMN IF NOT EXISTS fulfillment_code text,
  ADD COLUMN IF NOT EXISTS fulfilled_at     timestamptz;

-- ── 4. Anonymous events for partner reports ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reward_events (
  id          bigserial   PRIMARY KEY,
  reward_id   uuid        NOT NULL REFERENCES public.pace_store_rewards(id) ON DELETE CASCADE,
  partner_id  uuid        REFERENCES public.partners(id) ON DELETE SET NULL,
  event       text        NOT NULL CHECK (event IN ('view', 'redeem')),
  country     text,
  city        text,
  rank        text,
  plus        boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reward_events_partner_time ON public.reward_events(partner_id, created_at);
ALTER TABLE public.reward_events ENABLE ROW LEVEL SECURITY;  -- service role only

-- One view per runner per reward per day, without keeping who: a one-way key.
CREATE TABLE IF NOT EXISTS public.reward_view_keys (
  key         text        PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reward_view_keys ENABLE ROW LEVEL SECURITY;  -- service role only

-- ── 5. Gates ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rank_index(p_rank text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(array_position(ARRAY['pacer','strider','chaser','hunter','sovereign'], p_rank), 1);
$$;

-- Why this runner can't redeem this reward right now, or null if they can.
-- Order matters: it's the message the runner sees.
CREATE OR REPLACE FUNCTION public.reward_block_reason(
  p_reward_id     uuid,
  p_user_id       uuid,
  p_check_balance boolean     DEFAULT true,
  p_now           timestamptz DEFAULT now()
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
    v_city := city_for_point(p.last_known_location);
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

-- ── 6. Redeem ───────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.redeem_reward(uuid, uuid);

CREATE FUNCTION public.redeem_reward(p_user_id uuid, p_reward_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r        pace_store_rewards%ROWTYPE;
  p        record;
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

  v_reason := reward_block_reason(p_reward_id, p_user_id, true);
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
  VALUES (r.id, r.partner_id, 'redeem', p.country, city_for_point(p.last_known_location), p.runner_rank,
          COALESCE(p.subscription_tier, 'free') IN ('premium', 'admin'));

  RETURN jsonb_build_object(
    'ok', true, 'reason', NULL, 'code', v_code, 'how_to_use', r.how_to_use,
    'balance', v_balance, 'redemption_id', v_redemption);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_reward(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid) TO service_role;

-- ── 7. What the app shows ───────────────────────────────────────────────────

-- Live rewards for the signed-in runner's region, each with the reason it's
-- locked for them (null = can redeem now), and their code if they redeemed it.
CREATE OR REPLACE FUNCTION public.store_catalog()
RETURNS TABLE (
  id uuid, brand text, title text, description text, pace_cost int, tier text,
  brand_color text, brand_initial text, value_label text, category text, status text,
  sort_order int, starts_at timestamptz, expires_at timestamptz,
  plus_only boolean, min_rank text, stock_left int,
  lock_reason text, redeemed boolean, my_code text, how_to_use text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_country text;
  v_city text;
BEGIN
  SELECT pr.country, city_for_point(pr.last_known_location) INTO v_country, v_city
    FROM profiles pr WHERE pr.id = v_uid;

  RETURN QUERY
  SELECT r.id, r.brand, r.title, r.description, r.pace_cost, r.tier,
         r.brand_color, r.brand_initial, r.value_label, r.category, r.status,
         r.sort_order, r.starts_at, r.expires_at, r.plus_only, r.min_rank,
         CASE WHEN r.code_mode = 'pool'
              THEN (SELECT count(*)::int FROM reward_codes c WHERE c.reward_id = r.id AND c.assigned_to IS NULL)
              ELSE r.stock END,
         CASE WHEN v_uid IS NULL THEN 'signed_out' ELSE reward_block_reason(r.id, v_uid, true) END,
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

REVOKE ALL ON FUNCTION public.store_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_catalog() TO authenticated, service_role;

-- A runner opened a reward. Records city, country and rank; never who.
CREATE OR REPLACE FUNCTION public.log_reward_view(p_reward_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
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
  VALUES (p_reward_id, v_partner, 'view', p.country, city_for_point(p.last_known_location), p.runner_rank,
          COALESCE(p.subscription_tier, 'free') IN ('premium', 'admin'));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.log_reward_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_reward_view(uuid) TO authenticated, service_role;

-- ── 8. Partner report ───────────────────────────────────────────────────────

-- One month (any day in it) for one partner. Aggregates only.
CREATE OR REPLACE FUNCTION public.partner_monthly_report(p_partner_id uuid, p_month date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pt partners%ROWTYPE;
  v_from timestamptz := date_trunc('month', p_month)::timestamptz;
  v_to   timestamptz := (date_trunc('month', p_month) + interval '1 month')::timestamptz;
  v_redemptions int;
  v_views int;
  v_billable boolean;
BEGIN
  SELECT * INTO pt FROM partners WHERE id = p_partner_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT count(*) FILTER (WHERE event = 'redeem'), count(*) FILTER (WHERE event = 'view')
    INTO v_redemptions, v_views
    FROM reward_events
   WHERE partner_id = p_partner_id AND created_at >= v_from AND created_at < v_to;

  v_billable := pt.billing_model = 'cost_per_redemption'
                AND (pt.billing_starts_on IS NULL OR date_trunc('month', pt.billing_starts_on) <= date_trunc('month', p_month));

  RETURN jsonb_build_object(
    'partner',       jsonb_build_object('id', pt.id, 'name', pt.name, 'billing_model', pt.billing_model,
                                        'fee_per_redemption', pt.fee_per_redemption, 'fee_currency', pt.fee_currency),
    'month',         to_char(v_from AT TIME ZONE 'UTC', 'YYYY-MM'),
    'totals',        jsonb_build_object('views', v_views, 'redemptions', v_redemptions,
                                        'redemption_rate', CASE WHEN v_views > 0 THEN round(v_redemptions::numeric / v_views, 4) ELSE NULL END),
    'fee_owed',      CASE WHEN v_billable THEN round(v_redemptions * pt.fee_per_redemption, 2) ELSE 0 END,
    'rewards', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'reward_id', r.id, 'title', r.title, 'pace_cost', r.pace_cost,
               'views', x.views, 'redemptions', x.redemptions,
               'redemption_rate', CASE WHEN x.views > 0 THEN round(x.redemptions::numeric / x.views, 4) ELSE NULL END,
               'codes_left', (SELECT count(*) FROM reward_codes c WHERE c.reward_id = r.id AND c.assigned_to IS NULL))
             ORDER BY x.redemptions DESC, r.title)
        FROM pace_store_rewards r
        CROSS JOIN LATERAL (
          SELECT count(*) FILTER (WHERE e.event = 'view')   AS views,
                 count(*) FILTER (WHERE e.event = 'redeem') AS redemptions
            FROM reward_events e
           WHERE e.reward_id = r.id AND e.created_at >= v_from AND e.created_at < v_to) x
       WHERE r.partner_id = p_partner_id), '[]'::jsonb),
    'by_city', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('city', city, 'views', v, 'redemptions', rd) ORDER BY rd DESC, city)
        FROM (SELECT COALESCE(city, 'Other') AS city,
                     count(*) FILTER (WHERE event = 'view') AS v,
                     count(*) FILTER (WHERE event = 'redeem') AS rd
                FROM reward_events
               WHERE partner_id = p_partner_id AND created_at >= v_from AND created_at < v_to
               GROUP BY 1) s), '[]'::jsonb),
    'by_rank', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('rank', rank, 'views', v, 'redemptions', rd) ORDER BY rank_index(rank))
        FROM (SELECT COALESCE(rank, 'pacer') AS rank,
                     count(*) FILTER (WHERE event = 'view') AS v,
                     count(*) FILTER (WHERE event = 'redeem') AS rd
                FROM reward_events
               WHERE partner_id = p_partner_id AND created_at >= v_from AND created_at < v_to
               GROUP BY 1) s), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.partner_monthly_report(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.partner_monthly_report(uuid, date) TO service_role;

REVOKE ALL ON FUNCTION public.reward_block_reason(uuid, uuid, boolean, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reward_block_reason(uuid, uuid, boolean, timestamptz) TO service_role;

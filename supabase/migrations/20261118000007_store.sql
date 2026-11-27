-- ========================================================================
-- PACE Store
-- ========================================================================
-- Rewards, partners, codes, redemptions and sponsored challenges.
--
-- One file per feature: this file creates everything this feature owns
-- (tables, functions, triggers, row-level security, grants, scheduled jobs).
-- It needs only the files before it. Built from the 178 migrations up to
-- 20261117000012 (the 178 old files were removed after commit 9e5cf19; see git history); a fresh
-- database built from these files matches one built from those exactly.
--
-- Tables: pace_redemptions, pace_store_rewards, partners, promotions, redemption_holds, reward_codes, reward_events, reward_view_keys, sponsored_challenge_entries, sponsored_challenges, store_cities

SET check_function_bodies = false;
SET client_min_messages = warning;
SET search_path = public, extensions;


-- ── Sequences ─────────────────────────────────────────────────────────

CREATE SEQUENCE public.reward_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ── Tables ────────────────────────────────────────────────────────────

CREATE TABLE public.pace_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    reward_id uuid NOT NULL,
    pace_spent integer NOT NULL,
    fulfillment_code text,
    fulfilled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    used_at timestamp with time zone,
    review_status text DEFAULT 'clear'::text NOT NULL,
    review_reason text,
    reviewed_at timestamp with time zone,
    CONSTRAINT pace_redemptions_pace_spent_check CHECK ((pace_spent > 0)),
    CONSTRAINT pace_redemptions_review_status_check CHECK ((review_status = ANY (ARRAY['clear'::text, 'held'::text, 'approved'::text, 'rejected'::text])))
);

CREATE TABLE public.pace_store_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    pace_cost integer NOT NULL,
    tier text DEFAULT 'entry'::text NOT NULL,
    brand_color text DEFAULT '#534AB7'::text NOT NULL,
    brand_initial text DEFAULT '?'::text NOT NULL,
    value_label text NOT NULL,
    category text DEFAULT 'gear'::text NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    stock integer,
    partner_id uuid,
    plus_only boolean DEFAULT false NOT NULL,
    min_rank text,
    countries text[],
    cities text[],
    starts_at timestamp with time zone,
    code_mode text DEFAULT 'none'::text NOT NULL,
    static_code text,
    how_to_use text,
    CONSTRAINT pace_store_rewards_category_check CHECK ((category = ANY (ARRAY['gear'::text, 'nutrition'::text, 'tech'::text, 'events'::text]))),
    CONSTRAINT pace_store_rewards_code_mode_check CHECK ((code_mode = ANY (ARRAY['pool'::text, 'static'::text, 'none'::text]))),
    CONSTRAINT pace_store_rewards_min_rank_check CHECK (((min_rank IS NULL) OR (min_rank = ANY (ARRAY['pacer'::text, 'strider'::text, 'chaser'::text, 'hunter'::text, 'sovereign'::text])))),
    CONSTRAINT pace_store_rewards_pace_cost_check CHECK ((pace_cost > 0)),
    CONSTRAINT pace_store_rewards_status_check CHECK ((status = ANY (ARRAY['available'::text, 'coming_soon'::text, 'sold_out'::text, 'hidden'::text]))),
    CONSTRAINT pace_store_rewards_stock_check CHECK (((stock IS NULL) OR (stock >= 0))),
    CONSTRAINT pace_store_rewards_tier_check CHECK ((tier = ANY (ARRAY['entry'::text, 'mid'::text, 'premium'::text])))
);

CREATE TABLE public.partners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category text DEFAULT 'gear'::text NOT NULL,
    contact_name text,
    contact_email text,
    cities text[],
    countries text[],
    billing_model text DEFAULT 'free_listing'::text NOT NULL,
    fee_per_redemption numeric(8,2) DEFAULT 0 NOT NULL,
    fee_currency text DEFAULT 'USD'::text NOT NULL,
    billing_starts_on date,
    status text DEFAULT 'applied'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    website text,
    offer text,
    estimated_stock integer,
    applied_at timestamp with time zone,
    reviewed_at timestamp with time zone,
    CONSTRAINT partners_billing_model_check CHECK ((billing_model = ANY (ARRAY['free_listing'::text, 'cost_per_redemption'::text]))),
    CONSTRAINT partners_category_check CHECK ((category = ANY (ARRAY['shoes'::text, 'apparel'::text, 'gear'::text, 'nutrition'::text, 'cafe'::text, 'physio'::text, 'races'::text, 'gym'::text, 'insurance'::text, 'tech'::text, 'other'::text]))),
    CONSTRAINT partners_estimated_stock_check CHECK (((estimated_stock IS NULL) OR (estimated_stock >= 0))),
    CONSTRAINT partners_fee_per_redemption_check CHECK ((fee_per_redemption >= (0)::numeric)),
    CONSTRAINT partners_status_check CHECK ((status = ANY (ARRAY['applied'::text, 'active'::text, 'paused'::text, 'ended'::text, 'rejected'::text])))
);

CREATE TABLE public.promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    subtitle text,
    image_url text,
    cta_label text,
    cta_url text,
    placement text DEFAULT 'home_banner'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    active_from timestamp with time zone,
    active_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.redemption_holds (
    redemption_id uuid NOT NULL,
    code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.reward_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reward_id uuid NOT NULL,
    code text NOT NULL,
    assigned_to uuid,
    assigned_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reward_codes_code_check CHECK ((length(btrim(code)) > 0))
);

CREATE TABLE public.reward_events (
    id bigint NOT NULL,
    reward_id uuid NOT NULL,
    partner_id uuid,
    event text NOT NULL,
    country text,
    city text,
    rank text,
    plus boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reward_events_event_check CHECK ((event = ANY (ARRAY['view'::text, 'redeem'::text])))
);

CREATE TABLE public.reward_view_keys (
    key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.sponsored_challenge_entries (
    challenge_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    code text
);

CREATE TABLE public.sponsored_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    partner_id uuid,
    brand text NOT NULL,
    brand_color text,
    title text NOT NULL,
    description text,
    metric text NOT NULL,
    target numeric NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    reward_id uuid NOT NULL,
    countries text[],
    status text DEFAULT 'live'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sponsored_challenges_check CHECK ((ends_at > starts_at)),
    CONSTRAINT sponsored_challenges_metric_check CHECK ((metric = ANY (ARRAY['distance_km'::text, 'zones'::text, 'active_days'::text]))),
    CONSTRAINT sponsored_challenges_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'live'::text, 'ended'::text]))),
    CONSTRAINT sponsored_challenges_target_check CHECK ((target > (0)::numeric)),
    CONSTRAINT sponsored_challenges_title_check CHECK (((length(title) >= 3) AND (length(title) <= 80)))
);

CREATE TABLE public.store_cities (
    name text NOT NULL,
    country text NOT NULL,
    center public.geometry(Point,4326) NOT NULL,
    radius_km numeric DEFAULT 35 NOT NULL
);


-- ── Defaults ──────────────────────────────────────────────────────────

ALTER SEQUENCE public.reward_events_id_seq OWNED BY public.reward_events.id;

ALTER TABLE ONLY public.reward_events ALTER COLUMN id SET DEFAULT nextval('public.reward_events_id_seq'::regclass);


-- ── Keys and checks ───────────────────────────────────────────────────

ALTER TABLE ONLY public.pace_redemptions
    ADD CONSTRAINT pace_redemptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pace_redemptions
    ADD CONSTRAINT pace_redemptions_user_id_reward_id_key UNIQUE (user_id, reward_id);

ALTER TABLE ONLY public.pace_store_rewards
    ADD CONSTRAINT pace_store_rewards_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.redemption_holds
    ADD CONSTRAINT redemption_holds_pkey PRIMARY KEY (redemption_id);

ALTER TABLE ONLY public.reward_codes
    ADD CONSTRAINT reward_codes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reward_codes
    ADD CONSTRAINT reward_codes_reward_id_code_key UNIQUE (reward_id, code);

ALTER TABLE ONLY public.reward_events
    ADD CONSTRAINT reward_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reward_view_keys
    ADD CONSTRAINT reward_view_keys_pkey PRIMARY KEY (key);

ALTER TABLE ONLY public.sponsored_challenge_entries
    ADD CONSTRAINT sponsored_challenge_entries_pkey PRIMARY KEY (challenge_id, user_id);

ALTER TABLE ONLY public.sponsored_challenges
    ADD CONSTRAINT sponsored_challenges_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.store_cities
    ADD CONSTRAINT store_cities_pkey PRIMARY KEY (name);


-- ── Functions ─────────────────────────────────────────────────────────

CREATE FUNCTION public.billable_redemptions(p_partner_id uuid, p_month date) RETURNS TABLE(billable integer, held integer, rejected integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT count(*) FILTER (WHERE red.review_status IN ('clear', 'approved'))::int,
         count(*) FILTER (WHERE red.review_status = 'held')::int,
         count(*) FILTER (WHERE red.review_status = 'rejected')::int
    FROM public.pace_redemptions red
    JOIN public.pace_store_rewards r ON r.id = red.reward_id
   WHERE r.partner_id = p_partner_id
     AND red.created_at >= date_trunc('month', p_month) AND red.created_at < date_trunc('month', p_month) + interval '1 month';
$$;

CREATE FUNCTION public.city_for_point(p_point public.geometry) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT c.name
    FROM store_cities c
   WHERE p_point IS NOT NULL
     AND ST_DWithin(c.center::geography, p_point::geography, c.radius_km * 1000)
   ORDER BY ST_Distance(c.center::geography, p_point::geography)
   LIMIT 1;
$$;

CREATE FUNCTION public.claim_sponsored_reward(p_challenge uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  c sponsored_challenges%ROWTYPE;
  e sponsored_challenge_entries%ROWTYPE;
  v_code text;
BEGIN
  SELECT * INTO c FROM sponsored_challenges WHERE id = p_challenge;
  SELECT * INTO e FROM sponsored_challenge_entries WHERE challenge_id = p_challenge AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'join the challenge first'; END IF;
  IF e.code IS NOT NULL THEN RETURN e.code; END IF;
  IF sponsored_progress(p_challenge, auth.uid()) < c.target THEN RAISE EXCEPTION 'not finished yet'; END IF;
  UPDATE reward_codes SET assigned_to = auth.uid(), assigned_at = now()
   WHERE id = (SELECT id FROM reward_codes WHERE reward_id = c.reward_id AND assigned_to IS NULL LIMIT 1 FOR UPDATE SKIP LOCKED)
  RETURNING code INTO v_code;
  IF v_code IS NULL THEN
    SELECT static_code INTO v_code FROM pace_store_rewards WHERE id = c.reward_id AND code_mode = 'static';
  END IF;
  IF v_code IS NULL THEN RAISE EXCEPTION 'the brand has run out of codes; we''ll let you know'; END IF;
  UPDATE sponsored_challenge_entries SET completed_at = now(), code = v_code WHERE challenge_id = p_challenge AND user_id = auth.uid();
  RETURN v_code;
END;
$$;

CREATE FUNCTION public.fraud_review_queue(p_partner_id uuid DEFAULT NULL::uuid) RETURNS TABLE(redemption_id uuid, created_at timestamp with time zone, username text, account_age_days integer, total_runs integer, reward_title text, partner_name text, pace_spent integer, review_reason text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT red.id, red.created_at, p.username, (now()::date - p.created_at::date), COALESCE(p.total_runs, 0),
         r.title, pt.name, red.pace_spent, red.review_reason
    FROM public.pace_redemptions red
    JOIN public.pace_store_rewards r ON r.id = red.reward_id
    JOIN public.profiles p ON p.id = red.user_id
    LEFT JOIN public.partners pt ON pt.id = r.partner_id
   WHERE red.review_status = 'held' AND (p_partner_id IS NULL OR r.partner_id = p_partner_id)
   ORDER BY red.created_at;
$$;

CREATE FUNCTION public.get_my_rewards() RETURNS TABLE(redemption_id uuid, reward_id uuid, brand text, title text, value_label text, brand_color text, code text, how_to_use text, pace_spent integer, redeemed_at timestamp with time zone, used_at timestamp with time zone, expires_at timestamp with time zone, status text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT red.id, r.id, r.brand, r.title, r.value_label, r.brand_color,
         red.fulfillment_code, r.how_to_use, red.pace_spent, red.created_at, red.used_at, r.expires_at,
         CASE
           WHEN red.review_status = 'held' THEN 'review'
           WHEN red.review_status = 'rejected' THEN 'refunded'
           WHEN red.used_at IS NOT NULL THEN 'used'
           WHEN r.expires_at IS NOT NULL AND r.expires_at < now() THEN 'expired'
           WHEN red.fulfillment_code IS NULL THEN 'pending'
           ELSE 'unused'
         END
    FROM public.pace_redemptions red
    JOIN public.pace_store_rewards r ON r.id = red.reward_id
   WHERE red.user_id = auth.uid()
   ORDER BY red.created_at DESC;
$$;

CREATE FUNCTION public.hold_risky_redemption() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_reason text := public.redemption_risk_reason(NEW.user_id);
BEGIN
  IF v_reason IS NOT NULL THEN
    NEW.review_status := 'held';
    NEW.review_reason := v_reason;
    INSERT INTO public.redemption_holds (redemption_id, code) VALUES (NEW.id, NEW.fulfillment_code)
    ON CONFLICT (redemption_id) DO UPDATE SET code = EXCLUDED.code;
    NEW.fulfillment_code := NULL;
    NEW.fulfilled_at  := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.join_sponsored_challenge(p_challenge uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  INSERT INTO sponsored_challenge_entries (challenge_id, user_id)
  SELECT id, auth.uid() FROM sponsored_challenges WHERE id = p_challenge AND status = 'live' AND ends_at > now()
  ON CONFLICT DO NOTHING;
$$;

CREATE FUNCTION public.list_sponsored_challenges() RETURNS TABLE(id uuid, brand text, brand_color text, title text, description text, metric text, target numeric, starts_at timestamp with time zone, ends_at timestamp with time zone, reward_title text, reward_value text, joined boolean, progress numeric, completed boolean, code text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT c.id, c.brand, c.brand_color, c.title, c.description, c.metric, c.target, c.starts_at, c.ends_at,
         r.title, r.value_label,
         e.user_id IS NOT NULL, CASE WHEN e.user_id IS NULL THEN 0 ELSE sponsored_progress(c.id, auth.uid()) END,
         e.completed_at IS NOT NULL, e.code
    FROM sponsored_challenges c
    JOIN pace_store_rewards r ON r.id = c.reward_id
    LEFT JOIN sponsored_challenge_entries e ON e.challenge_id = c.id AND e.user_id = auth.uid()
    JOIN profiles p ON p.id = auth.uid()
   WHERE c.status = 'live' AND c.ends_at > now() - interval '7 days'
     AND (c.countries IS NULL OR p.country = ANY (c.countries))
   ORDER BY (e.completed_at IS NOT NULL), c.ends_at;
$$;

CREATE FUNCTION public.log_reward_view(p_reward_id uuid, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

CREATE FUNCTION public.partner_monthly_report(p_partner_id uuid, p_month date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

CREATE FUNCTION public.redeem_reward(p_user_id uuid, p_reward_id uuid, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

CREATE FUNCTION public.redemption_risk_reason(p_user_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE WHEN n > 0 THEN n || ' GPS-flagged ' || CASE WHEN n = 1 THEN 'run' ELSE 'runs' END || ' in 30 days (' || reasons || ')' END
    FROM (SELECT count(*) AS n, string_agg(DISTINCT integrity_reason, ', ') AS reasons
            FROM public.runs
           WHERE user_id = p_user_id AND integrity_status IN ('flagged', 'appealed')
             AND started_at > now() - interval '30 days') x;
$$;

CREATE FUNCTION public.review_redemption(p_redemption_id uuid, p_approve boolean) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE red public.pace_redemptions%ROWTYPE; r public.pace_store_rewards%ROWTYPE; v_code text;
BEGIN
  SELECT * INTO red FROM public.pace_redemptions WHERE id = p_redemption_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF red.review_status <> 'held' THEN RETURN 'not_held'; END IF;
  SELECT * INTO r FROM public.pace_store_rewards WHERE id = red.reward_id;
  SELECT code INTO v_code FROM public.redemption_holds WHERE redemption_id = red.id;
  DELETE FROM public.redemption_holds WHERE redemption_id = red.id;

  IF p_approve THEN
    UPDATE public.pace_redemptions
       SET review_status = 'approved', reviewed_at = now(),
           fulfillment_code = v_code, fulfilled_at = CASE WHEN v_code IS NOT NULL THEN now() END
     WHERE id = red.id;
    RETURN 'approved';
  END IF;

  PERFORM set_config('runivo.trusted_writer', 'on', true);
  UPDATE public.profiles SET pace_balance = pace_balance + red.pace_spent WHERE id = red.user_id;
  PERFORM set_config('runivo.trusted_writer', 'off', true);
  IF v_code IS NOT NULL AND r.code_mode = 'pool' THEN
    UPDATE public.reward_codes SET assigned_to = NULL, assigned_at = NULL
     WHERE reward_id = r.id AND assigned_to = red.user_id AND code = v_code;
  END IF;
  IF r.stock IS NOT NULL THEN UPDATE public.pace_store_rewards SET stock = stock + 1 WHERE id = r.id; END IF;
  UPDATE public.pace_redemptions SET review_status = 'rejected', reviewed_at = now() WHERE id = red.id;
  RETURN 'rejected';
END;
$$;

CREATE FUNCTION public.reward_block_reason(p_reward_id uuid, p_user_id uuid, p_check_balance boolean DEFAULT true, p_now timestamp with time zone DEFAULT now(), p_point public.geometry DEFAULT NULL::public.geometry) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;

CREATE FUNCTION public.send_reward_nudges(p_now timestamp with time zone DEFAULT now()) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE r record; v_sent int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (p.id) p.id AS uid, w.id AS rid, w.brand, w.value_label,
           (w.expires_at IS NOT NULL AND w.expires_at < p_now + interval '3 days') AS expiring,
           w.stock
      FROM profiles p
      JOIN pace_store_rewards w ON w.status = 'available'
           AND (w.starts_at IS NULL OR w.starts_at <= p_now)
           AND (w.expires_at IS NULL OR w.expires_at > p_now)
           AND p.pace_balance >= w.pace_cost
           AND (NOT w.plus_only OR public.effective_tier(p.subscription_tier) IN ('premium', 'admin'))
           AND (w.countries IS NULL OR p.country = ANY (w.countries))
           AND ((w.expires_at IS NOT NULL AND w.expires_at < p_now + interval '3 days') OR (w.stock IS NOT NULL AND w.stock BETWEEN 1 AND 10))
     WHERE p.notifications_enabled AND p.offers_enabled
       AND extract(hour FROM local_time(p.timezone, p_now)) = 18
       AND NOT EXISTS (SELECT 1 FROM pace_redemptions x WHERE x.user_id = p.id AND x.reward_id = w.id)
     ORDER BY p.id, w.expires_at NULLS LAST
  LOOP
    IF queue_notification(r.uid, 'campaign',
         CASE WHEN r.expiring THEN r.brand || ' ' || r.value_label || ' ends soon' ELSE 'Only ' || r.stock || ' left: ' || r.brand || ' ' || r.value_label END,
         'You have the PACE for it.', '/store', 'reward_nudge:' || r.rid, false, p_now) THEN
      v_sent := v_sent + 1;
    END IF;
  END LOOP;
  RETURN v_sent;
END;
$$;

CREATE FUNCTION public.set_reward_used(p_redemption_id uuid, p_used boolean) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  UPDATE public.pace_redemptions
     SET used_at = CASE WHEN p_used THEN COALESCE(used_at, now()) ELSE NULL END
   WHERE id = p_redemption_id AND user_id = auth.uid();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;

CREATE FUNCTION public.sponsored_progress(p_challenge uuid, p_user uuid) RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE c.metric
    WHEN 'distance_km' THEN COALESCE((SELECT round(sum(r.verified_distance_m) / 1000.0, 1) FROM runs r
           WHERE r.user_id = p_user AND NOT COALESCE(r.excluded, false)
             AND COALESCE(r.activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike', 'wheelchair', 'stroller'])
             AND r.started_at BETWEEN GREATEST(c.starts_at, e.joined_at) AND c.ends_at), 0)
    WHEN 'active_days' THEN COALESCE((SELECT count(DISTINCT r.started_at::date) FROM runs r
           WHERE r.user_id = p_user AND NOT COALESCE(r.excluded, false) AND r.verified_distance_m > 0
             AND r.started_at BETWEEN GREATEST(c.starts_at, e.joined_at) AND c.ends_at), 0)
    ELSE COALESCE((SELECT count(*) FROM zone_events z
           WHERE z.user_id = p_user AND z.kind IN ('claimed', 'stolen')
             AND z.at BETWEEN GREATEST(c.starts_at, e.joined_at) AND c.ends_at), 0)
  END
  FROM sponsored_challenges c
  JOIN sponsored_challenge_entries e ON e.challenge_id = c.id AND e.user_id = p_user
  WHERE c.id = p_challenge;
$$;

CREATE FUNCTION public.store_catalog(p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision) RETURNS TABLE(id uuid, brand text, title text, description text, pace_cost integer, tier text, brand_color text, brand_initial text, value_label text, category text, status text, sort_order integer, starts_at timestamp with time zone, expires_at timestamp with time zone, plus_only boolean, min_rank text, stock_left integer, lock_reason text, redeemed boolean, my_code text, how_to_use text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

CREATE FUNCTION public.submit_partner_application(p_name text, p_category text, p_contact_name text, p_contact_email text, p_website text, p_countries text[], p_cities text[], p_offer text, p_estimated_stock integer) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
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
$_$;


-- ── Foreign keys ──────────────────────────────────────────────────────

ALTER TABLE ONLY public.pace_redemptions
    ADD CONSTRAINT pace_redemptions_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.pace_store_rewards(id);

ALTER TABLE ONLY public.pace_redemptions
    ADD CONSTRAINT pace_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pace_store_rewards
    ADD CONSTRAINT pace_store_rewards_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.reward_codes
    ADD CONSTRAINT reward_codes_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.reward_codes
    ADD CONSTRAINT reward_codes_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.pace_store_rewards(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.reward_events
    ADD CONSTRAINT reward_events_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.reward_events
    ADD CONSTRAINT reward_events_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.pace_store_rewards(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sponsored_challenge_entries
    ADD CONSTRAINT sponsored_challenge_entries_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.sponsored_challenges(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sponsored_challenge_entries
    ADD CONSTRAINT sponsored_challenge_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sponsored_challenges
    ADD CONSTRAINT sponsored_challenges_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.sponsored_challenges
    ADD CONSTRAINT sponsored_challenges_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.pace_store_rewards(id) ON DELETE RESTRICT;


-- ── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX idx_pace_redemptions_user ON public.pace_redemptions USING btree (user_id);

CREATE INDEX idx_partners_applied_email ON public.partners USING btree (lower(contact_email), applied_at) WHERE (status = 'applied'::text);

CREATE INDEX idx_reward_codes_free ON public.reward_codes USING btree (reward_id, created_at) WHERE (assigned_to IS NULL);

CREATE INDEX idx_reward_events_partner_time ON public.reward_events USING btree (partner_id, created_at);

CREATE INDEX idx_rewards_partner ON public.pace_store_rewards USING btree (partner_id);


-- ── Triggers ──────────────────────────────────────────────────────────

CREATE TRIGGER rewards_updated_at BEFORE UPDATE ON public.pace_store_rewards FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_hold_risky_redemption BEFORE INSERT ON public.pace_redemptions FOR EACH ROW EXECUTE FUNCTION public.hold_risky_redemption();


-- ── Row-level security ────────────────────────────────────────────────

ALTER TABLE public.pace_redemptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pace_store_rewards ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.redemption_holds ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reward_codes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reward_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reward_view_keys ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sponsored_challenge_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sponsored_challenges ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.store_cities ENABLE ROW LEVEL SECURITY;


-- ── Policies ──────────────────────────────────────────────────────────

CREATE POLICY "pace_redemptions: read own" ON public.pace_redemptions FOR SELECT USING ((auth.uid() = user_id));

CREATE POLICY "promotions: admin full access" ON public.promotions USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.subscription_tier = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.subscription_tier = 'admin'::text)))));

CREATE POLICY "promotions: anyone can read" ON public.promotions FOR SELECT USING (true);

CREATE POLICY reward_codes_read_own ON public.reward_codes FOR SELECT TO authenticated USING (((assigned_to = auth.uid()) AND (NOT (EXISTS ( SELECT 1
   FROM public.pace_redemptions red
  WHERE ((red.user_id = auth.uid()) AND (red.reward_id = reward_codes.reward_id) AND (red.review_status = 'held'::text)))))));

CREATE POLICY rewards_admin_all ON public.pace_store_rewards TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.subscription_tier = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.subscription_tier = 'admin'::text)))));

CREATE POLICY rewards_public_read ON public.pace_store_rewards FOR SELECT USING ((status <> 'hidden'::text));

CREATE POLICY sc_read ON public.sponsored_challenges FOR SELECT TO authenticated USING ((status = 'live'::text));

CREATE POLICY sce_own ON public.sponsored_challenge_entries FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY store_cities_read ON public.store_cities FOR SELECT USING (true);


-- ── Comments ──────────────────────────────────────────────────────────

COMMENT ON TABLE public.pace_redemptions IS 'Ledger of PACE spent on rewards. The only writer is redeem_reward() — no direct insert/update policy exists for authenticated users.';


-- ── Grants ────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.billable_redemptions(p_partner_id uuid, p_month date) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.billable_redemptions(p_partner_id uuid, p_month date) TO service_role;

REVOKE ALL ON FUNCTION public.claim_sponsored_reward(p_challenge uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.claim_sponsored_reward(p_challenge uuid) TO authenticated;
GRANT ALL ON FUNCTION public.claim_sponsored_reward(p_challenge uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fraud_review_queue(p_partner_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.fraud_review_queue(p_partner_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.join_sponsored_challenge(p_challenge uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.join_sponsored_challenge(p_challenge uuid) TO authenticated;
GRANT ALL ON FUNCTION public.join_sponsored_challenge(p_challenge uuid) TO service_role;

REVOKE ALL ON FUNCTION public.list_sponsored_challenges() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.list_sponsored_challenges() TO authenticated;
GRANT ALL ON FUNCTION public.list_sponsored_challenges() TO service_role;

REVOKE ALL ON FUNCTION public.log_reward_view(p_reward_id uuid, p_lat double precision, p_lng double precision) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.log_reward_view(p_reward_id uuid, p_lat double precision, p_lng double precision) TO authenticated;
GRANT ALL ON FUNCTION public.log_reward_view(p_reward_id uuid, p_lat double precision, p_lng double precision) TO service_role;

REVOKE ALL ON FUNCTION public.partner_monthly_report(p_partner_id uuid, p_month date) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.partner_monthly_report(p_partner_id uuid, p_month date) TO service_role;

REVOKE ALL ON FUNCTION public.redeem_reward(p_user_id uuid, p_reward_id uuid, p_lat double precision, p_lng double precision) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.redeem_reward(p_user_id uuid, p_reward_id uuid, p_lat double precision, p_lng double precision) TO service_role;

REVOKE ALL ON FUNCTION public.redemption_risk_reason(p_user_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.redemption_risk_reason(p_user_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.review_redemption(p_redemption_id uuid, p_approve boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.review_redemption(p_redemption_id uuid, p_approve boolean) TO service_role;

REVOKE ALL ON FUNCTION public.reward_block_reason(p_reward_id uuid, p_user_id uuid, p_check_balance boolean, p_now timestamp with time zone, p_point public.geometry) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.reward_block_reason(p_reward_id uuid, p_user_id uuid, p_check_balance boolean, p_now timestamp with time zone, p_point public.geometry) TO service_role;

REVOKE ALL ON FUNCTION public.send_reward_nudges(p_now timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.send_reward_nudges(p_now timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.sponsored_progress(p_challenge uuid, p_user uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.sponsored_progress(p_challenge uuid, p_user uuid) TO service_role;

REVOKE ALL ON FUNCTION public.store_catalog(p_lat double precision, p_lng double precision) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.store_catalog(p_lat double precision, p_lng double precision) TO authenticated;
GRANT ALL ON FUNCTION public.store_catalog(p_lat double precision, p_lng double precision) TO service_role;

REVOKE ALL ON FUNCTION public.submit_partner_application(p_name text, p_category text, p_contact_name text, p_contact_email text, p_website text, p_countries text[], p_cities text[], p_offer text, p_estimated_stock integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.submit_partner_application(p_name text, p_category text, p_contact_name text, p_contact_email text, p_website text, p_countries text[], p_cities text[], p_offer text, p_estimated_stock integer) TO service_role;


-- ── Starting data ──────────────────────────────────────────────────────

INSERT INTO public.pace_store_rewards (id, brand, title, description, pace_cost, tier, brand_color, brand_initial, value_label, category, status, sort_order, expires_at, created_at, updated_at, stock, partner_id, plus_only, min_rank, countries, cities, starts_at, code_mode, static_code, how_to_use) VALUES ('c743c9bd-3525-4ca9-a22b-a38edb219c9e', 'Brooks', '20% off Brooks Running', 'Redeem for 20% off your next Brooks Running order. Valid on full-price items.', 75, 'entry', '#0084D6', 'B', '20% off', 'gear', 'hidden', 1, NULL, '2026-11-17 16:17:44.408188+00', '2026-11-17 16:17:49.354771+00', NULL, NULL, false, NULL, NULL, NULL, NULL, 'none', NULL, NULL);
INSERT INTO public.store_cities (name, country, center, radius_km) VALUES ('Bengaluru', 'IN', '0101000020E6100000E78C28ED0D6653405396218E75F12940', 35);
INSERT INTO public.store_cities (name, country, center, radius_km) VALUES ('Mumbai', 'IN', '0101000020E6100000C0EC9E3C2C385240FA7E6ABC74133340', 35);
INSERT INTO public.store_cities (name, country, center, radius_km) VALUES ('Delhi', 'IN', '0101000020E61000004C378941604D5340B003E78C289D3C40', 35);
INSERT INTO public.store_cities (name, country, center, radius_km) VALUES ('Pune', 'IN', '0101000020E6100000ED9E3C2CD4765240A1D634EF38853240', 35);
INSERT INTO public.store_cities (name, country, center, radius_km) VALUES ('Hyderabad', 'IN', '0101000020E6100000A5BDC117269F5340C3F5285C8F623140', 35);
INSERT INTO public.store_cities (name, country, center, radius_km) VALUES ('Chennai', 'IN', '0101000020E6100000BEC117265311544027C286A7572A2A40', 35);
INSERT INTO public.store_cities (name, country, center, radius_km) VALUES ('Kolkata', 'IN', '0101000020E6100000ECC039234A1756408AB0E1E995923640', 35);

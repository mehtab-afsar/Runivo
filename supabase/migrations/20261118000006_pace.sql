-- ========================================================================
-- PACE and missions
-- ========================================================================
-- The PACE ledger, missions, awards and referrals.
--
-- One file per feature: this file creates everything this feature owns
-- (tables, functions, triggers, row-level security, grants, scheduled jobs).
-- It needs only the files before it. Built from the 178 migrations up to
-- 20261117000012 (the 178 old files were removed after commit 9e5cf19; see git history); a fresh
-- database built from these files matches one built from those exactly.
--
-- Tables: mission_claims, mission_progress, pace_awards, pace_discrepancy_log, referrals, user_awards

SET check_function_bodies = false;
SET client_min_messages = warning;
SET search_path = public, extensions;


-- ── Sequences ─────────────────────────────────────────────────────────

CREATE SEQUENCE public.pace_awards_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ── Tables ────────────────────────────────────────────────────────────

CREATE TABLE public.mission_claims (
    user_id uuid NOT NULL,
    mission_id text NOT NULL,
    pace_earned integer DEFAULT 0 NOT NULL,
    claimed_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.mission_progress (
    id text NOT NULL,
    user_id uuid NOT NULL,
    mission_type text NOT NULL,
    current_value numeric(10,3) DEFAULT 0 NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    claimed boolean DEFAULT false NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.pace_awards (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    source text NOT NULL,
    source_key text NOT NULL,
    requested integer NOT NULL,
    credited integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pace_awards_source_check CHECK ((source = ANY (ARRAY['run'::text, 'mission'::text, 'campaign'::text, 'adjustment'::text, 'territory_event'::text, 'referral'::text])))
);

CREATE TABLE public.pace_discrepancy_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    run_id uuid NOT NULL,
    client_pace integer NOT NULL,
    server_pace integer NOT NULL,
    distance_km numeric NOT NULL,
    gps_point_count integer NOT NULL,
    logged_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.referrals (
    referred_id uuid NOT NULL,
    referrer_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    rewarded_at timestamp with time zone,
    CONSTRAINT referrals_check CHECK ((referred_id <> referrer_id))
);

CREATE TABLE public.user_awards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    award_id text NOT NULL,
    unlocked_at timestamp with time zone DEFAULT now() NOT NULL
);


-- ── Defaults ──────────────────────────────────────────────────────────

ALTER SEQUENCE public.pace_awards_id_seq OWNED BY public.pace_awards.id;

ALTER TABLE ONLY public.pace_awards ALTER COLUMN id SET DEFAULT nextval('public.pace_awards_id_seq'::regclass);


-- ── Keys and checks ───────────────────────────────────────────────────

ALTER TABLE ONLY public.mission_claims
    ADD CONSTRAINT mission_claims_pkey PRIMARY KEY (user_id, mission_id);

ALTER TABLE ONLY public.mission_progress
    ADD CONSTRAINT mission_progress_pkey PRIMARY KEY (id, user_id);

ALTER TABLE ONLY public.user_awards
    ADD CONSTRAINT no_duplicate_award UNIQUE (user_id, award_id);

ALTER TABLE ONLY public.pace_awards
    ADD CONSTRAINT pace_awards_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pace_awards
    ADD CONSTRAINT pace_awards_source_source_key_key UNIQUE (source, source_key);

ALTER TABLE ONLY public.pace_discrepancy_log
    ADD CONSTRAINT pace_discrepancy_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (referred_id);

ALTER TABLE ONLY public.user_awards
    ADD CONSTRAINT user_awards_pkey PRIMARY KEY (id);


-- ── Functions ─────────────────────────────────────────────────────────

CREATE FUNCTION public.apply_pace_adjustment(p_user_id uuid, p_pace_delta integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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

CREATE FUNCTION public.award_referral_on_run() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  ref referrals%ROWTYPE;
  v_name text;
BEGIN
  -- Only the server-verified distance (process-run-territory) counts, never the
  -- distance the phone wrote, so a made-up run can't pay out the invite.
  IF COALESCE(NEW.verified_distance_m, 0) < 1000 OR NEW.excluded
     OR NEW.integrity_status NOT IN ('ok', 'cleared') THEN
    RETURN NEW;
  END IF;
  SELECT * INTO ref FROM referrals WHERE referred_id = NEW.user_id AND rewarded_at IS NULL FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN NEW; END IF;
  BEGIN
    UPDATE referrals SET rewarded_at = now() WHERE referred_id = ref.referred_id;
    PERFORM public.credit_pace_capped(ref.referred_id, 50, 'referral', ref.referred_id::text || ':joined');
    PERFORM public.credit_pace_capped(ref.referrer_id, 50, 'referral', ref.referred_id::text || ':inviter');
    SELECT username INTO v_name FROM profiles WHERE id = ref.referred_id;
    INSERT INTO notifications (user_id, type, title, body, action_url, dedupe_key)
    VALUES (ref.referrer_id, 'referral', COALESCE(v_name, 'Your friend') || ' finished their first run',
            'You both got 50 PACE for the invite.', '/store', 'referral:' || ref.referred_id::text);
  EXCEPTION WHEN OTHERS THEN
    -- Never block saving a run over an invite reward.
    RAISE WARNING 'referral award failed for %: %', ref.referred_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.claim_event_finish(p_event uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM event_result(p_event) WHERE is_me) THEN RETURN false; END IF;
  INSERT INTO event_finishers (event_id, user_id) VALUES (p_event, auth.uid()) ON CONFLICT DO NOTHING;
  INSERT INTO user_awards (user_id, award_id) VALUES (auth.uid(), 'event_finisher') ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

CREATE FUNCTION public.claim_mission_reward(p_mission_id text, p_title text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_reward int;
  v_today  date := (now() AT TIME ZONE 'UTC')::date;
  v_credit int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  v_reward := public.mission_pace_reward(p_title);
  IF v_reward IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT public.mission_completed_today(auth.uid(), p_title) THEN
    RETURN 0;
  END IF;

  -- History row (kept for the app's "claimed" state); the ledger key below is
  -- what actually stops a second payout, whatever mission id the app sends.
  INSERT INTO public.mission_claims (user_id, mission_id, pace_earned)
  VALUES (auth.uid(), p_mission_id, 0)
  ON CONFLICT (user_id, mission_id) DO NOTHING;

  v_credit := public.credit_pace_capped(
    auth.uid(), v_reward, 'mission',
    auth.uid()::text || ':' || p_title || ':' || v_today::text
  );

  UPDATE public.mission_claims SET pace_earned = v_credit
  WHERE user_id = auth.uid() AND mission_id = p_mission_id;

  RETURN v_credit;
END;
$$;

CREATE FUNCTION public.credit_pace_capped(p_user_id uuid, p_amount integer, p_source text, p_source_key text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_week_start timestamptz := date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_weekly     int;
  v_reset_at   timestamptz;
  v_tier       text;
  v_total      int;
  v_cap        int;
  v_credit     int;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.pace_awards (user_id, source, source_key, requested)
  VALUES (p_user_id, p_source, p_source_key, p_amount)
  ON CONFLICT (source, source_key) DO NOTHING;
  IF NOT FOUND THEN
    RETURN 0; -- already awarded: replays pay nothing
  END IF;

  SELECT pace_weekly_earned, pace_weekly_reset_at, subscription_tier, pace_total_earned
    INTO v_weekly, v_reset_at, v_tier, v_total
    FROM public.profiles WHERE id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF v_reset_at IS NULL OR v_reset_at < v_week_start THEN
    v_weekly := 0;
  END IF;
  v_weekly := COALESCE(v_weekly, 0);
  v_cap    := CASE WHEN public.effective_tier(v_tier) IN ('premium', 'admin') THEN 150 ELSE 100 END;
  v_credit := LEAST(p_amount, GREATEST(0, v_cap - v_weekly));
  v_total  := COALESCE(v_total, 0) + v_credit;

  PERFORM set_config('runivo.trusted_writer', 'on', true);
  UPDATE public.profiles
  SET pace_balance         = COALESCE(pace_balance, 0) + v_credit,
      pace_total_earned    = v_total,
      pace_weekly_earned   = v_weekly + v_credit,
      pace_weekly_reset_at = v_week_start,
      runner_rank          = public.rank_for_pace(v_total)
  WHERE id = p_user_id;
  PERFORM set_config('runivo.trusted_writer', 'off', true);

  UPDATE public.pace_awards SET credited = v_credit
  WHERE source = p_source AND source_key = p_source_key;

  RETURN v_credit;
END;
$$;

CREATE FUNCTION public.diagnose_pace_ledger() RETURNS TABLE(user_id uuid, username text, pace_balance integer, pace_total_earned integer, runs_xp_sum bigint, gap bigint)
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

CREATE FUNCTION public.grant_award(p_user_id uuid, p_award_id text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO user_awards (user_id, award_id) VALUES (p_user_id, p_award_id)
    ON CONFLICT (user_id, award_id) DO NOTHING;
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.mission_completed_today(p_user_id uuid, p_title text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_today       date := (now() AT TIME ZONE 'UTC')::date;
  v_distance_m  numeric;
  v_territories int;
  v_streak_days int;
BEGIN
  -- verified_distance_m is 0 until the server has processed the run and for
  -- flagged (mock-location) runs, which covers 20261115000018's processed and
  -- not-flagged checks; its integrity filters stay.
  SELECT COALESCE(SUM(verified_distance_m), 0) INTO v_distance_m
    FROM public.runs
    WHERE user_id = p_user_id AND (started_at AT TIME ZONE 'UTC')::date = v_today
      AND NOT excluded
      AND integrity_status IN ('ok', 'cleared');

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

CREATE FUNCTION public.mission_pace_reward(p_title text) RETURNS integer
    LANGUAGE sql IMMUTABLE
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
    WHEN 'New Route'          THEN 6
    WHEN 'Chart New Ground'   THEN 9
    ELSE NULL
  END;
$$;

CREATE FUNCTION public.my_referral_code() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_me   uuid := auth.uid();
  v_code text;
  v_abc  text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT referral_code INTO v_code FROM profiles WHERE id = v_me;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  FOR i IN 1..10 LOOP
    SELECT string_agg(substr(v_abc, 1 + (get_byte(b, k) % length(v_abc)), 1), '')
      INTO v_code
      FROM (SELECT gen_random_bytes(8) AS b) r, generate_series(0, 7) k;
    BEGIN
      UPDATE profiles SET referral_code = v_code WHERE id = v_me AND referral_code IS NULL;
      RETURN (SELECT referral_code FROM profiles WHERE id = v_me);
    EXCEPTION WHEN unique_violation THEN
      -- another runner has it; try again
    END;
  END LOOP;
  RAISE EXCEPTION 'could not make an invite code';
END;
$$;

CREATE FUNCTION public.notify_pace_milestones() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_week_start timestamptz := date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_week_key   text        := to_char(v_week_start AT TIME ZONE 'UTC', 'IYYY-IW');
  v_cap        int         := CASE WHEN public.effective_tier(NEW.subscription_tier) IN ('premium', 'admin') THEN 150 ELSE 100 END;
  v_old        int         := CASE WHEN OLD.pace_weekly_reset_at IS NULL OR OLD.pace_weekly_reset_at < v_week_start
                                   THEN 0 ELSE COALESCE(OLD.pace_weekly_earned, 0) END;
  v_new        int         := COALESCE(NEW.pace_weekly_earned, 0);
BEGIN
  IF v_new >= v_cap AND v_old < v_cap THEN
    PERFORM queue_notification(NEW.id, 'pace_cap', 'Weekly PACE cap reached',
      CASE WHEN v_cap < 150
           THEN 'You''ve earned all ' || v_cap || ' PACE this week. Runivo Plus runners earn up to 150. Resets Monday.'
           ELSE 'You''ve earned all ' || v_cap || ' PACE this week. Resets Monday — keep defending your zones.' END,
      '/store', 'pace_cap:' || v_week_key, true);
  ELSIF v_new >= v_cap * 0.8 AND v_old < v_cap * 0.8 THEN
    PERFORM queue_notification(NEW.id, 'pace_cap_near', (v_cap - v_new) || ' PACE left this week',
      'You''re close to this week''s cap. Spend it in the PACE Store, or save up for a bigger reward.',
      '/store', 'pace_cap_near:' || v_week_key, true);
  END IF;

  IF NEW.runner_rank IS DISTINCT FROM OLD.runner_rank AND OLD.runner_rank IS NOT NULL
     AND array_position(ARRAY['pacer','strider','chaser','hunter','sovereign'], NEW.runner_rank)
       > array_position(ARRAY['pacer','strider','chaser','hunter','sovereign'], OLD.runner_rank) THEN
    PERFORM queue_notification(NEW.id, 'rank_up',
      'You''re a ' || initcap(NEW.runner_rank) || ' now',
      'New rank unlocked. Your profile shows it to every rival on the map.',
      '/profile', 'rank_up:' || NEW.runner_rank, true);
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.rank_for_pace(p_total integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE
    WHEN p_total >= 4000 THEN 'sovereign'
    WHEN p_total >= 1500 THEN 'hunter'
    WHEN p_total >=  600 THEN 'chaser'
    WHEN p_total >=  200 THEN 'strider'
    ELSE 'pacer'
  END;
$$;

CREATE FUNCTION public.rank_index(p_rank text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT COALESCE(array_position(ARRAY['pacer','strider','chaser','hunter','sovereign'], p_rank), 1);
$$;

CREATE FUNCTION public.redeem_referral(p_code text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_me      uuid := auth.uid();
  v_owner   uuid;
  v_created timestamptz;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT id INTO v_owner FROM profiles WHERE referral_code = upper(trim(p_code));
  IF v_owner IS NULL THEN RETURN 'invalid'; END IF;
  IF v_owner = v_me THEN RETURN 'own_code'; END IF;
  SELECT created_at INTO v_created FROM auth.users WHERE id = v_me;
  IF v_created IS NULL OR v_created < now() - interval '14 days' THEN RETURN 'too_late'; END IF;
  IF EXISTS (SELECT 1 FROM referrals WHERE referred_id = v_me) THEN RETURN 'already'; END IF;
  IF public.is_blocked_between(v_me, v_owner) THEN RETURN 'blocked'; END IF;
  INSERT INTO referrals (referred_id, referrer_id) VALUES (v_me, v_owner) ON CONFLICT DO NOTHING;
  RETURN 'ok';
END;
$$;

CREATE FUNCTION public.sync_user_awards(p_user_id uuid) RETURNS text[]
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_total_km       FLOAT8;
  v_best_run_km    FLOAT8;
  v_month_km       FLOAT8;
  v_early_count    INT;
  v_streak_days    INT;
  v_pace_total     INT;
  v_runner_rank    TEXT;
  v_owns_any       BOOLEAN;
  v_owns_district  BOOLEAN;
  v_owns_quarter   BOOLEAN;
  v_owns_domain    BOOLEAN;
  v_owns_loop_fill BOOLEAN;
  v_territory_area FLOAT8;
  v_candidate      TEXT;
  v_granted        TEXT[] := '{}';
BEGIN
  SELECT COALESCE(SUM(verified_distance_m), 0) / 1000.0, COALESCE(MAX(verified_distance_m), 0) / 1000.0
    INTO v_total_km, v_best_run_km
    FROM runs WHERE user_id = p_user_id AND activity_type = 'run';

  SELECT COALESCE(MAX(month_km), 0) INTO v_month_km FROM (
    SELECT SUM(verified_distance_m) / 1000.0 AS month_km
    FROM runs WHERE user_id = p_user_id AND activity_type = 'run'
    GROUP BY date_trunc('month', started_at)
  ) months;

  -- UTC hour, not the runner's local time (the server has no notion of it —
  -- same caveat already documented for streak crediting in process-run-territory).
  SELECT COUNT(*) INTO v_early_count
    FROM runs
    WHERE user_id = p_user_id AND activity_type = 'run'
      AND EXTRACT(HOUR FROM started_at AT TIME ZONE 'utc') < 6;

  SELECT streak_days, pace_total_earned, runner_rank
    INTO v_streak_days, v_pace_total, v_runner_rank
    FROM profiles WHERE id = p_user_id;

  SELECT
    bool_or(TRUE),
    bool_or(tier IN ('district', 'quarter', 'domain')),
    bool_or(tier IN ('quarter', 'domain')),
    bool_or(tier = 'domain'),
    bool_or(is_loop_fill),
    COALESCE(SUM(area_m2), 0)
  INTO v_owns_any, v_owns_district, v_owns_quarter, v_owns_domain, v_owns_loop_fill, v_territory_area
  FROM territory_polygons WHERE owner_id = p_user_id;

  FOR v_candidate IN
    SELECT unnest(ARRAY[
      CASE WHEN v_owns_any                                  THEN 'first_claim' END,
      CASE WHEN v_owns_district                             THEN 'district_owner' END,
      CASE WHEN v_owns_quarter                              THEN 'quarter_owner' END,
      CASE WHEN v_owns_domain                                THEN 'domain_lord' END,
      CASE WHEN v_owns_loop_fill                             THEN 'park_capture' END,
      CASE WHEN v_territory_area >= 500000                   THEN 'city_builder' END,
      CASE WHEN v_runner_rank = 'sovereign' OR v_pace_total >= 4000 THEN 'sovereign_rank' END,
      CASE WHEN v_best_run_km >= 5                           THEN 'first_5k' END,
      CASE WHEN v_best_run_km >= 10                          THEN 'first_10k' END,
      CASE WHEN v_best_run_km >= 21                          THEN 'first_halfmarathon' END,
      CASE WHEN v_total_km >= 100                            THEN 'km_100' END,
      CASE WHEN v_total_km >= 500                            THEN 'km_500' END,
      CASE WHEN v_total_km >= 1000                           THEN 'km_1000' END,
      CASE WHEN v_month_km >= 100                            THEN 'monthly_100' END,
      CASE WHEN v_streak_days >= 7                           THEN 'streak_7' END,
      CASE WHEN v_streak_days >= 30                          THEN 'streak_30' END,
      CASE WHEN v_early_count >= 5                           THEN 'early_bird' END
    ])
  LOOP
    CONTINUE WHEN v_candidate IS NULL;
    INSERT INTO user_awards (user_id, award_id) VALUES (p_user_id, v_candidate)
      ON CONFLICT (user_id, award_id) DO NOTHING;
    IF FOUND THEN
      v_granted := array_append(v_granted, v_candidate);
    END IF;
  END LOOP;

  RETURN v_granted;
END;
$$;


-- ── Foreign keys ──────────────────────────────────────────────────────

ALTER TABLE ONLY public.mission_claims
    ADD CONSTRAINT mission_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.mission_progress
    ADD CONSTRAINT mission_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pace_awards
    ADD CONSTRAINT pace_awards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pace_discrepancy_log
    ADD CONSTRAINT pace_discrepancy_log_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pace_discrepancy_log
    ADD CONSTRAINT pace_discrepancy_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_awards
    ADD CONSTRAINT user_awards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- ── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX idx_pace_awards_user ON public.pace_awards USING btree (user_id, created_at DESC);

CREATE INDEX mission_progress_expires_at_idx ON public.mission_progress USING btree (expires_at);

CREATE INDEX mission_progress_user_id_idx ON public.mission_progress USING btree (user_id);

CREATE INDEX referrals_referrer_idx ON public.referrals USING btree (referrer_id);


-- ── Triggers ──────────────────────────────────────────────────────────

CREATE TRIGGER runs_award_referral AFTER INSERT OR UPDATE OF verified_distance_m, integrity_status, excluded ON public.runs FOR EACH ROW EXECUTE FUNCTION public.award_referral_on_run();

CREATE TRIGGER trg_profiles_pace_milestones AFTER UPDATE OF pace_weekly_earned, runner_rank ON public.profiles FOR EACH ROW WHEN (((new.pace_weekly_earned IS DISTINCT FROM old.pace_weekly_earned) OR (new.runner_rank IS DISTINCT FROM old.runner_rank))) EXECUTE FUNCTION public.notify_pace_milestones();


-- ── Row-level security ────────────────────────────────────────────────

ALTER TABLE public.mission_claims ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.mission_progress ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pace_awards ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pace_discrepancy_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_awards ENABLE ROW LEVEL SECURITY;


-- ── Policies ──────────────────────────────────────────────────────────

CREATE POLICY awards_read_own ON public.user_awards FOR SELECT USING (true);

CREATE POLICY "mission_progress: owner can insert" ON public.mission_progress FOR INSERT WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "mission_progress: owner can update" ON public.mission_progress FOR UPDATE USING ((auth.uid() = user_id));

CREATE POLICY "mission_progress: owner only read" ON public.mission_progress FOR SELECT USING ((auth.uid() = user_id));

CREATE POLICY "pace_awards: read own" ON public.pace_awards FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY referrals_own ON public.referrals FOR SELECT TO authenticated USING (((referrer_id = auth.uid()) OR (referred_id = auth.uid())));

CREATE POLICY "users can read their own mission claims" ON public.mission_claims FOR SELECT USING ((auth.uid() = user_id));


-- ── Comments ──────────────────────────────────────────────────────────

COMMENT ON TABLE public.mission_progress IS 'Per-user daily mission progress — server-authoritative.';

COMMENT ON TABLE public.pace_awards IS 'Every PACE credit, once per (source, source_key). Written only by credit_pace_capped().';


-- ── Grants ────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.apply_pace_adjustment(p_user_id uuid, p_pace_delta integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.apply_pace_adjustment(p_user_id uuid, p_pace_delta integer) TO service_role;

REVOKE ALL ON FUNCTION public.award_referral_on_run() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.award_referral_on_run() TO service_role;

REVOKE ALL ON FUNCTION public.claim_event_finish(p_event uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.claim_event_finish(p_event uuid) TO authenticated;
GRANT ALL ON FUNCTION public.claim_event_finish(p_event uuid) TO service_role;

REVOKE ALL ON FUNCTION public.credit_pace_capped(p_user_id uuid, p_amount integer, p_source text, p_source_key text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.credit_pace_capped(p_user_id uuid, p_amount integer, p_source text, p_source_key text) TO service_role;

REVOKE ALL ON FUNCTION public.diagnose_pace_ledger() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.diagnose_pace_ledger() TO service_role;

REVOKE ALL ON FUNCTION public.grant_award(p_user_id uuid, p_award_id text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.grant_award(p_user_id uuid, p_award_id text) TO service_role;

REVOKE ALL ON FUNCTION public.mission_completed_today(p_user_id uuid, p_title text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.mission_completed_today(p_user_id uuid, p_title text) TO service_role;

REVOKE ALL ON FUNCTION public.my_referral_code() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.my_referral_code() TO authenticated;
GRANT ALL ON FUNCTION public.my_referral_code() TO service_role;

REVOKE ALL ON FUNCTION public.redeem_referral(p_code text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.redeem_referral(p_code text) TO authenticated;
GRANT ALL ON FUNCTION public.redeem_referral(p_code text) TO service_role;

REVOKE ALL ON FUNCTION public.sync_user_awards(p_user_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.sync_user_awards(p_user_id uuid) TO service_role;

REVOKE ALL ON TABLE public.referrals FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.referrals TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.referrals TO authenticated;
GRANT ALL ON TABLE public.referrals TO service_role;

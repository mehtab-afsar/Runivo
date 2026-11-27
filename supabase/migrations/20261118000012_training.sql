-- ========================================================================
-- Training and PaceX
-- ========================================================================
-- Training plans, PaceX messages, AI usage, nutrition and weight.
--
-- One file per feature: this file creates everything this feature owns
-- (tables, functions, triggers, row-level security, grants, scheduled jobs).
-- It needs only the files before it. Built from the 178 migrations up to
-- 20261117000012 (the 178 old files were removed after commit 9e5cf19; see git history); a fresh
-- database built from these files matches one built from those exactly.
--
-- Tables: ai_cache, ai_usage_log, coach_messages, nutrition_logs, nutrition_profiles, plan_adaptations, training_plans, weight_logs

SET check_function_bodies = false;
SET client_min_messages = warning;
SET search_path = public, extensions;


-- ── Tables ────────────────────────────────────────────────────────────

CREATE TABLE public.ai_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    feature text NOT NULL,
    payload jsonb NOT NULL,
    context_hash text,
    generated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_usage_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    feature text NOT NULL,
    input_tokens integer NOT NULL,
    output_tokens integer NOT NULL,
    cost_usd numeric(10,6) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reservation boolean DEFAULT false NOT NULL
);

CREATE TABLE public.coach_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    auto_triggered boolean DEFAULT false NOT NULL,
    CONSTRAINT coach_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);

CREATE TABLE public.nutrition_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    log_date date NOT NULL,
    meal text,
    name text NOT NULL,
    kcal numeric(7,2) NOT NULL,
    protein_g numeric(6,2),
    carbs_g numeric(6,2),
    fat_g numeric(6,2),
    serving_size text,
    source text,
    logged_at timestamp with time zone DEFAULT now(),
    xp_awarded boolean DEFAULT false,
    CONSTRAINT nutrition_logs_meal_check CHECK ((meal = ANY (ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'snacks'::text]))),
    CONSTRAINT nutrition_logs_source_check CHECK ((source = ANY (ARRAY['search'::text, 'run'::text, 'manual'::text])))
);

CREATE TABLE public.nutrition_profiles (
    user_id uuid NOT NULL,
    goal text,
    activity_level text,
    diet text,
    weight_kg numeric(6,2),
    height_cm numeric(5,2),
    age integer,
    sex text,
    daily_goal_kcal numeric(7,2),
    protein_goal_g numeric(6,2),
    carbs_goal_g numeric(6,2),
    fat_goal_g numeric(6,2),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT nutrition_profiles_goal_check CHECK ((goal = ANY (ARRAY['lose'::text, 'maintain'::text, 'gain'::text]))),
    CONSTRAINT nutrition_profiles_sex_check CHECK ((sex = ANY (ARRAY['male'::text, 'female'::text])))
);

CREATE TABLE public.plan_adaptations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    week_number integer NOT NULL,
    adaptation_note text,
    adapted_sessions jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.training_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    goal text NOT NULL,
    goal_race_date date,
    weeks_total integer DEFAULT 4 NOT NULL,
    week_current integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    plan_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT training_plans_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'abandoned'::text])))
);

CREATE TABLE public.weight_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    weight_kg numeric(6,2) NOT NULL,
    logged_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT weight_logs_weight_kg_check CHECK (((weight_kg > (0)::numeric) AND (weight_kg < (500)::numeric)))
);


-- ── Keys and checks ───────────────────────────────────────────────────

ALTER TABLE ONLY public.ai_cache
    ADD CONSTRAINT ai_cache_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_cache
    ADD CONSTRAINT ai_cache_user_id_feature_key UNIQUE (user_id, feature);

ALTER TABLE ONLY public.ai_usage_log
    ADD CONSTRAINT ai_usage_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.coach_messages
    ADD CONSTRAINT coach_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.nutrition_logs
    ADD CONSTRAINT nutrition_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.nutrition_profiles
    ADD CONSTRAINT nutrition_profiles_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.plan_adaptations
    ADD CONSTRAINT plan_adaptations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT training_plans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.weight_logs
    ADD CONSTRAINT weight_logs_pkey PRIMARY KEY (id);


-- ── Functions ─────────────────────────────────────────────────────────

CREATE FUNCTION public.advance_training_plan_week() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE training_plans
  SET    week_current = week_current + 1,
         updated_at   = now()
  WHERE  status       = 'active'
    AND  COALESCE(plan_data ->> 'version', '1') <> '2'
    AND  week_current < weeks_total
    AND  created_at <= now() - (week_current * INTERVAL '7 days');

  UPDATE training_plans
  SET    status     = 'completed',
         updated_at = now()
  WHERE  status       = 'active'
    AND  COALESCE(plan_data ->> 'version', '1') <> '2'
    AND  week_current >= weeks_total;
END;
$$;

CREATE FUNCTION public.ai_reserve_spend(p_user uuid, p_feature text, p_estimate_usd numeric, p_daily_cap_usd numeric, p_chat_cap_usd numeric) RETURNS TABLE(reservation_id uuid, refused text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_total numeric;
  v_chat  numeric;
  v_id    uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('ai_spend:' || p_user::text, 0));

  SELECT COALESCE(sum(cost_usd), 0),
         COALESCE(sum(cost_usd) FILTER (WHERE feature = 'coach_chat'), 0)
    INTO v_total, v_chat
    FROM public.ai_usage_log
   WHERE user_id = p_user
     AND created_at > now() - interval '24 hours'
     AND (NOT reservation OR created_at > now() - interval '5 minutes');

  IF v_total >= p_daily_cap_usd THEN
    RETURN QUERY SELECT NULL::uuid, 'daily_limit_reached'::text; RETURN;
  END IF;
  IF p_feature = 'coach_chat' AND v_chat >= p_chat_cap_usd THEN
    RETURN QUERY SELECT NULL::uuid, 'chat_limit_reached'::text; RETURN;
  END IF;

  INSERT INTO public.ai_usage_log (user_id, feature, input_tokens, output_tokens, cost_usd, reservation)
  VALUES (p_user, p_feature, 0, 0, p_estimate_usd, true)
  RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, NULL::text;
END $$;

CREATE FUNCTION public.calculate_bmr(p_weight_kg numeric, p_height_cm smallint, p_age smallint, p_gender text DEFAULT 'other'::text) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  v_base numeric;
  v_bmr  numeric;
BEGIN
  -- Guard
  IF p_weight_kg IS NULL OR p_height_cm IS NULL OR p_age IS NULL THEN
    RETURN NULL;
  END IF;

  v_base := 10 * p_weight_kg + 6.25 * p_height_cm - 5 * p_age;

  v_bmr := CASE p_gender
    WHEN 'male'   THEN v_base + 5
    WHEN 'female' THEN v_base - 161
    ELSE               v_base - 78   -- midpoint of male/female constants
  END;

  RETURN GREATEST(ROUND(v_bmr), 0);
END;
$$;

CREATE FUNCTION public.calculate_calories(p_distance_km numeric, p_duration_sec integer, p_weight_kg numeric DEFAULT 70, p_gender text DEFAULT 'other'::text, p_age smallint DEFAULT 30) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  v_speed_kmh    numeric;
  v_met          numeric;
  v_duration_hrs numeric;
BEGIN
  -- Guard: nothing to calculate
  IF p_duration_sec <= 0 OR p_distance_km <= 0 THEN
    RETURN 0;
  END IF;

  v_duration_hrs := p_duration_sec::numeric / 3600.0;
  v_speed_kmh    := p_distance_km / v_duration_hrs;

  -- MET lookup by pace band
  v_met := CASE
    WHEN v_speed_kmh < 6  THEN 3.5
    WHEN v_speed_kmh < 8  THEN 6.0
    WHEN v_speed_kmh < 10 THEN 8.0
    WHEN v_speed_kmh < 12 THEN 10.0
    ELSE                       12.0
  END;

  RETURN GREATEST(ROUND(v_met * p_weight_kg * v_duration_hrs), 0);
END;
$$;

CREATE FUNCTION public.calculate_calories(p_distance_km numeric, p_duration_sec integer, p_weight_kg numeric DEFAULT 70, p_gender text DEFAULT 'other'::text, p_age integer DEFAULT 30) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  -- Delegate to the smallint variant
  RETURN public.calculate_calories(
    p_distance_km,
    p_duration_sec,
    p_weight_kg,
    p_gender,
    p_age::smallint
  );
END;
$$;

CREATE FUNCTION public.nutrition_logged_now() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.logged_at := now();
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.nutrition_streak_days(p_user_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COUNT(*)::int FROM (
    SELECT log_date
    FROM public.nutrition_logs
    WHERE user_id = p_user_id
      AND log_date > (now() AT TIME ZONE 'UTC')::date - INTERVAL '7 days'
      AND log_date <= (now() AT TIME ZONE 'UTC')::date
      -- logged on the day (one day of slack either side), not backfilled later
      AND logged_at >= log_date - INTERVAL '1 day'
      AND logged_at <  log_date + INTERVAL '2 days'
    GROUP BY log_date
    HAVING COUNT(DISTINCT meal) >= 3
  ) AS qualifying_days
$$;

CREATE FUNCTION public.update_training_plan_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ── Foreign keys ──────────────────────────────────────────────────────

ALTER TABLE ONLY public.ai_cache
    ADD CONSTRAINT ai_cache_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_usage_log
    ADD CONSTRAINT ai_usage_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.coach_messages
    ADD CONSTRAINT coach_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.nutrition_logs
    ADD CONSTRAINT nutrition_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.nutrition_profiles
    ADD CONSTRAINT nutrition_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.plan_adaptations
    ADD CONSTRAINT plan_adaptations_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.training_plans(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT training_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.weekly_consistency
    ADD CONSTRAINT weekly_consistency_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.training_plans(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.weight_logs
    ADD CONSTRAINT weight_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- ── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX ai_usage_log_user_created ON public.ai_usage_log USING btree (user_id, created_at DESC);

CREATE INDEX coach_messages_user_created ON public.coach_messages USING btree (user_id, created_at DESC);

CREATE INDEX idx_plan_adaptations_plan_id ON public.plan_adaptations USING btree (plan_id);

CREATE INDEX idx_training_plans_user_status ON public.training_plans USING btree (user_id, status);

CREATE INDEX nutrition_logs_user_date_idx ON public.nutrition_logs USING btree (user_id, log_date);

CREATE INDEX weight_logs_user_logged_idx ON public.weight_logs USING btree (user_id, logged_at DESC);


-- ── Triggers ──────────────────────────────────────────────────────────

CREATE TRIGGER nutrition_logs_logged_now BEFORE INSERT ON public.nutrition_logs FOR EACH ROW EXECUTE FUNCTION public.nutrition_logged_now();

CREATE TRIGGER training_plans_updated_at BEFORE UPDATE ON public.training_plans FOR EACH ROW EXECUTE FUNCTION public.update_training_plan_timestamp();


-- ── Row-level security ────────────────────────────────────────────────

ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.nutrition_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.plan_adaptations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;


-- ── Policies ──────────────────────────────────────────────────────────

CREATE POLICY "Users own coach_messages" ON public.coach_messages USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users read own ai_cache" ON public.ai_cache FOR SELECT USING ((auth.uid() = user_id));

CREATE POLICY "Users read own ai_usage_log" ON public.ai_usage_log FOR SELECT USING ((auth.uid() = user_id));

CREATE POLICY "Users upsert own ai_cache" ON public.ai_cache USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "nutrition_logs: owner all" ON public.nutrition_logs USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "nutrition_profiles: owner all" ON public.nutrition_profiles USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY plan_adaptations_owner ON public.plan_adaptations USING ((plan_id IN ( SELECT training_plans.id
   FROM public.training_plans
  WHERE (training_plans.user_id = auth.uid()))));

CREATE POLICY training_plans_owner ON public.training_plans USING ((auth.uid() = user_id));

CREATE POLICY "weight_logs: owner all" ON public.weight_logs USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


-- ── Comments ──────────────────────────────────────────────────────────

COMMENT ON FUNCTION public.calculate_bmr(p_weight_kg numeric, p_height_cm smallint, p_age smallint, p_gender text) IS 'Mifflin-St Jeor BMR formula. Returns daily resting kcal.
   Multiply by activity factor (1.2–1.9) for total daily energy expenditure (TDEE).
   Example: SELECT calculate_bmr(75, 178, 28, ''male'');  → ~1818 kcal/day';

COMMENT ON FUNCTION public.calculate_calories(p_distance_km numeric, p_duration_sec integer, p_weight_kg numeric, p_gender text, p_age smallint) IS 'MET-based calorie estimator.
   Args: distance_km, duration_sec, weight_kg (default 70), gender, age.
   Returns kcal burned. Assigns MET from running speed, scales by body weight.
   Example: SELECT calculate_calories(5.0, 1800, 75, ''male'', 28);  → ~525 kcal';

COMMENT ON TABLE public.nutrition_logs IS 'Per-user food log entries synced from the client IndexedDB.';

COMMENT ON TABLE public.nutrition_profiles IS 'Per-user nutrition setup: goal, biometrics, and daily macro targets.';

COMMENT ON TABLE public.weight_logs IS 'Per-user weight history — one row per logged weigh-in, oldest to newest.';


-- ── Grants ────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.advance_training_plan_week() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.advance_training_plan_week() TO service_role;

REVOKE ALL ON FUNCTION public.ai_reserve_spend(p_user uuid, p_feature text, p_estimate_usd numeric, p_daily_cap_usd numeric, p_chat_cap_usd numeric) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.ai_reserve_spend(p_user uuid, p_feature text, p_estimate_usd numeric, p_daily_cap_usd numeric, p_chat_cap_usd numeric) TO service_role;

REVOKE ALL ON FUNCTION public.nutrition_logged_now() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.nutrition_logged_now() TO service_role;

REVOKE ALL ON FUNCTION public.nutrition_streak_days(p_user_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.nutrition_streak_days(p_user_id uuid) TO service_role;


-- ── Scheduled jobs (pg_cron) ────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('advance-training-plan-week', '0 6 * * 1', $cmd$SELECT advance_training_plan_week()$cmd$);
  END IF;
END $$;

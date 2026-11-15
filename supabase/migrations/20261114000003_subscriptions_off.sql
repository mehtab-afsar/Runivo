-- Subscriptions are switched off while Runivo is still being built: every
-- runner gets everything Plus has. One setting drives it; the stored
-- subscription_tier is never changed, so turning subscriptions on at launch
-- (UPDATE app_settings SET value = 'true' WHERE key = 'subscriptions_enabled')
-- gives paying runners Plus and everyone else Free again. The app and the edge
-- functions have matching switches (entitlements.SUBSCRIPTIONS_ENABLED, the
-- SUBSCRIPTIONS_ENABLED secret).

CREATE TABLE IF NOT EXISTS public.app_settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings: read" ON public.app_settings;
CREATE POLICY "app_settings: read" ON public.app_settings FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.app_settings FROM anon, authenticated;
INSERT INTO public.app_settings (key, value) VALUES ('subscriptions_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- The tier the game applies: the stored one, or Plus for everyone while off.
CREATE OR REPLACE FUNCTION public.effective_tier(p_tier text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN COALESCE((SELECT value = 'true'::jsonb FROM public.app_settings WHERE key = 'subscriptions_enabled'), false)
      THEN COALESCE(p_tier, 'free')
    ELSE 'premium'
  END
$$;
GRANT EXECUTE ON FUNCTION public.effective_tier(text) TO anon, authenticated;

-- Weekly PACE cap (150 for Plus).
CREATE OR REPLACE FUNCTION public.credit_pace_capped(p_user_id uuid, p_amount integer, p_source text, p_source_key text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- The cap-reached notice uses the same cap.
CREATE OR REPLACE FUNCTION public.notify_pace_milestones()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Plus-only store rewards.
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
    v_city := city_for_point(COALESCE(p_point, p.last_known_location));
    IF v_city IS NULL OR NOT (v_city = ANY (r.cities)) THEN
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

-- Nudges about Plus-only rewards.
CREATE OR REPLACE FUNCTION public.send_reward_nudges(p_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Hosting public events.
DROP POLICY IF EXISTS "events: premium only" ON public.events;
CREATE POLICY "events: premium only" ON public.events FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles
   WHERE profiles.id = auth.uid()
     AND public.effective_tier(profiles.subscription_tier) = 'premium'
     AND (NOT COALESCE((SELECT value = 'true'::jsonb FROM public.app_settings WHERE key = 'subscriptions_enabled'), false)
          OR profiles.subscription_expires_at IS NULL OR profiles.subscription_expires_at > now())));
DROP POLICY IF EXISTS "events: premium can create" ON public.events;
CREATE POLICY "events: premium can create" ON public.events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid()
           AND public.effective_tier(profiles.subscription_tier) IN ('premium', 'admin'))
  AND (source = 'hosted' OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.subscription_tier = 'admin')));

-- Subscriptions you can't keep without paying.
--
-- 1. RevenueCat can retry and deliver events out of order; a late EXPIRATION
--    used to downgrade a runner who had just renewed. rc-webhook now records
--    the time of the last event it applied (subscription_event_at) and skips
--    older ones. Locked from the app like the tier itself.
-- 2. Expiry is enforced, not just recorded. The Stripe webhook only ever saw
--    the first checkout, so one paid month meant Plus for good, and nothing
--    acted on subscription_expires_at. Once a day, Plus that ended more than
--    3 days ago (time for a late renewal to arrive) goes back to Free.
--    Admins are never touched.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_event_at timestamptz;

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role'
     OR current_setting('runivo.trusted_writer', true) = 'on' THEN
    RETURN NEW;
  END IF;

  NEW.subscription_tier       := OLD.subscription_tier;
  NEW.subscription_expires_at := OLD.subscription_expires_at;
  NEW.subscription_event_at   := OLD.subscription_event_at;
  NEW.pace_balance            := OLD.pace_balance;
  NEW.pace_total_earned       := OLD.pace_total_earned;
  NEW.pace_weekly_earned      := OLD.pace_weekly_earned;
  NEW.pace_weekly_reset_at    := OLD.pace_weekly_reset_at;
  NEW.runner_rank             := OLD.runner_rank;
  NEW.territory_score         := OLD.territory_score;
  NEW.follower_count          := OLD.follower_count;
  NEW.following_count         := OLD.following_count;
  NEW.streak_days             := OLD.streak_days;
  NEW.last_run_date           := OLD.last_run_date;
  NEW.total_distance_km       := OLD.total_distance_km;
  NEW.total_runs              := OLD.total_runs;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_lapsed_subscriptions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  PERFORM set_config('runivo.trusted_writer', 'on', true);
  UPDATE public.profiles
     SET subscription_tier = 'free'
   WHERE subscription_tier = 'premium'
     AND subscription_expires_at IS NOT NULL
     AND subscription_expires_at < now() - interval '3 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.expire_lapsed_subscriptions() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN PERFORM cron.unschedule('expire-lapsed-subscriptions'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule('expire-lapsed-subscriptions', '17 3 * * *', 'SELECT public.expire_lapsed_subscriptions()');
  END IF;
END;
$$;

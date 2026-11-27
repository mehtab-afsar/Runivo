-- ========================================================================
-- Notifications
-- ========================================================================
-- In-app and push notifications, preferences, campaigns and the hourly job.
--
-- One file per feature: this file creates everything this feature owns
-- (tables, functions, triggers, row-level security, grants, scheduled jobs).
-- It needs only the files before it. Built from the 178 migrations up to
-- 20261117000012 (the 178 old files were removed after commit 9e5cf19; see git history); a fresh
-- database built from these files matches one built from those exactly.
--
-- Tables: expo_push_tokens, notification_campaigns, notifications, push_subscriptions

SET check_function_bodies = false;
SET client_min_messages = warning;
SET search_path = public, extensions;


-- ── Sequences ─────────────────────────────────────────────────────────

CREATE SEQUENCE public.expo_push_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ── Tables ────────────────────────────────────────────────────────────

CREATE TABLE public.expo_push_tokens (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    platform text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.notification_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    action_url text DEFAULT '/'::text NOT NULL,
    send_at timestamp with time zone NOT NULL,
    local_hour integer,
    expires_at timestamp with time zone,
    countries text[],
    tiers text[],
    active_within_days integer,
    status text DEFAULT 'scheduled'::text NOT NULL,
    sent_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_campaigns_local_hour_check CHECK (((local_hour >= 7) AND (local_hour <= 21))),
    CONSTRAINT notification_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'done'::text, 'cancelled'::text])))
);

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    action_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    dedupe_key text,
    is_nudge boolean DEFAULT false NOT NULL,
    group_count integer DEFAULT 1 NOT NULL,
    silent boolean DEFAULT false NOT NULL,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['kudos'::text, 'comment'::text, 'territory_claimed'::text, 'territory_lost'::text, 'territory_captured'::text, 'zone_attacked'::text, 'zone_fading'::text, 'event_reminder'::text, 'new_event'::text, 'club_join'::text, 'club_invite'::text, 'streak'::text, 'streak_risk'::text, 'system'::text, 'follow'::text, 'challenge'::text, 'achievement'::text, 'mission_complete'::text, 'rank_up'::text, 'pace_cap'::text, 'pace_cap_near'::text, 'run_reminder'::text, 'weekly_summary'::text, 'campaign'::text, 'cheer'::text, 'referral'::text])))
);

ALTER TABLE ONLY public.notifications REPLICA IDENTITY FULL;

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- ── Defaults ──────────────────────────────────────────────────────────

ALTER SEQUENCE public.expo_push_tokens_id_seq OWNED BY public.expo_push_tokens.id;

ALTER TABLE ONLY public.expo_push_tokens ALTER COLUMN id SET DEFAULT nextval('public.expo_push_tokens_id_seq'::regclass);


-- ── Keys and checks ───────────────────────────────────────────────────

ALTER TABLE ONLY public.expo_push_tokens
    ADD CONSTRAINT expo_push_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.expo_push_tokens
    ADD CONSTRAINT expo_push_tokens_user_token_key UNIQUE (user_id, token);

ALTER TABLE ONLY public.notification_campaigns
    ADD CONSTRAINT notification_campaigns_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint);


-- ── Functions ─────────────────────────────────────────────────────────

CREATE FUNCTION public.expo_push_token_single_owner() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.expo_push_tokens
   WHERE token = NEW.token
     AND user_id <> NEW.user_id;
  RETURN NULL;
END;
$$;

CREATE FUNCTION public.get_email_digest() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT email_digest_enabled FROM profiles WHERE id = auth.uid();
$$;

CREATE FUNCTION public.get_friend_zone_alerts() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT friend_zone_alerts FROM profiles WHERE id = auth.uid();
$$;

CREATE FUNCTION public.get_notification_prefs() RETURNS TABLE(quiet_start integer, quiet_end integer, daily_limit integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT quiet_start, quiet_end, daily_nudge_limit FROM profiles WHERE id = auth.uid();
$$;

CREATE FUNCTION public.in_quiet_hours(p_hour integer, p_start integer, p_end integer) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE
    WHEN p_start = p_end THEN false
    WHEN p_start < p_end THEN p_hour >= p_start AND p_hour < p_end
    ELSE p_hour >= p_start OR p_hour < p_end
  END;
$$;

CREATE FUNCTION public.local_time(p_tz text, p_now timestamp with time zone) RETURNS timestamp without time zone
    LANGUAGE sql STABLE
    AS $$
  SELECT p_now AT TIME ZONE COALESCE(NULLIF(p_tz, ''), 'UTC');
$$;

CREATE FUNCTION public.mark_notifications_read() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  update public.notifications
  set read = true
  where user_id = auth.uid() and read = false;
end;
$$;

CREATE FUNCTION public.notify_push_on_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  edge_url text;
BEGIN
  IF NEW.silent THEN RETURN NEW; END IF;
  edge_url := current_setting('app.edge_function_url', true);
  IF edge_url IS NULL OR edge_url = '' THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url     := edge_url || '/send-push-notification',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
               ),
    body    := jsonb_build_object(
                 'user_id',    NEW.user_id,
                 'title',      NEW.title,
                 'body',       COALESCE(NEW.body, ''),
                 'action_url', COALESCE(NEW.action_url, '/'),
                 'type',       NEW.type
               )::text
  );
  RETURN NEW;
END $$;

CREATE FUNCTION public.queue_notification(p_user_id uuid, p_type text, p_title text, p_body text, p_action_url text, p_dedupe_key text, p_urgent boolean DEFAULT false, p_now timestamp with time zone DEFAULT now()) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_tz    text;
  v_qs    int;
  v_qe    int;
  v_limit int;
  v_local timestamp;
  v_today int;
BEGIN
  SELECT timezone, quiet_start, quiet_end, daily_nudge_limit
    INTO v_tz, v_qs, v_qe, v_limit
    FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;
  v_local := local_time(v_tz, p_now);

  IF NOT p_urgent THEN
    IF in_quiet_hours(extract(hour FROM v_local)::int, v_qs, v_qe) THEN
      RETURN false;
    END IF;
    SELECT count(*) INTO v_today
      FROM notifications
     WHERE user_id = p_user_id AND is_nudge
       AND created_at >= (date_trunc('day', v_local) AT TIME ZONE COALESCE(NULLIF(v_tz, ''), 'UTC'));
    IF v_today >= v_limit THEN
      RETURN false;
    END IF;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, action_url, dedupe_key, is_nudge, created_at)
  VALUES (p_user_id, p_type, p_title, p_body, p_action_url, p_dedupe_key, NOT p_urgent, p_now)
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.run_hourly_notifications(p_now timestamp with time zone DEFAULT now()) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN jsonb_build_object(
    'zone_fading',    send_zone_fading(p_now),
    'streak_risk',    send_streak_risk(p_now),
    'run_reminder',   send_run_reminders_local(p_now),
    'weekly_summary', send_weekly_summaries_local(p_now),
    'campaigns',      send_due_campaigns(p_now),
    'reward_nudges',  send_reward_nudges(p_now)
  );
END;
$$;

CREATE FUNCTION public.send_due_campaigns(p_now timestamp with time zone DEFAULT now()) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE c record; r record; v_sent int := 0; v_n int;
BEGIN
  FOR c IN
    SELECT * FROM notification_campaigns
     WHERE status = 'scheduled' AND send_at <= p_now
     FOR UPDATE SKIP LOCKED
  LOOP
    IF p_now > COALESCE(c.expires_at, c.send_at + interval '36 hours') THEN
      UPDATE notification_campaigns SET status = 'done' WHERE id = c.id;
      CONTINUE;
    END IF;
    v_n := 0;
    FOR r IN
      SELECT p.id FROM profiles p
       WHERE p.notifications_enabled AND p.offers_enabled
         AND (c.countries IS NULL OR p.country = ANY (c.countries))
         AND (c.tiers IS NULL OR COALESCE(p.subscription_tier, 'free') = ANY (c.tiers))
         AND (c.active_within_days IS NULL
              OR p.last_run_date >= (p_now AT TIME ZONE 'UTC')::date - c.active_within_days)
         AND (c.local_hour IS NULL OR extract(hour FROM local_time(p.timezone, p_now)) = c.local_hour)
    LOOP
      IF queue_notification(r.id, 'campaign', c.title, c.body, c.action_url,
                            'campaign:' || c.id, false, p_now) THEN
        v_n := v_n + 1;
      END IF;
    END LOOP;
    UPDATE notification_campaigns SET sent_count = sent_count + v_n WHERE id = c.id;
    v_sent := v_sent + v_n;
  END LOOP;
  RETURN v_sent;
END;
$$;

CREATE FUNCTION public.send_run_reminders() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, action_url)
  SELECT
    p.id, 'run_reminder', 'Time for a run?',
    'You haven''t run in a few days — your streak and territory are waiting.',
    '/run'
  FROM profiles p
  WHERE p.total_runs > 0
    AND p.run_reminders_enabled
    AND p.notifications_enabled
    AND (p.last_run_date IS NULL OR p.last_run_date < (now() AT TIME ZONE 'utc')::date - 3)
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = p.id AND n.type = 'run_reminder' AND n.created_at > now() - INTERVAL '3 days'
    );
END;
$$;

CREATE FUNCTION public.send_run_reminders_local(p_now timestamp with time zone DEFAULT now()) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE r record; v_sent int := 0;
BEGIN
  FOR r IN
    SELECT p.id, p.timezone
      FROM profiles p
     WHERE p.total_runs > 0
       AND p.notifications_enabled AND p.run_reminders_enabled
       AND extract(hour FROM local_time(p.timezone, p_now)) = 18
       AND (p.last_run_date IS NULL OR p.last_run_date < local_time(p.timezone, p_now)::date - 3)
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
          WHERE n.user_id = p.id AND n.type = 'run_reminder' AND n.created_at > p_now - interval '3 days')
  LOOP
    IF queue_notification(
         r.id, 'run_reminder', 'Your streets miss you',
         'It''s been a few days. One run defends your zones and restarts your streak.',
         '/run',
         'run_reminder:' || to_char(local_time(r.timezone, p_now), 'YYYY-MM-DD'),
         false, p_now) THEN
      v_sent := v_sent + 1;
    END IF;
  END LOOP;
  RETURN v_sent;
END;
$$;

CREATE FUNCTION public.send_streak_risk(p_now timestamp with time zone DEFAULT now()) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  r record; v_sent int := 0;
  v_utc       timestamp := p_now AT TIME ZONE 'UTC';
  v_hours_left int      := 24 - extract(hour FROM v_utc)::int;
BEGIN
  IF extract(hour FROM v_utc) NOT BETWEEN 17 AND 21 THEN
    RETURN 0;
  END IF;
  FOR r IN
    SELECT p.id, p.streak_days
      FROM profiles p
     WHERE p.notifications_enabled AND p.run_reminders_enabled
       AND p.streak_days >= 3
       AND p.last_run_date = (v_utc::date - 1)
       AND extract(hour FROM local_time(p.timezone, p_now)) BETWEEN 9 AND 21
  LOOP
    IF queue_notification(
         r.id, 'streak_risk',
         'Your ' || r.streak_days || '-day streak ends in ' || v_hours_left || ' hours',
         'Any run keeps it alive. Even a short one counts.',
         '/run',
         'streak_risk:' || to_char(v_utc, 'YYYY-MM-DD'),
         false, p_now) THEN
      v_sent := v_sent + 1;
    END IF;
  END LOOP;
  RETURN v_sent;
END;
$$;

CREATE FUNCTION public.send_weekly_summaries() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_week_start TIMESTAMPTZ := date_trunc('week', now() AT TIME ZONE 'utc') - INTERVAL '7 days';
  v_week_end   TIMESTAMPTZ := date_trunc('week', now() AT TIME ZONE 'utc');
BEGIN
  INSERT INTO notifications (user_id, type, title, body, action_url)
  SELECT
    r.user_id, 'weekly_summary', 'Your week in review',
    format('You ran %s km across %s run%s last week.',
           to_char(SUM(r.distance_m) / 1000.0, 'FM999990.0'),
           COUNT(*),
           CASE WHEN COUNT(*) = 1 THEN '' ELSE 's' END),
    '/history'
  FROM runs r
  JOIN profiles p ON p.id = r.user_id
  WHERE r.started_at >= v_week_start AND r.started_at < v_week_end
    AND p.weekly_summary_enabled
    AND p.notifications_enabled
  GROUP BY r.user_id
  HAVING COUNT(*) > 0;
END;
$$;

CREATE FUNCTION public.send_weekly_summaries_local(p_now timestamp with time zone DEFAULT now()) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  r record; v_sent int := 0;
  v_week_end   timestamptz := date_trunc('week', p_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_week_start timestamptz := v_week_end - interval '7 days';
BEGIN
  FOR r IN
    SELECT p.id, count(x.id) AS runs, COALESCE(sum(x.distance_m), 0) / 1000.0 AS km
      FROM profiles p
      JOIN runs x ON x.user_id = p.id AND x.started_at >= v_week_start AND x.started_at < v_week_end
     WHERE p.notifications_enabled AND p.weekly_summary_enabled
       AND extract(isodow FROM local_time(p.timezone, p_now)) = 1
       AND extract(hour   FROM local_time(p.timezone, p_now)) = 8
     GROUP BY p.id
  LOOP
    IF queue_notification(
         r.id, 'weekly_summary', 'Your week in review',
         format('%s km across %s run%s. Your PACE cap has reset — new week, new ground.',
                to_char(r.km, 'FM999990.0'), r.runs, CASE WHEN r.runs = 1 THEN '' ELSE 's' END),
         '/history',
         'weekly_summary:' || to_char(v_week_start AT TIME ZONE 'UTC', 'IYYY-IW'),
         false, p_now) THEN
      v_sent := v_sent + 1;
    END IF;
  END LOOP;
  RETURN v_sent;
END;
$$;

CREATE FUNCTION public.send_zone_fading(p_now timestamp with time zone DEFAULT now()) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE r record; v_sent int := 0;
BEGIN
  FOR r IN
    SELECT p.id, p.timezone, count(*) AS n
      FROM profiles p
      JOIN territory_polygons t ON t.owner_id = p.id
     WHERE p.notifications_enabled AND p.territory_alerts_enabled
       AND extract(hour FROM local_time(p.timezone, p_now)) = 8
       AND floor(t.freshness - extract(epoch FROM (p_now - t.last_defended_at)) / 86400.0 * 10) >= 40
       AND floor(t.freshness - extract(epoch FROM (p_now + interval '1 day' - t.last_defended_at)) / 86400.0 * 10) < 40
     GROUP BY p.id, p.timezone
  LOOP
    IF queue_notification(
         r.id, 'zone_fading',
         CASE WHEN r.n = 1 THEN 'A zone fades tomorrow' ELSE r.n || ' zones fade tomorrow' END,
         CASE WHEN r.n = 1 THEN 'Run through it today and it''s back to full strength.'
              ELSE 'Run through them today and they''re back to full strength.' END,
         '/territory-map?filter=stale',
         'zone_fading:' || to_char(local_time(r.timezone, p_now), 'YYYY-MM-DD'),
         false, p_now) THEN
      v_sent := v_sent + 1;
    END IF;
  END LOOP;
  RETURN v_sent;
END;
$$;

CREATE FUNCTION public.set_email_digest(p_on boolean) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE profiles SET email_digest_enabled = p_on WHERE id = auth.uid();
$$;

CREATE FUNCTION public.set_expo_push_token_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.set_friend_zone_alerts(p_on boolean) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE profiles SET friend_zone_alerts = p_on WHERE id = auth.uid();
$$;

CREATE FUNCTION public.set_notification_prefs(p_quiet_start integer, p_quiet_end integer, p_daily_limit integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF p_quiet_start NOT BETWEEN 0 AND 23 OR p_quiet_end NOT BETWEEN 0 AND 23 OR p_daily_limit NOT BETWEEN 0 AND 10 THEN
    RAISE EXCEPTION 'out of range';
  END IF;
  UPDATE profiles SET quiet_start = p_quiet_start, quiet_end = p_quiet_end, daily_nudge_limit = p_daily_limit
   WHERE id = auth.uid();
END;
$$;

CREATE FUNCTION public.unread_notification_count() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select count(*)::int
  from public.notifications
  where user_id = auth.uid() and read = false;
$$;

CREATE FUNCTION public.weekly_digest_rows(p_now timestamp with time zone DEFAULT now()) RETURNS TABLE(user_id uuid, email text, username text, km numeric, runs integer, zones_claimed integer, zones_lost integer, fading integer, pace_earned integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p.id, u.email::text, p.username,
    COALESCE((SELECT round(sum(r.distance_m) / 1000.0, 1) FROM runs r WHERE r.user_id = p.id AND NOT COALESCE(r.excluded, false) AND r.started_at > p_now - interval '7 days'), 0),
    COALESCE((SELECT count(*)::int FROM runs r WHERE r.user_id = p.id AND NOT COALESCE(r.excluded, false) AND r.started_at > p_now - interval '7 days'), 0),
    COALESCE((SELECT count(*)::int FROM zone_events z WHERE z.user_id = p.id AND z.kind IN ('claimed', 'stolen') AND z.at > p_now - interval '7 days'), 0),
    COALESCE((SELECT count(*)::int FROM zone_events z WHERE z.prev_owner_id = p.id AND z.kind = 'stolen' AND z.at > p_now - interval '7 days'), 0),
    COALESCE((SELECT count(*)::int FROM territory_polygons t WHERE t.owner_id = p.id AND t.freshness < 40), 0),
    COALESCE(p.pace_weekly_earned, 0)
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE NOT p.notifications_enabled AND p.email_digest_enabled AND p.weekly_summary_enabled
    AND u.email IS NOT NULL AND u.email NOT LIKE '%@privaterelay.appleid.com'
    AND p.last_run_date >= (p_now - interval '60 days')::date;
$$;


-- ── Foreign keys ──────────────────────────────────────────────────────

ALTER TABLE ONLY public.expo_push_tokens
    ADD CONSTRAINT expo_push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- ── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX idx_expo_push_tokens_user ON public.expo_push_tokens USING btree (user_id);

CREATE UNIQUE INDEX notifications_user_dedupe_uq ON public.notifications USING btree (user_id, dedupe_key) WHERE (dedupe_key IS NOT NULL);

CREATE INDEX notifications_user_nudge_recent ON public.notifications USING btree (user_id, created_at DESC) WHERE is_nudge;

CREATE INDEX notifications_user_unread_idx ON public.notifications USING btree (user_id, read, created_at DESC);


-- ── Triggers ──────────────────────────────────────────────────────────

CREATE TRIGGER trg_expo_push_token_single_owner AFTER INSERT OR UPDATE OF token, user_id ON public.expo_push_tokens FOR EACH ROW EXECUTE FUNCTION public.expo_push_token_single_owner();

CREATE TRIGGER trg_expo_push_tokens_updated BEFORE UPDATE ON public.expo_push_tokens FOR EACH ROW EXECUTE FUNCTION public.set_expo_push_token_updated_at();

CREATE TRIGGER trg_notify_push AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.notify_push_on_notification();


-- ── Row-level security ────────────────────────────────────────────────

ALTER TABLE public.expo_push_tokens ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;


-- ── Policies ──────────────────────────────────────────────────────────

CREATE POLICY "Service role can read all Expo push tokens" ON public.expo_push_tokens FOR SELECT TO service_role USING (true);

CREATE POLICY "Users can manage their own Expo push tokens" ON public.expo_push_tokens TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "notifications: owner can read" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));

CREATE POLICY "notifications: owner can update" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));

CREATE POLICY "notifications: self or service role insert" ON public.notifications FOR INSERT WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "push_subscriptions: owner all" ON public.push_subscriptions USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


-- ── Comments ──────────────────────────────────────────────────────────

COMMENT ON FUNCTION public.notify_push_on_notification() IS 'Fires after notifications INSERT and calls the send-push-notification Edge Function via pg_net.
   Requires pg_net extension and app.edge_function_url / app.service_role_key settings.';

COMMENT ON TABLE public.notifications IS 'In-app notification inbox — one row per event per recipient.';

COMMENT ON TABLE public.push_subscriptions IS 'Web Push endpoint and VAPID key material for each user device.
   Used by the send-push-notification Edge Function.';


-- ── Grants ────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.expo_push_token_single_owner() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.expo_push_token_single_owner() TO service_role;

REVOKE ALL ON FUNCTION public.get_email_digest() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.get_email_digest() TO authenticated;
GRANT ALL ON FUNCTION public.get_email_digest() TO service_role;

REVOKE ALL ON FUNCTION public.get_friend_zone_alerts() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.get_friend_zone_alerts() TO authenticated;
GRANT ALL ON FUNCTION public.get_friend_zone_alerts() TO service_role;

REVOKE ALL ON FUNCTION public.get_notification_prefs() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.get_notification_prefs() TO authenticated;
GRANT ALL ON FUNCTION public.get_notification_prefs() TO service_role;

REVOKE ALL ON FUNCTION public.queue_notification(p_user_id uuid, p_type text, p_title text, p_body text, p_action_url text, p_dedupe_key text, p_urgent boolean, p_now timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.queue_notification(p_user_id uuid, p_type text, p_title text, p_body text, p_action_url text, p_dedupe_key text, p_urgent boolean, p_now timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.run_hourly_notifications(p_now timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.run_hourly_notifications(p_now timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.send_due_campaigns(p_now timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.send_due_campaigns(p_now timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.send_run_reminders() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.send_run_reminders() TO service_role;

REVOKE ALL ON FUNCTION public.send_run_reminders_local(p_now timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.send_run_reminders_local(p_now timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.send_streak_risk(p_now timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.send_streak_risk(p_now timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.send_weekly_summaries() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.send_weekly_summaries() TO service_role;

REVOKE ALL ON FUNCTION public.send_weekly_summaries_local(p_now timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.send_weekly_summaries_local(p_now timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.send_zone_fading(p_now timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.send_zone_fading(p_now timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.set_email_digest(p_on boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.set_email_digest(p_on boolean) TO authenticated;
GRANT ALL ON FUNCTION public.set_email_digest(p_on boolean) TO service_role;

REVOKE ALL ON FUNCTION public.set_friend_zone_alerts(p_on boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.set_friend_zone_alerts(p_on boolean) TO authenticated;
GRANT ALL ON FUNCTION public.set_friend_zone_alerts(p_on boolean) TO service_role;

REVOKE ALL ON FUNCTION public.set_notification_prefs(p_quiet_start integer, p_quiet_end integer, p_daily_limit integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.set_notification_prefs(p_quiet_start integer, p_quiet_end integer, p_daily_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.set_notification_prefs(p_quiet_start integer, p_quiet_end integer, p_daily_limit integer) TO service_role;

REVOKE ALL ON FUNCTION public.weekly_digest_rows(p_now timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.weekly_digest_rows(p_now timestamp with time zone) TO service_role;


-- ── Realtime ───────────────────────────────────────────────────────────

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END;
END $$;


-- ── Scheduled jobs (pg_cron) ────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('notifications-hourly', '2 * * * *', $cmd$SELECT public.run_hourly_notifications()$cmd$);
  END IF;
END $$;

-- ============================================================================
-- V1 notifications: the right push, at the runner's local hour, once.
--
-- Before: two cron jobs on fixed UTC hours (a 15:00 UTC run reminder reaches
-- Mumbai at 20:30 and Los Angeles at 07:00), no fading-zone or streak-risk
-- warnings, no cap/rank alerts, no festive campaigns, no quiet hours, no
-- daily limit, no protection against duplicates.
--
-- Now:
--   * profiles.timezone (IANA, sent by the app; invalid values fall back to UTC)
--   * queue_notification(): one door for every system notification
--       - dedupe_key: each logical alert lands once (unique per user)
--       - nudges respect quiet hours (22:00–07:00 local) and a 3-a-day limit
--       - urgent alerts (cap, rank, things the runner just caused) skip both
--   * run_hourly_notifications(), every hour at :02, sends whatever is due
--     in each runner's local time:
--       zone_fading     08:00  zones that go stale within 24 h
--       streak_risk     17–21 UTC window, 09:00–21:59 local, streak ≥ 3
--                       (streak days are UTC days, matching the server)
--       run_reminder    18:00  3+ days since the last run
--       weekly_summary  Mon 08:00  last PACE week (Monday 00:00 UTC)
--       campaigns       admin-scheduled festive / partner pushes
--   * PACE alerts from the profile row: 80 % of the weekly cap, cap reached,
--     rank up. A trigger, so credit_pace_capped stays exactly as tested.
--   * profiles.offers_enabled: new "Offers & events" toggle for campaigns.
--
-- Every function takes p_now so tests can run any hour of any day.
-- ============================================================================

-- ── 1. Columns ───────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone       text    NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS offers_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS is_nudge   boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_uq
  ON public.notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_user_nudge_recent
  ON public.notifications (user_id, created_at DESC) WHERE is_nudge;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'kudos', 'comment',
  'territory_claimed', 'territory_lost', 'territory_captured', 'zone_attacked', 'zone_fading',
  'event_reminder', 'new_event',
  'club_join', 'club_invite',
  'streak', 'streak_risk', 'system', 'follow', 'challenge',
  'achievement', 'mission_complete',
  'rank_up', 'pace_cap', 'pace_cap_near',
  'run_reminder', 'weekly_summary',
  'campaign'
));

-- A bad zone name would make every local-time query throw; keep only real ones.
CREATE OR REPLACE FUNCTION public.normalize_profile_timezone()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.timezone IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN
    NEW.timezone := 'UTC';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_timezone ON public.profiles;
CREATE TRIGGER trg_profiles_timezone
  BEFORE INSERT OR UPDATE OF timezone ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.normalize_profile_timezone();

-- ── 2. The one door ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.local_time(p_tz text, p_now timestamptz)
RETURNS timestamp LANGUAGE sql STABLE AS $$
  SELECT p_now AT TIME ZONE COALESCE(NULLIF(p_tz, ''), 'UTC');
$$;

-- Returns true if the notification was queued (the insert fires the push).
CREATE OR REPLACE FUNCTION public.queue_notification(
  p_user_id    uuid,
  p_type       text,
  p_title      text,
  p_body       text,
  p_action_url text,
  p_dedupe_key text,
  p_urgent     boolean     DEFAULT false,
  p_now        timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz    text;
  v_local timestamp;
  v_today int;
BEGIN
  SELECT timezone INTO v_tz FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;
  v_local := local_time(v_tz, p_now);

  IF NOT p_urgent THEN
    -- Quiet hours: nothing between 22:00 and 07:00 local.
    IF extract(hour FROM v_local) >= 22 OR extract(hour FROM v_local) < 7 THEN
      RETURN false;
    END IF;
    -- At most 3 nudges per local day.
    SELECT count(*) INTO v_today
      FROM notifications
     WHERE user_id = p_user_id AND is_nudge
       AND created_at >= (date_trunc('day', v_local) AT TIME ZONE COALESCE(NULLIF(v_tz, ''), 'UTC'));
    IF v_today >= 3 THEN
      RETURN false;
    END IF;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, action_url, dedupe_key, is_nudge, created_at)
  VALUES (p_user_id, p_type, p_title, p_body, p_action_url, p_dedupe_key, NOT p_urgent, p_now)
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN FOUND;
END;
$$;

-- ── 3. Hourly senders ───────────────────────────────────────────────────────

-- Zones that are still fresh now but drop below 40 within 24 h (decay is
-- 10 a day, floored — same rule as the app and get_territory_score).
CREATE OR REPLACE FUNCTION public.send_zone_fading(p_now timestamptz DEFAULT now())
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- Streak days are UTC days (process-run-territory), so the deadline is
-- 00:00 UTC. Warn in the last 3–7 hours, only during the runner's day.
CREATE OR REPLACE FUNCTION public.send_streak_risk(p_now timestamptz DEFAULT now())
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- 18:00 local, 3+ days since the last run, at most every 3 days.
CREATE OR REPLACE FUNCTION public.send_run_reminders_local(p_now timestamptz DEFAULT now())
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- Monday 08:00 local: the PACE week that just ended (Monday 00:00 UTC).
CREATE OR REPLACE FUNCTION public.send_weekly_summaries_local(p_now timestamptz DEFAULT now())
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- ── 4. Campaigns (festive offers, partner drops, city events) ───────────────
-- Created by the team from the admin site (service role). Nothing here is
-- readable or writable by the app.

CREATE TABLE IF NOT EXISTS public.notification_campaigns (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text        NOT NULL,              -- internal, e.g. 'Diwali 2026 double-zone week'
  title              text        NOT NULL,
  body               text        NOT NULL,
  action_url         text        NOT NULL DEFAULT '/',
  send_at            timestamptz NOT NULL,              -- not before this moment
  local_hour         int         CHECK (local_hour BETWEEN 7 AND 21), -- send at this local hour; null = as soon as due
  expires_at         timestamptz,                       -- default send_at + 36 h
  countries          text[],                            -- null = everywhere
  tiers              text[],                            -- null = every tier, e.g. '{free}'
  active_within_days int,                               -- null = everyone; 30 = ran in the last 30 days
  status             text        NOT NULL DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'done', 'cancelled')),
  sent_count         int         NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.

CREATE OR REPLACE FUNCTION public.send_due_campaigns(p_now timestamptz DEFAULT now())
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

CREATE OR REPLACE FUNCTION public.run_hourly_notifications(p_now timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN jsonb_build_object(
    'zone_fading',    send_zone_fading(p_now),
    'streak_risk',    send_streak_risk(p_now),
    'run_reminder',   send_run_reminders_local(p_now),
    'weekly_summary', send_weekly_summaries_local(p_now),
    'campaigns',      send_due_campaigns(p_now)
  );
END;
$$;

-- ── 5. PACE alerts from the profile row ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_pace_milestones()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_week_start timestamptz := date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_week_key   text        := to_char(v_week_start AT TIME ZONE 'UTC', 'IYYY-IW');
  v_cap        int         := CASE WHEN NEW.subscription_tier IN ('premium', 'admin') THEN 150 ELSE 100 END;
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

DROP TRIGGER IF EXISTS trg_profiles_pace_milestones ON public.profiles;
CREATE TRIGGER trg_profiles_pace_milestones
  AFTER UPDATE OF pace_weekly_earned, runner_rank ON public.profiles
  FOR EACH ROW
  WHEN (NEW.pace_weekly_earned IS DISTINCT FROM OLD.pace_weekly_earned
        OR NEW.runner_rank IS DISTINCT FROM OLD.runner_rank)
  EXECUTE FUNCTION public.notify_pace_milestones();

-- ── 6. Lock down + schedule ─────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.queue_notification(uuid, text, text, text, text, text, boolean, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_zone_fading(timestamptz)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_streak_risk(timestamptz)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_run_reminders_local(timestamptz)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_weekly_summaries_local(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_due_campaigns(timestamptz)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_hourly_notifications(timestamptz)    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_hourly_notifications(timestamptz) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- The old fixed-UTC jobs are replaced by the local-time hourly run.
    BEGIN PERFORM cron.unschedule('send-run-reminders');    EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN PERFORM cron.unschedule('send-weekly-summaries'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule('notifications-hourly', '2 * * * *', 'SELECT public.run_hourly_notifications()');
  END IF;
END;
$$;

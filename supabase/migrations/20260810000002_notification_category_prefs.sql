-- ============================================================
-- Settings screen has 4 notification sub-toggles (Run reminders, Territory
-- alerts, Announce achievements, Weekly summary) under the master Push
-- notifications switch. All 4 persisted locally and looked real, but nothing
-- server-side ever read them — send-push-notification/index.ts destructured
-- `type` from the request body and never used it, even though the
-- notify_push_on_notification() trigger was already passing it
-- (20260520000071_fix_notify_push_type.sql's own comment says this exact
-- wiring was "Required so the edge function can apply per-type suppression
-- (e.g. territory alerts toggle)" — the edge function side of that was never
-- finished). Only the master toggle was ever actually enforced.
--
-- This migration:
--   1. Adds the 4 preference columns to `profiles` (persistSettings now
--      pushes them, matching distance_unit/notifications_enabled).
--   2. Extends notifications_type_check with 'run_reminder' / 'weekly_summary'
--      ('achievement' already existed).
--   3. Adds two cron-driven senders (run reminders, weekly summaries) using
--      the same insert-into-notifications pattern as notify_follow() — the
--      existing trigger fans them out to push automatically. Both are
--      genuinely new notification types; nothing sent these before.
--   4. Category gating itself lives in send-push-notification/index.ts
--      (edited alongside this migration), which is the other half of this fix.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS run_reminders_enabled         BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS territory_alerts_enabled       BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS announce_achievements_enabled  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekly_summary_enabled         BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'kudos', 'comment',
    'territory_claimed', 'territory_lost', 'territory_captured', 'zone_attacked',
    'event_reminder', 'new_event',
    'club_join', 'club_invite',
    'streak', 'system', 'follow', 'challenge',
    'achievement', 'mission_complete',
    'rank_up', 'pace_cap',
    'run_reminder', 'weekly_summary'
  ));

-- ── send_run_reminders — daily: nudge users who haven't run in 3+ days ───────
-- Only ever reminds someone who has actually run before (total_runs > 0) — a
-- brand-new user who hasn't started yet doesn't need a "you haven't run in a
-- while" push. Re-reminding is capped to once every 3 days via the NOT EXISTS
-- check so this doesn't spam daily once someone goes inactive.

CREATE OR REPLACE FUNCTION send_run_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- ── send_weekly_summaries — Monday 08:00 UTC: last week's distance + runs ────
-- Reuses the same owner-scoped, coordinate-free aggregation as
-- get_run_km_by_user (20260701000076_runs_owner_scope.sql) — no GPS data
-- involved, just a per-user sum for the prior UTC week.

CREATE OR REPLACE FUNCTION send_weekly_summaries()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- Both are batch jobs meant to be fired only by cron (as the migration-owning
-- role, which bypasses grants entirely) — same reasoning as the territory RPCs
-- in 20260809000003_award_grant_hardening.sql: this project's public-schema
-- default privileges hand EXECUTE to anon/authenticated on every new function
-- unless explicitly revoked. Neither function exposes anything sensitive on
-- its own, but a client shouldn't be able to force the whole user base's
-- reminder/summary batch to run on demand.
REVOKE EXECUTE ON FUNCTION send_run_reminders()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION send_weekly_summaries() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('send-run-reminders',  '0 15 * * *', 'SELECT send_run_reminders()');
    PERFORM cron.schedule('send-weekly-summaries', '0 8 * * 1',  'SELECT send_weekly_summaries()');
  END IF;
END;
$$;

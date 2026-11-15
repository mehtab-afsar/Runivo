-- v1 notifications: local time, quiet hours, daily limit, dedupe, each sender.
-- Run after _stub_supabase.sql, 20261106000001, _stub_notifications.sql, 20261106000002.
\set ON_ERROR_STOP on
BEGIN;
-- These checks cover the Free/Plus rules as they'll run once subscriptions are on.
UPDATE public.app_settings SET value = 'true' WHERE key = 'subscriptions_enabled';
SET client_min_messages = notice;

CREATE OR REPLACE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF;
  RAISE NOTICE 'ok  %', what;
END $$;

-- Runners: Mumbai (UTC+5:30), London (UTC+0 in Nov), Los Angeles (UTC-8 in Nov).
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'v1-a0000000-0@example.com'),
  ('a0000000-0000-0000-0000-000000000002', 'v1-a0000000-1@example.com'),
  ('a0000000-0000-0000-0000-000000000003', 'v1-a0000000-2@example.com'),
  ('a0000000-0000-0000-0000-000000000004', 'v1-a0000000-3@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO profiles (id, username, timezone, country) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'asha',  'Asia/Kolkata',        'IN'),
  ('a0000000-0000-0000-0000-000000000002', 'leo',   'Europe/London',       'GB'),
  ('a0000000-0000-0000-0000-000000000003', 'sam',   'America/Los_Angeles', 'US'),
  ('a0000000-0000-0000-0000-000000000004', 'nova',  'Not/AZone',           'IN')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, timezone = EXCLUDED.timezone, country = EXCLUDED.country;

SELECT pg_temp.check(timezone = 'UTC', 'an invalid time zone falls back to UTC')
FROM profiles WHERE username = 'nova';

-- ── queue_notification ──────────────────────────────────────────────────────
-- 2026-11-10 06:00 UTC = 11:30 in Mumbai, 06:00 London (quiet), 22:00 LA (quiet).
SELECT pg_temp.check(queue_notification('a0000000-0000-0000-0000-000000000001', 'system', 't', 'b', '/', 'k1', false, '2026-11-10 06:00Z'),
                     'a nudge goes out at 11:30 local');
SELECT pg_temp.check(NOT queue_notification('a0000000-0000-0000-0000-000000000001', 'system', 't', 'b', '/', 'k1', false, '2026-11-10 06:30Z'),
                     'the same dedupe key never lands twice');
SELECT pg_temp.check(NOT queue_notification('a0000000-0000-0000-0000-000000000002', 'system', 't', 'b', '/', 'q1', false, '2026-11-10 06:00Z'),
                     'quiet hours: no nudge at 06:00 in London');
SELECT pg_temp.check(NOT queue_notification('a0000000-0000-0000-0000-000000000003', 'system', 't', 'b', '/', 'q2', false, '2026-11-10 06:00Z'),
                     'quiet hours: no nudge at 22:00 in Los Angeles');
SELECT pg_temp.check(queue_notification('a0000000-0000-0000-0000-000000000003', 'pace_cap', 't', 'b', '/', 'u1', true, '2026-11-10 06:00Z'),
                     'urgent alerts ignore quiet hours');
SELECT queue_notification('a0000000-0000-0000-0000-000000000001', 'system', 't', 'b', '/', 'k2', false, '2026-11-10 07:00Z');
SELECT queue_notification('a0000000-0000-0000-0000-000000000001', 'system', 't', 'b', '/', 'k3', false, '2026-11-10 08:00Z');
SELECT pg_temp.check(NOT queue_notification('a0000000-0000-0000-0000-000000000001', 'system', 't', 'b', '/', 'k4', false, '2026-11-10 09:00Z'),
                     'a fourth nudge in one local day is held back');
SELECT pg_temp.check(queue_notification('a0000000-0000-0000-0000-000000000001', 'system', 't', 'b', '/', 'k5', false, '2026-11-11 04:00Z'),
                     'the limit resets at local midnight (09:30 next day in Mumbai)');
DELETE FROM notifications;

-- ── zone_fading at 08:00 local ──────────────────────────────────────────────
-- Asha owns three zones. At 2026-11-12 02:30 UTC (08:00 Mumbai):
--   z1 defended 5.5 days ago → 45 now, 35 tomorrow → fading
--   z2 defended 1 day ago    → 90 → fine
--   z3 defended 7 days ago   → 30 → already stale, not "fading tomorrow"
INSERT INTO territory_polygons (owner_id, polygon_coords, area_m2, tier, freshness, last_defended_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', '[[0,0],[0.001,0],[0.001,0.001],[0,0]]', 5000, 'block', 100, '2026-11-12 02:30Z'::timestamptz - interval '5.5 days'),
  ('a0000000-0000-0000-0000-000000000001', '[[0,0],[0.001,0],[0.001,0.001],[0,0]]', 5000, 'block', 100, '2026-11-12 02:30Z'::timestamptz - interval '1 day'),
  ('a0000000-0000-0000-0000-000000000001', '[[0,0],[0.001,0],[0.001,0.001],[0,0]]', 5000, 'block', 100, '2026-11-12 02:30Z'::timestamptz - interval '7 days');
SELECT pg_temp.check(send_zone_fading('2026-11-12 01:30Z') = 0, 'zone_fading waits for 08:00 local');
SELECT pg_temp.check(send_zone_fading('2026-11-12 02:30Z') = 1, 'zone_fading sends at 08:00 local');
SELECT pg_temp.check(title = 'A zone fades tomorrow', 'only the zone crossing below 40 tomorrow is counted')
FROM notifications WHERE type = 'zone_fading';
SELECT pg_temp.check(send_zone_fading('2026-11-12 02:45Z') = 0, 'zone_fading sends once per local day');
UPDATE profiles SET territory_alerts_enabled = false WHERE username = 'asha';
DELETE FROM notifications;
SELECT pg_temp.check(send_zone_fading('2026-11-12 02:30Z') = 0, 'territory alerts toggle off: no fading alert');
UPDATE profiles SET territory_alerts_enabled = true WHERE username = 'asha';
DELETE FROM notifications;

-- ── streak_risk ─────────────────────────────────────────────────────────────
-- Leo: 6-day streak, last ran 2026-11-12 (UTC). On 2026-11-13 at 19:00 UTC
-- (19:00 London) he has 5 hours left.
UPDATE profiles SET streak_days = 6, last_run_date = '2026-11-12' WHERE username = 'leo';
UPDATE profiles SET streak_days = 2, last_run_date = '2026-11-12' WHERE username = 'sam';
SELECT pg_temp.check(send_streak_risk('2026-11-13 12:00Z') = 0, 'streak_risk waits for the evening window (17–21 UTC)');
SELECT pg_temp.check(send_streak_risk('2026-11-13 19:00Z') = 1, 'streak_risk warns a 6-day streak, not a 2-day one');
SELECT pg_temp.check(title = 'Your 6-day streak ends in 5 hours', 'streak_risk counts hours to 00:00 UTC')
FROM notifications WHERE type = 'streak_risk';
SELECT pg_temp.check(send_streak_risk('2026-11-13 20:00Z') = 0, 'streak_risk sends once per day');
UPDATE profiles SET last_run_date = '2026-11-13' WHERE username = 'leo';
DELETE FROM notifications;
SELECT pg_temp.check(send_streak_risk('2026-11-13 19:00Z') = 0, 'already ran today: no streak warning');
DELETE FROM notifications;

-- ── run reminders and weekly summary on local time ─────────────────────────
UPDATE profiles SET total_runs = 4, last_run_date = '2026-11-08' WHERE username = 'sam';
-- 2026-11-13 02:00 UTC = 18:00 in Los Angeles.
SELECT pg_temp.check(send_run_reminders_local('2026-11-13 02:00Z') = 1, 'run reminder at 18:00 local after 3+ quiet days');
SELECT pg_temp.check(send_run_reminders_local('2026-11-14 02:00Z') = 0, 'run reminders at most every 3 days');
DELETE FROM notifications;

SELECT set_config('test.role', 'service_role', false);
INSERT INTO runs (id, user_id, activity_type, distance_m, duration_sec, avg_pace, started_at, finished_at) VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', 'run', 5200, 1800, '5:46', '2026-11-10 07:00Z', '2026-11-10 07:30Z'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', 'run', 8100, 2700, '5:33', '2026-11-13 07:00Z', '2026-11-13 07:45Z');
-- Monday 2026-11-16 08:00 London = 08:00 UTC.
SELECT send_weekly_summaries_local('2026-11-16 08:00Z');
-- Shared databases have other runners: count this suite's own.
SELECT pg_temp.check((SELECT count(*) FROM notifications WHERE type = 'weekly_summary' AND user_id::text LIKE 'a0000000-%') = 1, 'weekly summary Monday 08:00 local');
SELECT pg_temp.check(body LIKE '13.3 km across 2 runs.%', 'weekly summary sums last PACE week: 13.3 km, 2 runs')
FROM notifications WHERE type = 'weekly_summary' AND user_id::text LIKE 'a0000000-%';
DELETE FROM notifications;

-- ── campaigns ───────────────────────────────────────────────────────────────
INSERT INTO notification_campaigns (name, title, body, send_at, local_hour, countries)
VALUES ('Diwali 2026', 'Diwali double-zone week', 'Every new zone pays double PACE till Sunday.',
        '2026-11-08 00:00Z', 10, '{IN}');
-- 2026-11-08 04:30 UTC = 10:00 Mumbai. Nova (IN) is on UTC, so it's 04:30 for her.
SELECT pg_temp.check(send_due_campaigns('2026-11-08 04:30Z') = 1, 'campaign goes to India at 10:00 local only');
SELECT pg_temp.check(send_due_campaigns('2026-11-08 10:00Z') = 1, 'Nova gets it at her own 10:00');
SELECT pg_temp.check(send_due_campaigns('2026-11-08 10:00Z') = 0, 'each runner gets a campaign once');
SELECT pg_temp.check(sent_count = 2, 'campaign counts what it sent') FROM notification_campaigns;
SELECT pg_temp.check((SELECT count(*) FROM notifications WHERE user_id IN
  ('a0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000003')) = 0,
  'campaign skips runners outside the audience');
SELECT send_due_campaigns('2026-11-10 00:00Z');
SELECT pg_temp.check(status = 'done', 'campaign closes after it expires') FROM notification_campaigns;
UPDATE profiles SET offers_enabled = false WHERE username = 'asha';
INSERT INTO notification_campaigns (name, title, body, send_at) VALUES ('All', 't', 'b', '2026-11-08 00:00Z');
DELETE FROM notifications;
SELECT send_due_campaigns('2026-11-08 06:00Z');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = 'a0000000-0000-0000-0000-000000000001'),
  'offers toggle off: no campaigns');
DELETE FROM notifications;

-- ── PACE alerts from credit_pace_capped ─────────────────────────────────────
-- The weekly cap and rank alerts use the real clock (they fire as PACE lands).
UPDATE profiles SET pace_weekly_earned = 0, pace_weekly_reset_at = now(), pace_total_earned = 190, runner_rank = 'pacer'
WHERE username = 'leo';
SELECT credit_pace_capped('a0000000-0000-0000-0000-000000000002', 79, 'run', 'n1');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM notifications WHERE type = 'pace_cap_near'), '79 of 100: no cap alert yet');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM notifications WHERE type = 'rank_up' AND title = 'You''re a Strider now'),
  'crossing 200 lifetime PACE sends a rank-up');
SELECT credit_pace_capped('a0000000-0000-0000-0000-000000000002', 5, 'run', 'n2');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM notifications WHERE type = 'pace_cap_near' AND title = '16 PACE left this week'),
  '84 of 100: "16 PACE left this week"');
SELECT credit_pace_capped('a0000000-0000-0000-0000-000000000002', 3, 'run', 'n3');
SELECT pg_temp.check((SELECT count(*) FROM notifications WHERE type = 'pace_cap_near') = 1, 'the near-cap alert lands once a week');
SELECT credit_pace_capped('a0000000-0000-0000-0000-000000000002', 50, 'run', 'n4');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM notifications WHERE type = 'pace_cap' AND body LIKE '%Runivo Plus runners earn up to 150%'),
  'cap reached: free runners hear about the Plus cap');
SELECT pg_temp.check((SELECT count(*) FROM notifications WHERE type = 'rank_up') = 1, 'rank-up sent once');

SELECT 'ALL NOTIFICATION CHECKS PASSED' AS result;
ROLLBACK;

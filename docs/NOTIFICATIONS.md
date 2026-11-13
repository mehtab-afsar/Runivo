# Notifications (v1)

Every system notification goes through `queue_notification()` in the database. Inserting into `notifications` fires the push (`trg_notify_push` → `send-push-notification`), which checks the runner's toggles.

## What sends, and when

| Alert | When (runner's local time) | Toggle | Opens |
|---|---|---|---|
| Zone attacked | Right after a rival's run takes ground | Territory alerts | Map, fading zones |
| A zone fades tomorrow | 08:00, if a zone drops below 40 freshness within 24 h | Territory alerts | Map, fading zones |
| Streak at risk | During the runner's day (09:00–21:59), in the last 3–7 hours before 00:00 UTC, streak ≥ 3, not yet run today | Run reminders | Run tab |
| Your streets miss you | 18:00, after 3+ days without a run, at most every 3 days | Run reminders | Run tab |
| Week in review | Monday 08:00 | Weekly summary | History |
| N PACE left this week | When a run takes weekly PACE past 80 % of the cap | Achievements and PACE | Store |
| Weekly PACE cap reached | When a run hits the cap (free runners hear about the 150 cap) | Achievements and PACE | Store |
| Rank up | When lifetime PACE crosses a rank | Achievements and PACE | Profile |
| Campaign | As scheduled (see below) | Offers and events | Whatever you set |

## Rules

- **Quiet hours:** no nudges between 22:00 and 07:00 local. Alerts the runner just caused (cap, rank, attack) are not nudges and always send.
- **Daily limit:** at most 3 nudges per runner per local day.
- **Once only:** every alert has a `dedupe_key`. The same fading-zone day, streak day, PACE week, rank or campaign never lands twice.
- **Local time:** the app sends `profiles.timezone` (e.g. `Asia/Kolkata`) on every sync. Unknown values fall back to UTC.
- The hourly job is `run_hourly_notifications()`, scheduled with pg_cron at minute 2 of every hour. It replaces the old fixed-UTC `send-run-reminders` and `send-weekly-summaries` jobs.

## Scheduling a festive campaign

Until the admin site has a form, run this in the Supabase SQL editor (it uses the service role):

```sql
INSERT INTO notification_campaigns
  (name, title, body, action_url, send_at, local_hour, countries, tiers, active_within_days)
VALUES
  ('Diwali 2026',                              -- internal name
   'Diwali double-zone week',                  -- push title
   'Every new zone pays double PACE till Sunday. Light up your streets.',
   '/run',                                     -- /run, /store, /territory-map, /events, /clubs
   '2026-11-08 00:00+05:30',                   -- not before this moment
   10,                                         -- each runner gets it at 10:00 their time (7–21), or NULL for "as soon as due"
   '{IN}',                                     -- NULL for everywhere
   NULL,                                       -- e.g. '{free}' to target free runners only
   30);                                        -- only runners active in the last 30 days, or NULL for everyone
```

A campaign closes 36 hours after `send_at` (set `expires_at` to change that). `sent_count` shows how many it reached. Set `status = 'cancelled'` to stop one.

## Tests

`supabase/tests/v1_notifications.test.sql`: 34 checks covering time zones, quiet hours, the daily limit, dedupe, each sender, campaigns and PACE alerts. See `supabase/tests/README.md`, and add `_stub_notifications.sql` and `20261106000002_v1_notifications.sql` after the first migration.

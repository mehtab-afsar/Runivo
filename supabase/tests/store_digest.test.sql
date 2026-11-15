-- Sponsored challenges, reward nudges, email digest (20261113000016).
\set ON_ERROR_STOP on
BEGIN;
-- These runs stand in for runs the server has scored: in production
-- process-run-territory writes verified_distance_m (20261115000021).
CREATE FUNCTION pg_temp.as_scored() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.verified_distance_m := COALESCE(NEW.verified_distance_m, NEW.distance_m); RETURN NEW; END $$;
CREATE TRIGGER runs_z_test_scored BEFORE INSERT ON public.runs FOR EACH ROW EXECUTE FUNCTION pg_temp.as_scored();

CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('test.uid', u::text, true), set_config('test.role', 'authenticated', true) $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES ('a9000000-0000-4000-8000-000000000001', 'sd-a@example.com') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username, pace_balance, timezone, last_run_date) VALUES
  ('a9000000-0000-4000-8000-000000000001', 'sda', 500, 'UTC', current_date)
ON CONFLICT (id) DO UPDATE SET pace_balance = 500, timezone = 'UTC', last_run_date = current_date;
INSERT INTO public.pace_store_rewards (id, brand, title, description, pace_cost, value_label, category, status, expires_at, code_mode)
VALUES ('a9100000-0000-4000-8000-0000000000f1', 'Acme', 'Free socks', 'Socks', 200, 'Free socks', 'gear', 'available', now() + interval '2 days', 'pool');
INSERT INTO public.reward_codes (reward_id, code) VALUES ('a9100000-0000-4000-8000-0000000000f1', 'SOCKS-1');
INSERT INTO public.sponsored_challenges (id, brand, title, metric, target, starts_at, ends_at, reward_id) VALUES
  ('a9200000-0000-4000-8000-0000000000c1', 'Acme', 'Run 5 km this week', 'distance_km', 5, now() - interval '1 day', now() + interval '6 days', 'a9100000-0000-4000-8000-0000000000f1');

SELECT pg_temp.as_user('a9000000-0000-4000-8000-000000000001');
SELECT join_sponsored_challenge('a9200000-0000-4000-8000-0000000000c1');
DO $$ BEGIN PERFORM claim_sponsored_reward('a9200000-0000-4000-8000-0000000000c1'); RAISE EXCEPTION 'no error'; EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'no error' THEN RAISE; END IF; END $$;
SELECT pg_temp.check(true, 'cannot claim before finishing');
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO public.runs (user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points) VALUES
  ('a9000000-0000-4000-8000-000000000001', 'run', now() + interval '1 minute', now() + interval '31 minutes', 5200, 1800, '5:46',
   (SELECT jsonb_agg(jsonb_build_object('lat', 12.9700 + i * 0.0012, 'lng', 77.6000, 'timestamp', (extract(epoch from now()) * 1000)::bigint + i * 15000) ORDER BY i) FROM generate_series(0, 40) i));
SELECT pg_temp.as_user('a9000000-0000-4000-8000-000000000001');
SELECT pg_temp.check((SELECT progress FROM list_sponsored_challenges()) >= 5, 'progress counts the run');
SELECT pg_temp.check(claim_sponsored_reward('a9200000-0000-4000-8000-0000000000c1') = 'SOCKS-1', 'finisher gets a code');
SELECT pg_temp.check(claim_sponsored_reward('a9200000-0000-4000-8000-0000000000c1') = 'SOCKS-1', 'claiming twice returns the same code');

-- S5 at 18:00 UTC
SET LOCAL runivo.trusted_writer = 'on';
SELECT set_config('test.role', 'service_role', true);
SELECT pg_temp.check(send_reward_nudges(date_trunc('day', now()) + interval '18 hours') >= 1, 'expiring affordable reward nudged');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM notifications WHERE user_id = 'a9000000-0000-4000-8000-000000000001' AND dedupe_key = 'reward_nudge:a9100000-0000-4000-8000-0000000000f1'), 'nudge queued once per reward');

-- N5
UPDATE profiles SET notifications_enabled = false WHERE id = 'a9000000-0000-4000-8000-000000000001';
SELECT pg_temp.check((SELECT km FROM weekly_digest_rows(now() + interval '1 hour') WHERE username = 'sda') >= 5, 'push-off runner gets a digest row');
UPDATE profiles SET email_digest_enabled = false WHERE id = 'a9000000-0000-4000-8000-000000000001';
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM weekly_digest_rows(now() + interval '1 hour') WHERE username = 'sda'), 'opting out removes them');
ROLLBACK;

-- Invites (20261117000003): one code per runner, new runners only, both paid 50 PACE once on the first 1 km+ run.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
SET LOCAL runivo.trusted_writer = 'on';

INSERT INTO auth.users (id, email, created_at) VALUES
  ('d1000000-0000-4000-8000-000000000001', 'inviter@example.com', now() - interval '90 days'),
  ('d1000000-0000-4000-8000-000000000002', 'newbie@example.com',  now() - interval '1 day'),
  ('d1000000-0000-4000-8000-000000000003', 'oldie@example.com',   now() - interval '60 days');
INSERT INTO public.profiles (id, username) VALUES
  ('d1000000-0000-4000-8000-000000000001', 'inviter'),
  ('d1000000-0000-4000-8000-000000000002', 'newbie'),
  ('d1000000-0000-4000-8000-000000000003', 'oldie')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;

SET LOCAL test.uid = 'd1000000-0000-4000-8000-000000000001';
CREATE TEMP TABLE c AS SELECT public.my_referral_code() AS code;
SELECT pg_temp.check((SELECT code ~ '^[A-HJKMNP-Z2-9]{8}$' FROM c), 'code is 8 characters, no look-alikes');
SELECT pg_temp.check((SELECT public.my_referral_code() = code FROM c), 'asking again gives the same code');
SELECT pg_temp.check((SELECT public.redeem_referral(code) FROM c) = 'own_code', 'cannot use your own code');

SET LOCAL test.uid = 'd1000000-0000-4000-8000-000000000003';
SELECT pg_temp.check((SELECT public.redeem_referral(code) FROM c) = 'too_late', 'accounts older than 14 days cannot use a code');

SET LOCAL test.uid = 'd1000000-0000-4000-8000-000000000002';
SELECT pg_temp.check(public.redeem_referral('NOPE1234') = 'invalid', 'unknown code');
SELECT pg_temp.check((SELECT public.redeem_referral(lower(code)) FROM c) = 'ok', 'new runner uses the code (any case)');
SELECT pg_temp.check((SELECT public.redeem_referral(code) FROM c) = 'already', 'only once');

CREATE TEMP TABLE b AS SELECT id, pace_balance FROM public.profiles WHERE id IN ('d1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002');

-- A short run pays nothing.
INSERT INTO public.runs (user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points)
VALUES ('d1000000-0000-4000-8000-000000000002', 'run', now() - interval '1 hour', now() - interval '55 minutes', 600, 300, '8:20', '[]');
SELECT pg_temp.check((SELECT rewarded_at IS NULL FROM public.referrals WHERE referred_id = 'd1000000-0000-4000-8000-000000000002'), 'under 1 km: not yet');

INSERT INTO public.runs (user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points)
VALUES ('d1000000-0000-4000-8000-000000000002', 'run', now() - interval '40 minutes', now() - interval '10 minutes', 5000, 1800, '6:00', '[]');
SELECT pg_temp.check((SELECT rewarded_at IS NULL FROM public.referrals WHERE referred_id = 'd1000000-0000-4000-8000-000000000002'), 'phone-claimed 5 km pays nothing before the server checks it');
-- process-run-territory writes the verified distance.
UPDATE public.runs SET verified_distance_m = 4900 WHERE user_id = 'd1000000-0000-4000-8000-000000000002' AND distance_m = 5000;
SELECT pg_temp.check((SELECT rewarded_at IS NOT NULL FROM public.referrals WHERE referred_id = 'd1000000-0000-4000-8000-000000000002'), 'first 1 km+ run: rewarded');
SELECT pg_temp.check((SELECT p.pace_balance - b.pace_balance FROM public.profiles p JOIN b USING (id) WHERE id = 'd1000000-0000-4000-8000-000000000002') >= 50, 'new runner got 50 PACE');
SELECT pg_temp.check((SELECT p.pace_balance - b.pace_balance FROM public.profiles p JOIN b USING (id) WHERE id = 'd1000000-0000-4000-8000-000000000001') = 50, 'inviter got 50 PACE');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.notifications WHERE user_id = 'd1000000-0000-4000-8000-000000000001' AND type = 'referral'), 'inviter is told');

INSERT INTO public.runs (user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points)
VALUES ('d1000000-0000-4000-8000-000000000002', 'run', now() - interval '9 minutes', now() - interval '1 minute', 2000, 480, '4:00', '[]');
UPDATE public.runs SET verified_distance_m = 2000 WHERE user_id = 'd1000000-0000-4000-8000-000000000002' AND distance_m = 2000;
SELECT pg_temp.check((SELECT p.pace_balance - b.pace_balance FROM public.profiles p JOIN b USING (id) WHERE id = 'd1000000-0000-4000-8000-000000000001') = 50, 'paid once only');

SELECT pg_temp.check(NOT has_table_privilege('authenticated', 'public.referrals', 'INSERT'), 'clients cannot write referrals');
SELECT pg_temp.check(NOT has_function_privilege('anon', 'public.redeem_referral(text)', 'EXECUTE'), 'signed-out cannot redeem');
ROLLBACK;

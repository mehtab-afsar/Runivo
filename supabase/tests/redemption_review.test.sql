-- Fraud review queue (20261113000009).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('test.uid', u::text, true), set_config('test.role', 'authenticated', true) $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('a9100000-0000-4000-8000-000000000001', 'rr-clean@example.com'), ('a9200000-0000-4000-8000-000000000002', 'rr-flagged@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES
  ('a9100000-0000-4000-8000-000000000001', 'rr_clean'), ('a9200000-0000-4000-8000-000000000002', 'rr_flagged')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;
UPDATE public.profiles SET pace_balance = 1000, created_at = now() - interval '60 days', total_runs = 10 WHERE id IN ('a9100000-0000-4000-8000-000000000001', 'a9200000-0000-4000-8000-000000000002');
INSERT INTO public.partners (id, name, status) VALUES ('a9900000-0000-4000-8000-000000000099', 'Shoe Co', 'active');
INSERT INTO public.pace_store_rewards (id, brand, title, description, pace_cost, value_label, partner_id, code_mode, stock) VALUES
  ('a9a00000-0000-4000-8000-0000000000a1', 'Shoe Co', '20% off', 'x', 300, '20%', 'a9900000-0000-4000-8000-000000000099', 'pool', 10);
INSERT INTO public.reward_codes (reward_id, code) VALUES
  ('a9a00000-0000-4000-8000-0000000000a1', 'CODE-1'), ('a9a00000-0000-4000-8000-0000000000a1', 'CODE-2');
-- The flagged runner has a teleport-flagged run this month.
INSERT INTO public.runs (user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace)
VALUES ('a9200000-0000-4000-8000-000000000002', 'run', now() - interval '2 days', now() - interval '2 days' + interval '30 minutes', 5000, 1800, '6:00');
SET LOCAL test.role = 'service_role';
UPDATE public.runs SET integrity_status = 'flagged', integrity_reason = 'teleport' WHERE user_id = 'a9200000-0000-4000-8000-000000000002';

-- Redeem as the service role (as the edge function does).
SELECT public.redeem_reward('a9100000-0000-4000-8000-000000000001', 'a9a00000-0000-4000-8000-0000000000a1');
CREATE TEMP TABLE f AS SELECT public.redeem_reward('a9200000-0000-4000-8000-000000000002', 'a9a00000-0000-4000-8000-0000000000a1') AS res;
SELECT pg_temp.check((SELECT review_status FROM public.pace_redemptions WHERE user_id = 'a9100000-0000-4000-8000-000000000001') = 'clear', 'a clean account redeems normally');
SELECT pg_temp.check((SELECT review_status || ':' || COALESCE(fulfillment_code, 'none') FROM public.pace_redemptions WHERE user_id = 'a9200000-0000-4000-8000-000000000002') = 'held:none',
  'a flagged account is held, with no code on the redemption');
SELECT pg_temp.check((SELECT count(*) FROM public.fraud_review_queue('a9900000-0000-4000-8000-000000000099')) = 1, 'it is in the partner''s queue');
SELECT pg_temp.check((SELECT review_reason FROM public.fraud_review_queue(NULL) WHERE username = 'rr_flagged') LIKE '1 GPS-flagged run%teleport%', 'with the reason');
SELECT pg_temp.check((SELECT billable || '/' || held FROM public.billable_redemptions('a9900000-0000-4000-8000-000000000099', now()::date)) = '1/1', 'held redemptions are not billed');

-- The runner can't see the code through reward_codes while held (RLS rule).
SELECT pg_temp.as_user('a9200000-0000-4000-8000-000000000002');
SELECT pg_temp.check((SELECT status FROM public.get_my_rewards()) = 'review', 'My rewards says under review');
SET LOCAL test.role = 'service_role';

-- Reject: PACE refunded, code back in the pool.
CREATE TEMP TABLE b AS SELECT pace_balance FROM public.profiles WHERE id = 'a9200000-0000-4000-8000-000000000002';
SELECT pg_temp.check(public.review_redemption((SELECT id FROM public.pace_redemptions WHERE user_id = 'a9200000-0000-4000-8000-000000000002'), false) = 'rejected', 'staff reject');
SELECT pg_temp.check((SELECT pace_balance FROM public.profiles WHERE id = 'a9200000-0000-4000-8000-000000000002') = (SELECT pace_balance FROM b) + 300, 'PACE refunded');
SELECT pg_temp.check((SELECT count(*) FROM public.reward_codes WHERE reward_id = 'a9a00000-0000-4000-8000-0000000000a1' AND assigned_to IS NULL) = 1, 'the code is back in the pool');
SELECT pg_temp.check(public.review_redemption((SELECT id FROM public.pace_redemptions WHERE user_id = 'a9200000-0000-4000-8000-000000000002'), true) = 'not_held', 'a decision can''t be made twice');

-- Approve path: flag the clean runner, redeem a second reward, approve.
INSERT INTO public.pace_store_rewards (id, brand, title, description, pace_cost, value_label, partner_id, code_mode, static_code) VALUES
  ('a9a00000-0000-4000-8000-0000000000a2', 'Shoe Co', 'Free socks', 'x', 100, 'Socks', 'a9900000-0000-4000-8000-000000000099', 'static', 'SOCKS');
INSERT INTO public.runs (user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace)
VALUES ('a9100000-0000-4000-8000-000000000001', 'walk', now() - interval '1 day', now() - interval '1 day' + interval '1 hour', 3000, 3600, '20:00');
UPDATE public.runs SET integrity_status = 'appealed', integrity_reason = 'vehicle' WHERE user_id = 'a9100000-0000-4000-8000-000000000001';
SELECT public.redeem_reward('a9100000-0000-4000-8000-000000000001', 'a9a00000-0000-4000-8000-0000000000a2');
SELECT pg_temp.check(public.review_redemption((SELECT id FROM public.pace_redemptions WHERE reward_id = 'a9a00000-0000-4000-8000-0000000000a2'), true) = 'approved', 'staff approve');
SELECT pg_temp.check((SELECT fulfillment_code FROM public.pace_redemptions WHERE reward_id = 'a9a00000-0000-4000-8000-0000000000a2') = 'SOCKS', 'the code is released');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.redemption_holds), 'no held codes left behind');
ROLLBACK;

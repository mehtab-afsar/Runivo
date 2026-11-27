-- Brand journey: a brand applies on /partners, staff approve it, a reward is
-- published for it, a runner sees and redeems it, and pausing the brand takes
-- its rewards out of the store.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('test.uid', u::text, true), set_config('test.role', 'authenticated', true) $$;
SET LOCAL runivo.trusted_writer = 'on';

INSERT INTO auth.users (id, email) VALUES ('b1100000-0000-4000-8000-000000000001', 'pj-runner@example.com') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES ('b1100000-0000-4000-8000-000000000001', 'pj_runner')
  ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;
UPDATE public.profiles SET pace_balance = 1000, created_at = now() - interval '60 days', total_runs = 10, country = 'IN'
 WHERE id = 'b1100000-0000-4000-8000-000000000001';

-- 1. Apply. Only the server (service role) may call it, never a signed-in user or anon.
SELECT pg_temp.as_user('b1100000-0000-4000-8000-000000000001');
DO $$ BEGIN
  PERFORM public.submit_partner_application('X', 'shoes', NULL, 'a@b.co', NULL, NULL, NULL, 'offer', NULL);
  RAISE EXCEPTION 'FAILED: a runner could submit an application directly';
EXCEPTION WHEN others THEN IF SQLERRM LIKE 'FAILED%' THEN RAISE; END IF; RAISE NOTICE 'ok  applications are server only'; END $$;

SET LOCAL test.role = 'service_role';
CREATE TEMP TABLE app AS SELECT public.submit_partner_application(
  'Stridewell', 'shoes', 'Asha', 'Partners@Stridewell.example', 'https://stridewell.example',
  ARRAY['IN'], NULL, '20% off any running shoe, single-use codes.', 200) AS id;
SELECT pg_temp.check((SELECT status || '|' || contact_email FROM public.partners WHERE id = (SELECT id FROM app))
  = 'applied|partners@stridewell.example', 'the application lands as applied, email lower-cased');

DO $$ BEGIN
  PERFORM public.submit_partner_application('X', 'crypto', NULL, 'a@b.co', NULL, NULL, NULL, 'offer', NULL);
  RAISE EXCEPTION 'FAILED: a bad category was accepted';
EXCEPTION WHEN others THEN IF SQLERRM LIKE 'FAILED%' THEN RAISE; END IF; RAISE NOTICE 'ok  bad input is refused'; END $$;

SELECT public.submit_partner_application('Spam ' || g, 'other', NULL, 'spam@x.example', NULL, NULL, NULL, 'offer', NULL) FROM generate_series(1, 3) g;
DO $$ BEGIN
  PERFORM public.submit_partner_application('Spam 4', 'other', NULL, 'spam@x.example', NULL, NULL, NULL, 'offer', NULL);
  RAISE EXCEPTION 'FAILED: a 4th application from one email was accepted';
EXCEPTION WHEN others THEN IF SQLERRM LIKE 'FAILED%' THEN RAISE; END IF; RAISE NOTICE 'ok  3 applications per email per day'; END $$;

-- 2. Nobody but the server can read applications (contact details are private).
SELECT pg_temp.as_user('b1100000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT set_config('test.seen', (SELECT count(*) FROM public.partners)::text, true);
SET LOCAL ROLE anon;
SELECT set_config('test.seen', current_setting('test.seen') || (SELECT count(*) FROM public.partners)::text, true);
RESET ROLE;
SELECT pg_temp.check(current_setting('test.seen') = '00', 'runners and anon cannot read the partners table');
SET LOCAL test.role = 'service_role';

-- 3. Approve (what the admin's Approve button sends).
UPDATE public.partners SET status = 'active', reviewed_at = now() WHERE id = (SELECT id FROM app);

-- 4. Publish a reward for the brand (admin Store section).
INSERT INTO public.pace_store_rewards (id, brand, title, description, pace_cost, value_label, partner_id, code_mode, static_code, countries, status)
VALUES ('b1a00000-0000-4000-8000-0000000000a1', 'Stridewell', '20% off running shoes', 'x', 200, '20% off',
        (SELECT id FROM app), 'static', 'STRIDE20', ARRAY['IN'], 'available');

-- 5. The runner sees it and can redeem it.
SELECT pg_temp.as_user('b1100000-0000-4000-8000-000000000001');
SELECT pg_temp.check((SELECT lock_reason IS NULL FROM public.store_catalog() WHERE id = 'b1a00000-0000-4000-8000-0000000000a1'),
  'an Indian runner sees the reward, unlocked');
SET LOCAL test.role = 'service_role';
SELECT public.redeem_reward('b1100000-0000-4000-8000-000000000001', 'b1a00000-0000-4000-8000-0000000000a1');
SELECT pg_temp.check((SELECT fulfillment_code FROM public.pace_redemptions WHERE reward_id = 'b1a00000-0000-4000-8000-0000000000a1') = 'STRIDE20',
  'redeeming gives the code');
SELECT pg_temp.check((SELECT (report->'partner'->>'name') FROM (SELECT public.partner_monthly_report((SELECT id FROM app), now()::date) AS report) x) = 'Stridewell',
  'the brand''s monthly report works');

-- 6. Pause the brand: its rewards leave the store and can't be redeemed.
INSERT INTO public.pace_store_rewards (id, brand, title, description, pace_cost, value_label, partner_id, code_mode, static_code, status)
VALUES ('b1a00000-0000-4000-8000-0000000000a2', 'Stridewell', 'Free socks', 'x', 50, 'Socks', (SELECT id FROM app), 'static', 'SOCKS', 'available');
UPDATE public.partners SET status = 'paused' WHERE id = (SELECT id FROM app);
SELECT pg_temp.as_user('b1100000-0000-4000-8000-000000000001');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.store_catalog() WHERE id = 'b1a00000-0000-4000-8000-0000000000a2'),
  'a paused brand''s rewards are not listed');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.store_catalog() WHERE id = 'b1a00000-0000-4000-8000-0000000000a1' AND redeemed),
  'a runner who already redeemed still sees their code');
SET LOCAL ROLE authenticated;
SELECT set_config('test.seen', (SELECT count(*) FROM public.pace_store_rewards WHERE id = 'b1a00000-0000-4000-8000-0000000000a2')::text, true);
RESET ROLE;
SELECT pg_temp.check(current_setting('test.seen') = '0', 'nor readable from the table directly');
SET LOCAL test.role = 'service_role';
SELECT pg_temp.check(public.reward_block_reason('b1a00000-0000-4000-8000-0000000000a2', 'b1100000-0000-4000-8000-000000000001') = 'not_available',
  'a paused brand''s reward cannot be redeemed');

-- 7. Rewards with no brand attached (Runivo's own) are unaffected.
INSERT INTO public.pace_store_rewards (id, brand, title, description, pace_cost, value_label, code_mode, static_code, status)
VALUES ('b1a00000-0000-4000-8000-0000000000a3', 'Runivo', 'Sticker pack', 'x', 10, 'Stickers', 'static', 'STICK', 'available');
SELECT pg_temp.as_user('b1100000-0000-4000-8000-000000000001');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.store_catalog() WHERE id = 'b1a00000-0000-4000-8000-0000000000a3'), 'Runivo''s own rewards still show');
ROLLBACK;

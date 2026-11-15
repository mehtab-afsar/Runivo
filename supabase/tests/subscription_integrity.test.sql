-- Lapsed Plus is expired after a 3-day grace; the event time is locked from the app (20261115000001).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
INSERT INTO auth.users (id, email) VALUES
  ('e1000000-0000-4000-8000-000000000001', 'si-lapsed@example.com'),
  ('e2000000-0000-4000-8000-000000000002', 'si-grace@example.com'),
  ('e3000000-0000-4000-8000-000000000003', 'si-lifetime@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES
  ('e1000000-0000-4000-8000-000000000001', 'si_lapsed'),
  ('e2000000-0000-4000-8000-000000000002', 'si_grace'),
  ('e3000000-0000-4000-8000-000000000003', 'si_lifetime')
ON CONFLICT (id) DO NOTHING;
CREATE TEMP TABLE t AS SELECT id FROM public.profiles WHERE id::text LIKE 'e_000000-0000-4000-8000-00000000000_' ORDER BY id;
SET LOCAL runivo.trusted_writer = 'on';
UPDATE public.profiles SET subscription_tier = 'premium', subscription_expires_at = now() - interval '5 days' WHERE id = (SELECT id FROM t ORDER BY id LIMIT 1);
UPDATE public.profiles SET subscription_tier = 'premium', subscription_expires_at = now() - interval '1 day'  WHERE id = (SELECT id FROM t ORDER BY id OFFSET 1 LIMIT 1);
UPDATE public.profiles SET subscription_tier = 'premium', subscription_expires_at = NULL                     WHERE id = (SELECT id FROM t ORDER BY id OFFSET 2 LIMIT 1);
SELECT public.expire_lapsed_subscriptions();
SELECT pg_temp.check((SELECT subscription_tier FROM public.profiles WHERE id = (SELECT id FROM t ORDER BY id LIMIT 1)) = 'free', 'Plus that ended 5 days ago goes back to Free');
SELECT pg_temp.check((SELECT subscription_tier FROM public.profiles WHERE id = (SELECT id FROM t ORDER BY id OFFSET 1 LIMIT 1)) = 'premium', 'Plus within the 3-day grace is kept');
SELECT pg_temp.check((SELECT subscription_tier FROM public.profiles WHERE id = (SELECT id FROM t ORDER BY id OFFSET 2 LIMIT 1)) = 'premium', 'Plus with no end date (lifetime) is kept');
SELECT pg_temp.check(NOT has_function_privilege('authenticated', 'public.expire_lapsed_subscriptions()', 'EXECUTE'), 'runners cannot call the expiry job');
SET LOCAL runivo.trusted_writer = 'off';
SET LOCAL test.role = 'authenticated';
UPDATE public.profiles SET subscription_event_at = now() + interval '1 year' WHERE id = (SELECT id FROM t ORDER BY id LIMIT 1);
SELECT pg_temp.check((SELECT subscription_event_at FROM public.profiles WHERE id = (SELECT id FROM t ORDER BY id LIMIT 1)) IS NULL, 'the app cannot set the last event time');
ROLLBACK;

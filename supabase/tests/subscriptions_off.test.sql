-- While subscriptions are off (20261114000003), everyone gets Plus.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
UPDATE public.app_settings SET value = 'false' WHERE key = 'subscriptions_enabled';
SELECT pg_temp.check(public.effective_tier('free') = 'premium' AND public.effective_tier(NULL) = 'premium', 'off: a free runner counts as Plus');
UPDATE public.app_settings SET value = 'true' WHERE key = 'subscriptions_enabled';
SELECT pg_temp.check(public.effective_tier('free') = 'free' AND public.effective_tier('premium') = 'premium', 'on: the stored tier applies again');
ROLLBACK;

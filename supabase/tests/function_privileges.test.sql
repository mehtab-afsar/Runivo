-- Server-only functions must not be executable by clients (migration
-- 20261115000010). Run after that migration, in the same database as the
-- other suites. Functions the target database doesn't have are skipped, so
-- this also works against the partial schemas the per-suite stubs build.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;

DO $$
DECLARE
  fn record;
  checked int := 0;
  server_only text[] := ARRAY[
    'apply_pace_adjustment','build_territory_geom','claim_unclaimed_area',
    'count_defendable_stale_zones','credit_pace_capped','defend_own_territories',
    'diagnose_pace_ledger','find_intersecting_territories','grant_award',
    'increment_run_stats','largest_polygon','onboarding_activation',
    'partner_monthly_report','redeem_reward','refresh_all_territory_scores',
    'reward_block_reason','run_hourly_notifications','steal_territory_portion',
    'sync_territory_score','sync_user_awards','territory_event_multiplier',
    'is_banned','contains_blocked_term','reject_if_banned','reject_blocked_text'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid, p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (server_only)
  LOOP
    checked := checked + 1;
    PERFORM pg_temp.check(NOT has_function_privilege('anon', fn.oid, 'EXECUTE'),
      format('anon cannot execute %s', fn.sig));
    PERFORM pg_temp.check(NOT has_function_privilege('authenticated', fn.oid, 'EXECUTE'),
      format('authenticated cannot execute %s', fn.sig));
  END LOOP;
  RAISE NOTICE 'checked % server-only function signatures', checked;
END $$;

-- Review aid (does not fail): every other SECURITY DEFINER function anon can
-- execute. Anonymous callers should rarely need any; each line is a prompt to
-- confirm it checks auth.uid() or only reads public data.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    RAISE NOTICE 'REVIEW: anon can execute SECURITY DEFINER %', fn.sig;
  END LOOP;
END $$;
ROLLBACK;

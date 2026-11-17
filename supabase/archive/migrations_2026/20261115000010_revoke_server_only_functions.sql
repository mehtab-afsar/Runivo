-- ============================================================
-- Security: server-only SECURITY DEFINER functions were callable by clients.
--
-- Background (see 20260809000003_award_grant_hardening.sql): this project's
-- `public` schema grants EXECUTE on every NEW function to anon, authenticated
-- and service_role at creation time. `GRANT ... TO service_role` alone never
-- removed that. 20260809000003 revoked the signatures that existed then, but
-- later migrations DROP + re-CREATE (new signature, or the same one) several of
-- these functions, which resets their privileges back to the permissive
-- default. Examples:
--   20261106000001  claim_unclaimed_area(text,uuid,uuid,boolean)   (new signature)
--   20261106000001  steal_territory_portion(uuid,text,uuid,uuid)   (dropped + recreated)
--   20261106000001  build_territory_geom(text,text,float8)         (new)
--   20260809000008  increment_run_stats(uuid,numeric)              (new)
--   20260701000073  diagnose_pace_ledger()                         (never revoked)
-- Each takes user ids / WKT as arguments and has no auth.uid() check, so any
-- client holding the anon key could steal zones, claim land, add kilometres to
-- another runner, or read the PACE ledger.
--
-- Fix: revoke EXECUTE from PUBLIC/anon/authenticated on EVERY overload of the
-- server-only functions, by name, so a future signature change can't silently
-- reopen it. Idempotent.
--
-- NOT done here, deliberately: changing the default so new functions start
-- closed. A schema-scoped `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE`
-- does not work: Postgres's built-in default grants EXECUTE to PUBLIC, a
-- schema-level entry can only add to it, and anon/authenticated inherit from
-- PUBLIC (tested: a function created afterwards stays executable). Removing it
-- needs a global `ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM
-- PUBLIC`, which would also strip extension functions created later (PostGIS)
-- and needs a decision. Until then, every migration that creates or re-creates
-- a privileged function MUST end with `REVOKE ALL ON FUNCTION ... FROM PUBLIC,
-- anon, authenticated`, and supabase/tests/function_privileges.test.sql guards
-- the list below. Add new server-only functions to BOTH.
--
-- Verified safe: no mobile/web client code calls any of these via .rpc()
-- (the only client-side caller, apps/web admin reports, uses a service-role
-- client). Edge functions run as service_role.
-- ============================================================

DO $$
DECLARE
  fn record;
  server_only text[] := ARRAY[
    'apply_pace_adjustment',
    'build_territory_geom',
    'claim_unclaimed_area',
    'count_defendable_stale_zones',
    'credit_pace_capped',
    'defend_own_territories',
    'diagnose_pace_ledger',
    'find_intersecting_territories',
    'grant_award',
    'increment_run_stats',
    'largest_polygon',
    'onboarding_activation',
    'partner_monthly_report',
    'redeem_reward',
    'refresh_all_territory_scores',
    'reward_block_reason',
    'run_hourly_notifications',
    'steal_territory_portion',
    'sync_territory_score',
    'sync_user_awards',
    'territory_event_multiplier'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (server_only)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
  END LOOP;
END $$;

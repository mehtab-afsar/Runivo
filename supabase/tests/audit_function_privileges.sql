-- Read-only. Paste into the Supabase SQL editor (or psql against the live DB)
-- to see which functions clients can call. Use it to verify finding C1 before
-- and after migration 20261115000010, and as the source for a strict allowlist.
--
-- Expected after the fix: none of the 21 server-only functions appear in
-- "client_can_execute"; every SECURITY DEFINER function that does appear
-- either checks auth.uid() or only reads data the caller may see.
SELECT
  p.oid::regprocedure                                   AS function,
  p.prosecdef                                           AS security_definer,
  has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
  (SELECT string_agg(c, ',') FROM unnest(p.proconfig) c
     WHERE c LIKE 'search_path=%')                      AS search_path_pinned
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND p.prorettype <> 'trigger'::regtype
  AND (has_function_privilege('anon', p.oid, 'EXECUTE')
    OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
ORDER BY p.prosecdef DESC, anon DESC, p.proname;

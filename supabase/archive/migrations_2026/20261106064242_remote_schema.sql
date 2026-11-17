-- Snapshot from `supabase db pull` on 2026-11-06: it records what the live
-- database already had, so it must never run. The original (which dropped
-- pg_net and the events policy) is kept in supabase/pull_snapshots/.
-- Mark it applied on the live project with:
--   supabase migration repair --status applied 20261106064242
select 1;

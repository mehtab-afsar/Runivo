-- ============================================================
-- Migration 046: Harden territories RLS
-- ============================================================
-- The original migration 003 left two dangerous policies:
--
--   "territories: claim as yourself"  (INSERT with check auth.uid() = owner_id)
--   "territories: anyone can update"  (UPDATE using true)
--
-- Problems:
--   1. The INSERT policy lets any authenticated client bypass
--      the claim_territory() RPC entirely — they can insert a row
--      with owner_id = their own UUID with no GPS proof.
--
--   2. The UPDATE policy lets any authenticated client rewrite any
--      territory row (change owner_id, defense, tier) without GPS
--      validation or energy cost.
--
-- Both claim_territory() and fortify_territory() are `SECURITY DEFINER`
-- functions that run as the DB owner, so they bypass RLS and are
-- unaffected by these changes.
--
-- Fix:
--   • Drop the permissive INSERT policy. Direct inserts are blocked;
--     only the security-definer RPC can write new rows.
--   • Replace the open UPDATE policy with one scoped to the current
--     owner (covers fortify — updating defense on your own zone).
--     Ownership transfers (claim) go through the RPC which bypasses RLS.
--   • Block DELETE entirely — territories are never deleted.
-- ============================================================

-- Drop the dangerous policies
drop policy if exists "territories: claim as yourself"   on public.territories;
drop policy if exists "territories: anyone can update"   on public.territories;

-- Owner-only update (fortify, rename, etc. on zones they own)
create policy "territories: owner can update own"
  on public.territories for update
  using (auth.uid() = owner_id);

-- No direct deletes — territories persist forever
-- (defense decay is handled by a scheduled function, not client deletes)
create policy "territories: no direct delete"
  on public.territories for delete
  using (false);

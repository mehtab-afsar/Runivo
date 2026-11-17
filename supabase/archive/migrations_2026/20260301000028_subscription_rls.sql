-- ============================================================
-- Migration 028: Subscription-gated RLS policies
-- ============================================================
-- 1. Restricts event creation to premium subscribers (tiers
--    consolidated to 'free' / 'premium' in migration 042).
-- 2. Replaces the overly-permissive territories UPDATE policy
--    so only the row owner (or service role for RPC use) can
--    update a territory.
-- ============================================================

-- ── Events: premium subscribers only ─────────────────────────
drop policy if exists "events: anyone can insert"    on public.events;
drop policy if exists "events: empire builder only"  on public.events;
drop policy if exists "events: premium only"         on public.events;

create policy "events: premium only"
  on public.events
  for insert
  with check (
    exists (
      select 1
      from   public.profiles
      where  id                = auth.uid()
        and  subscription_tier = 'premium'
        and  (
               subscription_expires_at is null
               or subscription_expires_at > now()
             )
    )
  );

-- ── Territories: owner-only or service_role UPDATE ────────────
drop policy if exists "territories: anyone can update" on public.territories;
drop policy if exists "territories: rpc only update"   on public.territories;

create policy "territories: owner or service_role update"
  on public.territories
  for update
  using (
    auth.uid() = owner_id
    or auth.role() = 'service_role'
  );

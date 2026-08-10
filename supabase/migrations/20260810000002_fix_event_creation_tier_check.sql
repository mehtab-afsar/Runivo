-- ============================================================
-- Fix event creation RLS: dead tier value blocked everyone
-- ============================================================
-- 20260301000007_clubs.sql's "events: empire builders can create" policy
-- checks subscription_tier = 'empire-builder' — a pre-migration-042 tier
-- value. subscription_tier has been 'free' | 'premium' | 'admin' since that
-- migration, so this check could never pass: event creation was RLS-blocked
-- for every user, including paying premium subscribers, with no error
-- surfaced beyond a generic insert failure. Same bug independently existed in
-- eventService.ts's client-side canCreate check (fixed alongside this).

drop policy if exists "events: empire builders can create" on public.events;

create policy "events: premium can create"
  on public.events for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and subscription_tier in ('premium', 'admin')
    )
  );

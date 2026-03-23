-- ============================================================
-- Migration 029: Web Push subscription storage
-- ============================================================
-- Stores Web Push endpoint + VAPID keys per device so the
-- send-push-notification Edge Function can fan out to all
-- of a user's devices.
-- ============================================================

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: owner all"
  on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.push_subscriptions is
  'Web Push endpoint and VAPID key material for each user device.
   Used by the send-push-notification Edge Function.';

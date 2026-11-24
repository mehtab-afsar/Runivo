-- ============================================================
-- Weight log history
-- ============================================================
-- nutrition_profiles.weight_kg is a single overwritten scalar — every
-- edit destroys the previous value, so there's no way to show a trend
-- or feed an adaptive-TDEE calculation later. This table keeps every
-- entry instead; nutrition_profiles.weight_kg remains the "current"
-- value used by target calculations.
-- ============================================================

create table if not exists public.weight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  weight_kg  numeric(6, 2) not null check (weight_kg > 0 and weight_kg < 500),
  logged_at  timestamptz not null default now()
);

create index if not exists weight_logs_user_logged_idx
  on public.weight_logs (user_id, logged_at desc);

alter table public.weight_logs enable row level security;

create policy "weight_logs: owner all"
  on public.weight_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.weight_logs is
  'Per-user weight history — one row per logged weigh-in, oldest to newest.';

-- ============================================================
-- Migration 025: Nutrition sync tables
-- ============================================================
-- Adds server-side storage for nutrition setup and food logs
-- so that a user's dietary data survives device changes and
-- is not lost when IndexedDB is cleared by the browser.
-- ============================================================

-- ── Nutrition profile (one row per user) ─────────────────────
create table if not exists public.nutrition_profiles (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  goal             text check (goal in ('lose', 'maintain', 'gain')),
  activity_level   text,
  diet             text,
  weight_kg        numeric(6, 2),
  height_cm        numeric(5, 2),
  age              int,
  sex              text check (sex in ('male', 'female')),
  daily_goal_kcal  numeric(7, 2),
  protein_goal_g   numeric(6, 2),
  carbs_goal_g     numeric(6, 2),
  fat_goal_g       numeric(6, 2),
  updated_at       timestamptz default now()
);

alter table public.nutrition_profiles enable row level security;

create policy "nutrition_profiles: owner all"
  on public.nutrition_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Nutrition log (one row per food item logged) ──────────────
create table if not exists public.nutrition_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  log_date     date not null,
  meal         text check (meal in ('breakfast', 'lunch', 'dinner', 'snacks')),
  name         text not null,
  kcal         numeric(7, 2) not null,
  protein_g    numeric(6, 2),
  carbs_g      numeric(6, 2),
  fat_g        numeric(6, 2),
  serving_size text,
  source       text check (source in ('search', 'run', 'manual')),
  logged_at    timestamptz default now(),
  xp_awarded   boolean default false
);

create index if not exists nutrition_logs_user_date_idx
  on public.nutrition_logs (user_id, log_date);

alter table public.nutrition_logs enable row level security;

create policy "nutrition_logs: owner all"
  on public.nutrition_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.nutrition_profiles is
  'Per-user nutrition setup: goal, biometrics, and daily macro targets.';

comment on table public.nutrition_logs is
  'Per-user food log entries synced from the client IndexedDB.';

-- ============================================================
-- Migration 001a: Profiles
-- ============================================================
-- One row per authenticated user. Auto-created on signup by the
-- handle_new_user() trigger. Stores game stats, preferences, and
-- social counters (follower/following kept in sync by 004_feed.sql).
--
-- Run order: this file runs before 001b_extensions (core < extensions
-- alphabetically), so it must NOT use PostGIS types.
-- ============================================================

-- Reusable updated_at trigger function (also used by territories)
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------
-- TABLE
-- ----------------------------------------------------------------
create table public.profiles (
  id                        uuid          primary key references auth.users(id) on delete cascade,
  username                  text          unique not null,
  avatar_url                text,

  -- Game stats
  level                     int           not null default 1,
  xp                        int           not null default 0,
  coins                     int           not null default 100,
  diamonds                  int           not null default 5,
  energy                    int           not null default 100,
  last_energy_regen         timestamptz   not null default now(),
  total_distance_km         numeric(10,3) not null default 0,
  total_runs                int           not null default 0,
  total_territories_claimed int           not null default 0,
  streak_days               int           not null default 0,
  last_run_date             date,

  -- Social counters (maintained by triggers in 004_feed.sql)
  follower_count            int           not null default 0,
  following_count           int           not null default 0,

  -- Onboarding preferences (nullable until onboarding completes)
  experience_level          text          check (experience_level in ('new', 'casual', 'regular', 'competitive')),
  weekly_frequency          int,
  primary_goal              text          check (primary_goal in ('get_fit', 'lose_weight', 'run_faster', 'explore', 'compete')),
  preferred_distance        text          check (preferred_distance in ('short', '5k', '10k', 'long')),
  playstyle                 text          check (playstyle in ('conqueror', 'defender', 'explorer', 'social')),
  distance_unit             text          not null default 'km' check (distance_unit in ('km', 'mi')),
  notifications_enabled     boolean       not null default true,
  weekly_goal_km            numeric(6,1)  not null default 20,
  mission_difficulty        text          not null default 'mixed' check (mission_difficulty in ('easy', 'mixed', 'hard')),
  onboarding_completed_at   timestamptz,

  -- Contact
  phone                     text,

  -- Subscription
  subscription_tier         text          not null default 'free' check (subscription_tier in ('free', 'runner-plus', 'territory-lord', 'empire-builder')),
  subscription_expires_at   timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Public player profile — one row per authenticated user.';

-- ----------------------------------------------------------------
-- TRIGGERS
-- ----------------------------------------------------------------
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Auto-create a profile row when a new user signs up.
-- Falls back to the part before '@' in the email if no username
-- is supplied in user metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------
-- RLS
-- Anyone can read profiles (leaderboard, feed, territory map).
-- Only the profile owner can write.
-- ----------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles: anyone can read"
  on public.profiles for select using (true);

create policy "profiles: owner can insert"
  on public.profiles for insert with check (auth.uid() = id);

create policy "profiles: owner can update"
  on public.profiles for update using (auth.uid() = id);

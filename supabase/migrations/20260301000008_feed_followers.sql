-- ============================================================
-- Migration 008: Missions + Leaderboard
-- ============================================================
-- Server-side mission progress mirrors the client missionStore.
-- Mission IDs match the client pattern: "daily-YYYY-M-D-{0,1,2}".
--
-- The leaderboard_weekly view aggregates weekly XP, km, and
-- territory captures. Uses cardinality() instead of array_length()
-- so empty arrays count as 0, not NULL.
--
-- Tables: mission_progress
-- Views:  leaderboard_weekly
-- ============================================================

-- ----------------------------------------------------------------
-- MISSION PROGRESS
-- ----------------------------------------------------------------
create table public.mission_progress (
  id              text          not null,   -- e.g. "daily-2026-3-1-0"
  user_id         uuid          not null references public.profiles(id) on delete cascade,
  mission_type    text          not null,
  current_value   numeric(10,3) not null default 0,
  completed       boolean       not null default false,
  claimed         boolean       not null default false,
  expires_at      timestamptz   not null,
  updated_at      timestamptz   not null default now(),
  primary key (id, user_id)
);

create index mission_progress_user_id_idx    on public.mission_progress(user_id);
create index mission_progress_expires_at_idx on public.mission_progress(expires_at);

comment on table public.mission_progress is 'Per-user daily mission progress — server-authoritative.';

-- ----------------------------------------------------------------
-- LEADERBOARD VIEW
-- Recalculated on every query — no materialized view needed at
-- current scale. cardinality() returns 0 for empty arrays;
-- array_length() returns NULL, which would break coalesce sums.
-- ----------------------------------------------------------------
create or replace view public.leaderboard_weekly as
select
  p.id,
  p.username,
  p.avatar_url,
  p.level,
  coalesce(sum(r.xp_earned), 0)::int                              as weekly_xp,
  coalesce(sum(r.distance_m) / 1000.0, 0)::numeric(10,3)         as weekly_km,
  coalesce(sum(cardinality(r.territories_claimed)), 0)::int       as weekly_territories,
  dense_rank() over (order by coalesce(sum(r.xp_earned), 0) desc)::int as rank
from public.profiles p
left join public.runs r
  on r.user_id = p.id
  and r.started_at >= date_trunc('week', now() at time zone 'utc')
group by p.id, p.username, p.avatar_url, p.level;

comment on view public.leaderboard_weekly is 'Weekly leaderboard — recalculated on every query.';

-- ----------------------------------------------------------------
-- RLS
-- Only the owner can see their own mission progress.
-- ----------------------------------------------------------------
alter table public.mission_progress enable row level security;

create policy "mission_progress: owner only read"
  on public.mission_progress for select using (auth.uid() = user_id);
create policy "mission_progress: owner can insert"
  on public.mission_progress for insert with check (auth.uid() = user_id);
create policy "mission_progress: owner can update"
  on public.mission_progress for update using (auth.uid() = user_id);

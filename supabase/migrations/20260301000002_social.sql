-- ============================================================
-- Migration 002: Runs
-- ============================================================
-- Full run history with GPS route stored as both JSONB (fast client
-- read) and a PostGIS LineString (geo queries + spatial index).
--
-- Two triggers fire on INSERT:
--   trg_derive_run_route       — builds the PostGIS geometry
--   trg_sync_profile_run_stats — increments profile totals
-- ============================================================

-- ----------------------------------------------------------------
-- TABLE
-- ----------------------------------------------------------------
create table public.runs (
  id                    uuid          primary key default gen_random_uuid(),
  user_id               uuid          not null references public.profiles(id) on delete cascade,

  activity_type         text          not null default 'run',
  started_at            timestamptz   not null,
  finished_at           timestamptz   not null,
  distance_m            numeric(10,2) not null,
  duration_sec          int           not null,
  avg_pace              text          not null,   -- formatted "mm:ss"

  -- GPS: raw simplified points + derived PostGIS geometry
  gps_points            jsonb         not null default '[]',   -- [{lat,lng,timestamp,speed,accuracy}]
  route                 geometry(LineString, 4326),             -- auto-filled by trg_derive_run_route

  -- Territory outcomes
  territories_claimed   text[]        not null default '{}',   -- H3 hex IDs
  territories_fortified text[]        not null default '{}',

  -- Rewards
  xp_earned             int           not null default 0,
  coins_earned          int           not null default 0,

  created_at  timestamptz not null default now()
);

create index runs_user_id_started_at_idx on public.runs(user_id, started_at desc);
create index runs_started_at_idx         on public.runs(started_at desc);
create index runs_route_gist_idx         on public.runs using gist(route);

comment on table public.runs is 'Completed run sessions with GPS tracks and territory outcomes.';

-- ----------------------------------------------------------------
-- TRIGGERS
-- ----------------------------------------------------------------

-- Build the PostGIS LineString from gps_points JSONB on every INSERT.
-- Points are ordered by timestamp so the line follows the actual path.
create or replace function public.derive_run_route()
returns trigger language plpgsql as $$
declare
  coords text;
begin
  if new.gps_points is null or jsonb_array_length(new.gps_points) < 2 then
    return new;
  end if;

  select string_agg(
    (p->>'lng') || ' ' || (p->>'lat'),
    ','
    order by (p->>'timestamp')::bigint
  )
  into coords
  from jsonb_array_elements(new.gps_points) as p;

  new.route := st_geomfromtext('LINESTRING(' || coords || ')', 4326);
  return new;
end;
$$;

create trigger trg_derive_run_route
  before insert on public.runs
  for each row execute function public.derive_run_route();

-- Increment profile lifetime stats after each run is saved.
create or replace function public.sync_profile_run_stats()
returns trigger language plpgsql security definer as $$
begin
  update public.profiles
  set
    total_runs        = total_runs + 1,
    total_distance_km = total_distance_km + (new.distance_m / 1000.0),
    last_run_date     = new.started_at::date
  where id = new.user_id;
  return new;
end;
$$;

create trigger trg_sync_profile_run_stats
  after insert on public.runs
  for each row execute function public.sync_profile_run_stats();

-- ----------------------------------------------------------------
-- RLS
-- All runs are publicly readable (needed by leaderboard and feed).
-- Only the owner can insert or delete their own runs.
-- ----------------------------------------------------------------
alter table public.runs enable row level security;

create policy "runs: anyone can read"
  on public.runs for select using (true);

create policy "runs: owner can insert"
  on public.runs for insert with check (auth.uid() = user_id);

create policy "runs: owner can delete"
  on public.runs for delete using (auth.uid() = user_id);

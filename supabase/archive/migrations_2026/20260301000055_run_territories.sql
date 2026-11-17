-- Migration 055: Polygon-based run territories
--
-- The original `territories` table stores H3 hex cells claimed by dwell time.
-- Run territories are corridors shaped exactly like the GPS path — if you run
-- a circle, you capture a circle. This table stores those polygon corridors.
-- ============================================================

create table public.run_territories (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid        not null references public.profiles(id) on delete cascade,
  owner_name     text,
  run_id         uuid        references public.runs(id) on delete cascade,
  polygon        jsonb       not null,   -- [[lng, lat], ...] closed GeoJSON ring
  area_m2        float8      not null default 0,
  defense        int         not null default 30,
  tier           text        not null default 'common',
  claimed_at     timestamptz          default now(),
  last_fortified_at timestamptz       default now()
);

alter table public.run_territories enable row level security;

create policy "run_territories: anyone can read"
  on public.run_territories for select using (true);

create policy "run_territories: owner can insert"
  on public.run_territories for insert with check (auth.uid() = owner_id);

create policy "run_territories: owner can update"
  on public.run_territories for update using (auth.uid() = owner_id);

create index run_territories_owner_id_idx on public.run_territories(owner_id);
create index run_territories_run_id_idx   on public.run_territories(run_id);

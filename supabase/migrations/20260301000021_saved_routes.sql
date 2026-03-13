-- ============================================================
-- Migration 021: Saved Routes
-- ============================================================
-- Users can save GPS trails as named routes, share them publicly,
-- and discover nearby routes from other runners.
-- ============================================================

create table public.saved_routes (
  id            uuid          primary key default gen_random_uuid(),
  user_id       uuid          not null references public.profiles(id) on delete cascade,
  name          text          not null,
  emoji         text          not null default '🏃',
  distance_m    numeric(10,2) not null,
  duration_sec  int,
  gps_points    jsonb         not null default '[]',
  route         geometry(LineString, 4326),
  is_public     boolean       not null default true,
  source_run_id uuid          references public.runs(id) on delete set null,
  created_at    timestamptz   not null default now()
);

create index saved_routes_user_id_idx    on public.saved_routes(user_id, created_at desc);
create index saved_routes_route_gist_idx on public.saved_routes using gist(route);

comment on table public.saved_routes is 'Named GPS routes saved by users for reuse and sharing.';

-- ----------------------------------------------------------------
-- TRIGGER: derive PostGIS geometry from gps_points JSONB
-- Same pattern as trg_derive_run_route on public.runs
-- ----------------------------------------------------------------
create or replace function public.derive_saved_route_geometry()
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
  )
  into coords
  from jsonb_array_elements(new.gps_points) as p;

  new.route := st_geomfromtext('LINESTRING(' || coords || ')', 4326);
  return new;
end;
$$;

create trigger trg_derive_saved_route_geometry
  before insert or update of gps_points on public.saved_routes
  for each row execute function public.derive_saved_route_geometry();

-- ----------------------------------------------------------------
-- RPC: find public routes near a given point
-- ----------------------------------------------------------------
create or replace function public.find_routes_nearby(
  p_lng float,
  p_lat float,
  p_radius_m float default 5000
)
returns table (
  id            uuid,
  user_id       uuid,
  name          text,
  emoji         text,
  distance_m    numeric,
  duration_sec  int,
  gps_points    jsonb,
  is_public     boolean,
  created_at    timestamptz,
  username      text,
  dist_m        float
)
language sql security definer stable as $$
  select
    sr.id, sr.user_id, sr.name, sr.emoji,
    sr.distance_m, sr.duration_sec, sr.gps_points,
    sr.is_public, sr.created_at,
    p.username,
    ST_Distance(
      sr.route::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) as dist_m
  from public.saved_routes sr
  join public.profiles p on p.id = sr.user_id
  where sr.is_public = true
    and sr.route is not null
    and ST_DWithin(
          sr.route::geography,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
          p_radius_m
        )
  order by dist_m
  limit 20;
$$;

-- ----------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------
alter table public.saved_routes enable row level security;

create policy "saved_routes: anyone can read public"
  on public.saved_routes for select
  using (is_public = true or auth.uid() = user_id);

create policy "saved_routes: owner can insert"
  on public.saved_routes for insert
  with check (auth.uid() = user_id);

create policy "saved_routes: owner can update"
  on public.saved_routes for update
  using (auth.uid() = user_id);

create policy "saved_routes: owner can delete"
  on public.saved_routes for delete
  using (auth.uid() = user_id);

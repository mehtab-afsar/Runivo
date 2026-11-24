-- ============================================================
-- Races: a catalogue runners search to build a plan to race day
-- ============================================================
-- PRD "Race-first training plans", Phase 1.
--
--   races           one race on one day (name, city, date, website).
--                   curated = listed by the team (mirrored from curated
--                   events, see sync below); runner = added by a runner.
--                   Runner races are 'pending': only their author sees
--                   them until an admin approves them into the catalogue.
--   race_distances  the distances a race offers (Half, 10K, …).
--   race_entries    "I'm running this", optionally tied to a plan.
--
-- Nobody writes these tables directly from the app: search_races,
-- add_runner_race, enter_race and leave_race are the only paths, and
-- other runners are only ever seen as a count (under 5 shows as "a few").

create table public.races (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 3 and 80),
  city        text check (city is null or char_length(city) <= 60),
  country     text not null default 'IN',
  lat         numeric(9, 6),
  lng         numeric(9, 6),
  starts_on   date not null,
  website_url text check (website_url is null or website_url ~ '^https://[^\s]+$'),
  source      text not null default 'runner' check (source in ('curated', 'runner')),
  status      text not null default 'pending' check (status in ('approved', 'pending', 'rejected', 'cancelled')),
  created_by  uuid references public.profiles(id) on delete set null,
  event_id    uuid unique references public.events(id) on delete cascade,
  checked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index races_starts_on_idx on public.races (starts_on) where status = 'approved';
create index races_created_by_idx on public.races (created_by);

create table public.race_distances (
  id          uuid primary key default gen_random_uuid(),
  race_id     uuid not null references public.races(id) on delete cascade,
  distance_m  integer not null check (distance_m between 1000 and 100000),
  label       text not null check (char_length(label) between 1 and 20),
  start_time  time,
  unique (race_id, distance_m)
);

create table public.race_entries (
  user_id           uuid not null references public.profiles(id) on delete cascade,
  race_distance_id  uuid not null references public.race_distances(id) on delete cascade,
  plan_id           uuid references public.training_plans(id) on delete set null,
  goal_sec          integer check (goal_sec is null or goal_sec between 600 and 36000),
  visibility        text not null default 'followers' check (visibility in ('everyone', 'followers', 'only_me')),
  created_at        timestamptz not null default now(),
  primary key (user_id, race_distance_id)
);
create index race_entries_distance_idx on public.race_entries (race_distance_id);

alter table public.races          enable row level security;
alter table public.race_distances enable row level security;
alter table public.race_entries   enable row level security;

create policy "races: approved or own" on public.races for select to authenticated
  using (status = 'approved' or created_by = auth.uid());
create policy "race_distances: of a visible race" on public.race_distances for select to authenticated
  using (exists (select 1 from public.races r where r.id = race_id and (r.status = 'approved' or r.created_by = auth.uid())));
create policy "race_entries: own" on public.race_entries for select to authenticated
  using (user_id = auth.uid());

-- Standard label for a distance.
create or replace function public.race_distance_label(p_m integer)
returns text language sql immutable as $$
  select case
    when abs(p_m - 42195) <= 300 then 'Marathon'
    when abs(p_m - 21097) <= 200 then 'Half'
    when p_m % 1000 = 0 then (p_m / 1000)::text || 'K'
    else round(p_m / 1000.0, 1)::text || ' km'
  end;
$$;

-- ── Curated events become catalogue races ─────────────────────
-- The admin panel already lists real races as curated events; each one with
-- a running distance is mirrored here so the plan flow can find it.
create or replace function public.sync_race_for_event(new public.events)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_m integer;
  v_race uuid;
begin
  v_m := coalesce(new.distance_m, case new.discipline
    when 'marathon' then 42195 when 'half_marathon' then 21097 when '10k' then 10000 when '5k' then 5000 end);
  if new.source <> 'curated' or v_m is null or new.discipline not in ('marathon', 'half_marathon', '10k', '5k', 'trail_run', 'community_run') then
    delete from public.races where event_id = new.id;
    return;
  end if;
  insert into public.races (name, city, lat, lng, starts_on, website_url, source, status, event_id, checked_at)
  values (new.title, new.location_name, new.lat, new.lng, (new.starts_at at time zone 'Asia/Kolkata')::date,
          case when new.registration_url ~ '^https://[^\s]+$' then new.registration_url end,
          'curated', case when new.is_active then 'approved' else 'cancelled' end, new.id, now())
  on conflict (event_id) do update set
    name = excluded.name, city = excluded.city, lat = excluded.lat, lng = excluded.lng,
    starts_on = excluded.starts_on, website_url = excluded.website_url, status = excluded.status, checked_at = now()
  returning id into v_race;
  delete from public.race_distances where race_id = v_race and distance_m <> v_m;
  insert into public.race_distances (race_id, distance_m, label, start_time)
  values (v_race, v_m, public.race_distance_label(v_m), (new.starts_at at time zone 'Asia/Kolkata')::time)
  on conflict (race_id, distance_m) do update set start_time = excluded.start_time;
end;
$$;

create or replace function public.sync_race_from_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_race_for_event(new);
  return new;
end;
$$;

create trigger trg_sync_race_from_event
  after insert or update on public.events
  for each row execute function public.sync_race_from_event();

-- Backfill the curated races already listed.
select public.sync_race_for_event(e) from public.events e
 where e.source = 'curated' and e.starts_at > now();

-- ── Search ────────────────────────────────────────────────────
-- Approved races plus the caller's own pending ones, from today on.
-- Near the caller first (within 150 km, when both sides have a location),
-- then by date. `entrants` is 0, -1 for "a few" (1–4) or the count.
create or replace function public.search_races(
  p_q text default null, p_from date default null, p_to date default null,
  p_distance_m integer default null, p_lat double precision default null, p_lng double precision default null,
  p_limit integer default 30
) returns table (
  race_id uuid, name text, city text, starts_on date, website_url text, source text, status text,
  distances jsonb, km_away integer, entrants integer, mine boolean
) language sql stable security definer set search_path = public as $$
  with base as (
    select r.*,
      case when p_lat is not null and p_lng is not null and r.lat is not null and r.lng is not null
        then round(st_distance(st_makepoint(r.lng, r.lat)::geography, st_makepoint(p_lng, p_lat)::geography) / 1000)::integer end as km
    from races r
    where (r.status = 'approved' or (r.status = 'pending' and r.created_by = auth.uid()))
      and r.starts_on >= greatest(current_date, coalesce(p_from, current_date))
      and (p_to is null or r.starts_on <= p_to)
      and (p_q is null or btrim(p_q) = '' or r.name ilike '%' || btrim(p_q) || '%' or r.city ilike '%' || btrim(p_q) || '%')
      and (p_distance_m is null or exists (select 1 from race_distances d where d.race_id = r.id and abs(d.distance_m - p_distance_m) <= greatest(200, p_distance_m * 0.03)))
  )
  select b.id, b.name, b.city, b.starts_on, b.website_url, b.source, b.status,
    coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'distance_m', d.distance_m, 'label', d.label, 'start_time', to_char(d.start_time, 'HH24:MI')) order by d.distance_m desc)
              from race_distances d where d.race_id = b.id), '[]'::jsonb),
    b.km,
    (select case when count(*) = 0 then 0 when count(*) < 5 then -1 else count(*)::integer end
       from race_entries e join race_distances d on d.id = e.race_distance_id where d.race_id = b.id),
    exists (select 1 from race_entries e join race_distances d on d.id = e.race_distance_id where d.race_id = b.id and e.user_id = auth.uid())
  from base b
  order by (b.km is not null and b.km <= 150) desc, b.starts_on, b.km nulls last, b.name
  limit least(greatest(coalesce(p_limit, 30), 1), 60);
$$;

-- ── A runner adds a race ──────────────────────────────────────
-- Saved as pending: usable for their own plan straight away, visible to
-- others only once approved. At most 5 a day.
create or replace function public.add_runner_race(
  p_name text, p_starts_on date, p_distance_m integer, p_city text default null, p_url text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_race uuid;
  v_dist uuid;
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if v_uid is null then return jsonb_build_object('error', 'not_signed_in'); end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 3 and 80 then return jsonb_build_object('error', 'bad_name'); end if;
  if p_starts_on is null or p_starts_on <= current_date or p_starts_on > current_date + 730 then return jsonb_build_object('error', 'bad_date'); end if;
  if p_distance_m is null or p_distance_m not between 1000 and 100000 then return jsonb_build_object('error', 'bad_distance'); end if;
  if v_url is not null and v_url !~ '^https://[^\s]+$' then return jsonb_build_object('error', 'bad_url'); end if;
  if (select count(*) from races where created_by = v_uid and created_at > now() - interval '1 day') >= 5 then
    return jsonb_build_object('error', 'too_many');
  end if;
  insert into races (name, city, starts_on, website_url, source, status, created_by)
  values (btrim(p_name), nullif(btrim(coalesce(p_city, '')), ''), p_starts_on, v_url, 'runner', 'pending', v_uid)
  returning id into v_race;
  insert into race_distances (race_id, distance_m, label) values (v_race, p_distance_m, race_distance_label(p_distance_m))
  returning id into v_dist;
  return jsonb_build_object('race_id', v_race, 'distance_id', v_dist);
end;
$$;

-- ── Entering ──────────────────────────────────────────────────
create or replace function public.enter_race(
  p_race_distance_id uuid, p_plan_id uuid default null, p_goal_sec integer default null, p_visibility text default 'followers'
) returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return 'not_signed_in'; end if;
  if not exists (
    select 1 from race_distances d join races r on r.id = d.race_id
     where d.id = p_race_distance_id and (r.status = 'approved' or (r.status = 'pending' and r.created_by = v_uid))
  ) then return 'not_found'; end if;
  if p_plan_id is not null and not exists (select 1 from training_plans where id = p_plan_id and user_id = v_uid) then
    return 'not_found';
  end if;
  insert into race_entries (user_id, race_distance_id, plan_id, goal_sec, visibility)
  values (v_uid, p_race_distance_id, p_plan_id, p_goal_sec,
          case when p_visibility in ('everyone', 'followers', 'only_me') then p_visibility else 'followers' end)
  on conflict (user_id, race_distance_id) do update
    set plan_id = coalesce(excluded.plan_id, race_entries.plan_id),
        goal_sec = coalesce(excluded.goal_sec, race_entries.goal_sec),
        visibility = excluded.visibility;
  return 'entered';
end;
$$;

create or replace function public.leave_race(p_race_distance_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from race_entries where user_id = auth.uid() and race_distance_id = p_race_distance_id;
$$;

-- ── Admin review of runner-added races ────────────────────────
create or replace function public.review_runner_race(p_race_id uuid, p_approve boolean)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and subscription_tier = 'admin') then return 'not_allowed'; end if;
  update races set status = case when p_approve then 'approved' else 'rejected' end, checked_at = now()
   where id = p_race_id and source = 'runner' and status = 'pending';
  return case when found then 'done' else 'not_found' end;
end;
$$;

revoke all on function public.search_races(text, date, date, integer, double precision, double precision, integer) from public, anon;
revoke all on function public.add_runner_race(text, date, integer, text, text) from public, anon;
revoke all on function public.enter_race(uuid, uuid, integer, text) from public, anon;
revoke all on function public.leave_race(uuid) from public, anon;
revoke all on function public.review_runner_race(uuid, boolean) from public, anon;
grant execute on function public.search_races(text, date, date, integer, double precision, double precision, integer) to authenticated;
grant execute on function public.add_runner_race(text, date, integer, text, text) to authenticated;
grant execute on function public.enter_race(uuid, uuid, integer, text) to authenticated;
grant execute on function public.leave_race(uuid) to authenticated;
grant execute on function public.review_runner_race(uuid, boolean) to authenticated;
revoke execute on function public.sync_race_from_event() from public, anon, authenticated;
revoke execute on function public.sync_race_for_event(public.events) from public, anon, authenticated;

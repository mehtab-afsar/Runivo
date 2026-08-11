-- ============================================================
-- Events: split into hosted (in-app RSVP) vs curated (outbound link)
-- ============================================================
-- Today's `events` table is a single flat model — one shape for a club/user
-- hosting their own run and a real-world marathon your team wants to list,
-- with no way to tell them apart. This adds the fields needed for both:
--
--   hosted  — created in-app (existing create-event flow, RLS-gated to
--             premium/admin per 20260810000004), joined via the existing
--             event_participants table. registration_url stays null.
--   curated — added by your team via the admin panel (admin tier), links
--             out to the real event's registration page. Never joined
--             in-app — registration_url is where users actually go.
--
-- Also finally wires up `location` (PostGIS point) — it's existed on this
-- table since the original migration but nothing has ever written to it, so
-- "events near me" has never been possible. Admin enters lat/lng directly
-- (no geocoding dependency); a trigger derives the point, mirroring
-- derive_run_route()'s pattern in 20260301000002_social.sql.
--
-- `discipline` is a separate, real-world sport taxonomy (marathon, 10K,
-- cyclothon, ...) deliberately kept apart from the existing `event_type`
-- column, which mixes real categories with in-app gamified modes
-- (king-of-hill, survival, territory-war) that belong to a different part
-- of the product and aren't reachable from any real creation path today —
-- left untouched here rather than risk breaking something outside this
-- migration's scope.

alter table public.events
  add column source           text not null default 'hosted' check (source in ('hosted', 'curated')),
  add column registration_url text,
  add column source_name      text,
  add column club_id          uuid references public.clubs(id) on delete set null,
  add column discipline       text check (discipline in (
                                 'marathon', 'half_marathon', '10k', '5k',
                                 'cyclothon', 'triathlon', 'trail_run', 'community_run', 'other'
                               )),
  add column lat               numeric(9, 6),
  add column lng               numeric(9, 6);

alter table public.events
  add constraint events_curated_requires_registration_url
    check (source <> 'curated' or registration_url is not null);

comment on column public.events.source           is 'hosted = in-app RSVP via event_participants; curated = outbound registration_url, admin-added listing.';
comment on column public.events.registration_url is 'External signup link. Required when source = curated; null for hosted events (RSVP happens in-app).';
comment on column public.events.source_name      is 'Attribution shown on curated cards, e.g. "via World Marathon Majors" — distinct from the human-readable `organizer` field.';

create index events_club_id_idx on public.events(club_id) where club_id is not null;
create index events_source_idx  on public.events(source);

-- Derive the PostGIS point from lat/lng on every insert/update so
-- "nearby" queries (ST_DWithin against this column) actually have data to
-- query — see migration header.
create or replace function public.derive_event_location()
returns trigger language plpgsql as $$
begin
  if new.lat is not null and new.lng is not null then
    new.location := st_setsrid(st_makepoint(new.lng, new.lat), 4326);
  end if;
  return new;
end;
$$;

create trigger trg_derive_event_location
  before insert or update of lat, lng on public.events
  for each row execute function public.derive_event_location();

-- Curated listings are admin-only — the existing "premium can create" policy
-- (20260810000004) already covers hosted events from premium users; this
-- adds the missing case of an admin-tier user inserting a curated row (the
-- admin panel authenticates as a real admin-tier user, not service-role).
-- Redundant for admins under the existing policy (admin already passes it),
-- so this only tightens the curated path: non-admins can't set source =
-- 'curated' even though they can create hosted events.
drop policy if exists "events: premium can create" on public.events;

create policy "events: premium can create"
  on public.events for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and subscription_tier in ('premium', 'admin')
    )
    and (
      source = 'hosted'
      or exists (
        select 1 from public.profiles
        where id = auth.uid() and subscription_tier = 'admin'
      )
    )
  );

-- Nearby search: events within a radius of a point, optionally filtered by
-- discipline. SECURITY INVOKER is fine here — events are already readable
-- by anyone (20260301000007's "events: anyone can read").
create or replace function public.nearby_events(
  p_lat        numeric,
  p_lng        numeric,
  p_radius_km  numeric default 50,
  p_discipline text default null
)
returns setof public.events
language sql
stable
as $$
  select *
  from public.events
  where is_active = true
    and location is not null
    and (p_discipline is null or discipline = p_discipline)
    and st_dwithin(
      location::geography,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      p_radius_km * 1000
    )
  order by starts_at asc;
$$;

grant execute on function public.nearby_events(numeric, numeric, numeric, text) to authenticated, anon;

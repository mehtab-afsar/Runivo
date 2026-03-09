-- ============================================================
-- Migration 007: Events
-- ============================================================
-- Community and competitive scheduled events: territory wars,
-- king-of-the-hill, survival runs, brand challenges, etc.
--
-- Tables:  events, event_participants
-- ============================================================

-- ----------------------------------------------------------------
-- EVENTS
-- ----------------------------------------------------------------
create table public.events (
  id                uuid          primary key default gen_random_uuid(),
  title             text          not null,
  description       text,
  event_type        text          not null check (event_type in (
                      'territory-war', 'king-of-hill', 'survival',
                      'brand-challenge', 'community', 'race', 'community-run', 'challenge'
                    )),
  starts_at         timestamptz   not null,
  ends_at           timestamptz   not null,
  location          geometry(Point, 4326),
  location_name     text,
  distance_m        int,
  participant_count int           not null default 0,
  xp_multiplier     numeric(3,1)  not null default 1.0,
  is_active         boolean       not null default true,
  created_at        timestamptz   not null default now()
);

create index events_starts_at_idx on public.events(starts_at);
create index events_is_active_idx on public.events(is_active) where is_active = true;
create index events_location_idx  on public.events using gist(location);

comment on table public.events is 'Community and competitive running events.';

-- ----------------------------------------------------------------
-- EVENT PARTICIPANTS
-- ----------------------------------------------------------------
create table public.event_participants (
  event_id    uuid        not null references public.events(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (event_id, user_id)
);

comment on table public.event_participants is 'RSVP / join records for events.';

-- ----------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------
alter table public.events             enable row level security;
alter table public.event_participants enable row level security;

create policy "events: anyone can read"
  on public.events for select using (true);

create policy "events: empire builders can create"
  on public.events for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and subscription_tier = 'empire-builder'
    )
  );

create policy "event_participants: anyone can read"
  on public.event_participants for select using (true);
create policy "event_participants: self can join"
  on public.event_participants for insert with check (auth.uid() = user_id);
create policy "event_participants: self can leave"
  on public.event_participants for delete using (auth.uid() = user_id);

-- ============================================================
-- Migration 006: Lobbies
-- ============================================================
-- Pre-run lobbies for coordinating group runs. Each lobby has
-- a realtime chat thread so members can organize before they start.
--
-- Tables:  lobbies, lobby_messages
-- ============================================================

-- ----------------------------------------------------------------
-- LOBBIES
-- ----------------------------------------------------------------
create table public.lobbies (
  id          uuid        primary key default gen_random_uuid(),
  club_id     uuid        references public.clubs(id) on delete set null,
  name        text        not null,
  status      text        not null default 'open' check (status in ('open', 'active', 'closed')),
  created_by  uuid        not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index lobbies_club_id_idx on public.lobbies(club_id);
create index lobbies_status_idx  on public.lobbies(status) where status = 'open';

comment on table public.lobbies is 'Pre-run lobbies for coordinating group runs.';

-- ----------------------------------------------------------------
-- LOBBY MESSAGES
-- ----------------------------------------------------------------
create table public.lobby_messages (
  id          uuid        primary key default gen_random_uuid(),
  lobby_id    uuid        not null references public.lobbies(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  content     text        not null,
  created_at  timestamptz not null default now()
);

create index lobby_messages_lobby_created_idx on public.lobby_messages(lobby_id, created_at desc);

comment on table public.lobby_messages is 'Realtime lobby chat messages.';

-- ----------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------
alter table public.lobbies        enable row level security;
alter table public.lobby_messages enable row level security;

create policy "lobbies: anyone can read"
  on public.lobbies for select using (true);
create policy "lobbies: authenticated can create"
  on public.lobbies for insert with check (auth.uid() = created_by);

create policy "lobby_messages: anyone can read"
  on public.lobby_messages for select using (true);
create policy "lobby_messages: authenticated can send"
  on public.lobby_messages for insert with check (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------------
alter publication supabase_realtime add table public.lobbies;
alter publication supabase_realtime add table public.lobby_messages;

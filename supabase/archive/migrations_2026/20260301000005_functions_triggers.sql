-- ============================================================
-- Migration 005: Clubs
-- ============================================================
-- Running clubs with open and invite-only join policies.
-- For invite-only clubs, players submit a join request which
-- an owner/admin accepts via accept_club_join_request().
--
-- Tables:  clubs, club_members, club_join_requests
-- RPCs:    accept_club_join_request()
-- ============================================================

-- ----------------------------------------------------------------
-- CLUBS
-- ----------------------------------------------------------------
create table public.clubs (
  id           uuid          primary key default gen_random_uuid(),
  name         text          unique not null,
  description  text,
  badge_emoji  text          not null default '🏃',
  owner_id     uuid          not null references public.profiles(id) on delete cascade,
  join_policy  text          not null default 'open' check (join_policy in ('open', 'invite_only')),
  member_count int           not null default 1,
  total_km     numeric(12,3) not null default 0,
  created_at   timestamptz   not null default now()
);

create index clubs_owner_id_idx on public.clubs(owner_id);

comment on table public.clubs is 'Running clubs — groups of players competing together.';

-- ----------------------------------------------------------------
-- CLUB MEMBERS
-- ----------------------------------------------------------------
create table public.club_members (
  club_id     uuid        not null references public.clubs(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  role        text        not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at   timestamptz not null default now(),
  primary key (club_id, user_id)
);

create index club_members_user_id_idx on public.club_members(user_id);

comment on table public.club_members is 'Club membership with role.';

-- ----------------------------------------------------------------
-- CLUB JOIN REQUESTS (for invite-only clubs)
-- ----------------------------------------------------------------
create table public.club_join_requests (
  id          uuid        primary key default gen_random_uuid(),
  club_id     uuid        not null references public.clubs(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  status      text        not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at  timestamptz not null default now(),
  unique (club_id, user_id)
);

create index club_join_requests_club_id_idx on public.club_join_requests(club_id, status);
create index club_join_requests_user_id_idx on public.club_join_requests(user_id);

comment on table public.club_join_requests is 'Pending/accepted/rejected requests to join an invite-only club.';

-- ----------------------------------------------------------------
-- RPC: accept a join request and add member atomically
-- ----------------------------------------------------------------
create or replace function public.accept_club_join_request(request_id uuid)
returns void language plpgsql security definer as $$
declare
  v_club_id uuid;
  v_user_id uuid;
begin
  select club_id, user_id into v_club_id, v_user_id
  from public.club_join_requests
  where id = request_id and status = 'pending';

  if not found then
    raise exception 'Request not found or already processed';
  end if;

  if not exists (
    select 1 from public.club_members
    where club_id = v_club_id and user_id = auth.uid() and role in ('owner', 'admin')
  ) then
    raise exception 'Not authorized';
  end if;

  update public.club_join_requests set status = 'accepted' where id = request_id;

  insert into public.club_members (club_id, user_id, role)
    values (v_club_id, v_user_id, 'member')
    on conflict do nothing;

  update public.clubs set member_count = member_count + 1 where id = v_club_id;
end;
$$;

-- ----------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------
alter table public.clubs              enable row level security;
alter table public.club_members       enable row level security;
alter table public.club_join_requests enable row level security;

create policy "clubs: anyone can read"
  on public.clubs for select using (true);
create policy "clubs: owner can insert"
  on public.clubs for insert with check (auth.uid() = owner_id);
create policy "clubs: owner can update"
  on public.clubs for update using (auth.uid() = owner_id);
create policy "clubs: owner can delete"
  on public.clubs for delete using (auth.uid() = owner_id);

create policy "club_members: anyone can read"
  on public.club_members for select using (true);
create policy "club_members: self can join"
  on public.club_members for insert with check (auth.uid() = user_id);
create policy "club_members: self can leave"
  on public.club_members for delete using (auth.uid() = user_id);

create policy "club_join_requests: anyone can read"
  on public.club_join_requests for select using (true);
create policy "club_join_requests: self can request"
  on public.club_join_requests for insert with check (auth.uid() = user_id);
create policy "club_join_requests: self can retract"
  on public.club_join_requests for delete using (auth.uid() = user_id);
create policy "club_join_requests: club owner can update"
  on public.club_join_requests for update
  using (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = club_join_requests.club_id
        and cm.user_id = auth.uid()
        and cm.role in ('owner', 'admin')
    )
  );

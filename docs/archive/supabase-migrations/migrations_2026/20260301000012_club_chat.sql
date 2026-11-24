-- ----------------------------------------------------------------
-- Club real-time chat messages
-- ----------------------------------------------------------------

create table public.club_messages (
  id         uuid        primary key default gen_random_uuid(),
  club_id    uuid        not null references public.clubs(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  content    text        not null,
  created_at timestamptz not null default now()
);

create index club_messages_club_created_idx
  on public.club_messages (club_id, created_at desc);

-- Row Level Security — only club members can read or send messages
alter table public.club_messages enable row level security;

create policy "club members can read messages"
  on public.club_messages for select using (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = club_messages.club_id
        and cm.user_id = auth.uid()
    )
  );

create policy "club members can send messages"
  on public.club_messages for insert with check (
    auth.uid() = user_id and
    exists (
      select 1 from public.club_members cm
      where cm.club_id = club_messages.club_id
        and cm.user_id = auth.uid()
    )
  );

-- Enable Supabase Realtime for live chat updates
alter publication supabase_realtime add table public.club_messages;

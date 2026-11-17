-- ============================================================
-- Migration 025: Coach Messages
-- ============================================================
-- Stores the full conversation history between a user and
-- the Runivo AI Coach. Each row is one turn (user or assistant).
-- The edge function reads the last 20 rows as context when
-- generating the next assistant reply.
-- ============================================================

create table public.coach_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

alter table public.coach_messages enable row level security;

create policy "Users own coach_messages"
  on public.coach_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fast lookup for conversation thread (most-recent first)
create index coach_messages_user_created
  on public.coach_messages(user_id, created_at desc);

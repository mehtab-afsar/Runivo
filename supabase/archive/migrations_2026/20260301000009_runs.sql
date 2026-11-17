-- ============================================================
-- Migration 009: Notifications
-- ============================================================
-- In-app notification inbox. Rows are inserted by DB triggers
-- (e.g. trg_notify_kudos in 010_run_media.sql) or by Edge Functions.
-- Realtime-enabled so the bell counter updates live without polling.
--
-- RPCs: mark_notifications_read(), unread_notification_count()
-- ============================================================

-- ----------------------------------------------------------------
-- TABLE
-- ----------------------------------------------------------------
create table public.notifications (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  type        text        not null check (type in (
                'kudos', 'comment', 'territory_claimed', 'territory_lost',
                'event_reminder', 'club_join', 'club_invite', 'streak', 'system'
              )),
  title       text        not null,
  body        text        not null,
  read        boolean     not null default false,
  action_url  text,
  created_at  timestamptz not null default now()
);

-- Composite index optimized for the most common query:
-- "all unread notifications for this user, newest first"
create index notifications_user_unread_idx
  on public.notifications(user_id, read, created_at desc);

comment on table public.notifications is 'In-app notification inbox — one row per event per recipient.';

-- ----------------------------------------------------------------
-- RPCs
-- ----------------------------------------------------------------

-- Mark all unread notifications as read for the calling user.
-- Called when the user opens the bell dropdown or the full-page inbox.
create or replace function public.mark_notifications_read()
returns void language plpgsql security definer as $$
begin
  update public.notifications
  set read = true
  where user_id = auth.uid() and read = false;
end;
$$;

-- Return the unread count for the calling user.
-- Used to populate the bell badge without fetching full rows.
create or replace function public.unread_notification_count()
returns int language sql security definer stable as $$
  select count(*)::int
  from public.notifications
  where user_id = auth.uid() and read = false;
$$;

-- ----------------------------------------------------------------
-- RLS
-- Only the recipient can read/update their own notifications.
-- INSERT is open so DB triggers and Edge Functions can create rows.
-- ----------------------------------------------------------------
alter table public.notifications enable row level security;

create policy "notifications: owner can read"
  on public.notifications for select using (auth.uid() = user_id);

create policy "notifications: owner can update"
  on public.notifications for update using (auth.uid() = user_id);

create policy "notifications: service role can insert"
  on public.notifications for insert with check (true);

-- ----------------------------------------------------------------
-- Realtime — bell counter updates without polling
-- ----------------------------------------------------------------
alter publication supabase_realtime add table public.notifications;

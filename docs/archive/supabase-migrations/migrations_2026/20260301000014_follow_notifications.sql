-- ============================================================
-- Migration 014: Follow Notifications
-- ============================================================
-- Adds 'follow' to the notifications type CHECK constraint and
-- creates a trigger that fires a notification whenever someone
-- follows another user.
-- ============================================================

-- ----------------------------------------------------------------
-- Extend the notifications type CHECK constraint
-- PostgreSQL doesn't support ALTER CHECK directly — we must drop
-- and recreate the constraint with the new value list.
-- ----------------------------------------------------------------
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'kudos', 'comment', 'territory_claimed', 'territory_lost',
    'event_reminder', 'club_join', 'club_invite', 'streak', 'system',
    'follow'
  ));

-- ----------------------------------------------------------------
-- Trigger function: insert a notification when a follow is created
-- ----------------------------------------------------------------
create or replace function public.notify_follow()
returns trigger language plpgsql security definer as $$
declare
  follower_name text;
begin
  -- Resolve the follower's display name
  select username into follower_name
  from public.profiles
  where id = new.follower_id;

  insert into public.notifications (user_id, type, title, body, action_url)
  values (
    new.following_id,
    'follow',
    follower_name || ' started following you',
    'Check out their profile and follow back!',
    '/profile/' || new.follower_id::text
  );

  return new;
end;
$$;

-- ----------------------------------------------------------------
-- Trigger: fires after every new follow row
-- ----------------------------------------------------------------
create trigger trg_notify_follow
  after insert on public.followers
  for each row execute function public.notify_follow();

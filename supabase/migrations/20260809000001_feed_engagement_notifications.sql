-- ============================================================
-- Feed engagement notifications
-- ============================================================
-- notifications.type has allowed 'kudos' and 'comment' since
-- 20260301000014_follow_notifications.sql, but nothing has ever inserted
-- either — only follows notify (notify_follow, same migration). A like or a
-- comment on someone's run currently produces zero signal to the person it
-- happened to; they'd only find out by reopening that exact post. This is
-- the feedback loop that makes a feed worth returning to, so it's wired up
-- the same way notify_follow already is: a SECURITY DEFINER trigger on the
-- write, not client-driven (a client-side notify call would be missed by
-- the two follow-write call sites already known to bypass shared logic, and
-- silently skippable by anyone who calls the like/comment RPC directly).
-- ============================================================

create or replace function public.notify_kudos()
returns trigger language plpgsql security definer as $$
declare
  post_owner  uuid;
  liker_name  text;
begin
  select user_id into post_owner from public.feed_posts where id = new.post_id;

  -- Don't notify someone liking their own post.
  if post_owner is null or post_owner = new.user_id then
    return new;
  end if;

  select username into liker_name from public.profiles where id = new.user_id;

  insert into public.notifications (user_id, type, title, body, action_url)
  values (
    post_owner,
    'kudos',
    coalesce(liker_name, 'A runner') || ' liked your run',
    'Tap to see the post.',
    '/feed?post=' || new.post_id::text
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_kudos on public.feed_post_likes;
create trigger trg_notify_kudos
  after insert on public.feed_post_likes
  for each row execute function public.notify_kudos();

create or replace function public.notify_comment()
returns trigger language plpgsql security definer as $$
declare
  post_owner     uuid;
  commenter_name text;
begin
  select user_id into post_owner from public.feed_posts where id = new.post_id;

  if post_owner is null or post_owner = new.user_id then
    return new;
  end if;

  select username into commenter_name from public.profiles where id = new.user_id;

  insert into public.notifications (user_id, type, title, body, action_url)
  values (
    post_owner,
    'comment',
    coalesce(commenter_name, 'A runner') || ' commented on your run',
    left(new.content, 140),
    '/feed?post=' || new.post_id::text
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_comment on public.feed_post_comments;
create trigger trg_notify_comment
  after insert on public.feed_post_comments
  for each row execute function public.notify_comment();

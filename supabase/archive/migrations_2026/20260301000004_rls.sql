-- ============================================================
-- Migration 004: Feed
-- ============================================================
-- Social feed auto-populated after each run. Supports likes,
-- comments, and a follow graph for a personalized home timeline.
--
-- Tables:  feed_posts, feed_post_likes, feed_post_comments, followers
-- Triggers: trg_sync_comment_count, trg_sync_follow_counts
-- RPCs:    toggle_like(), toggle_follow(), get_feed()
-- ============================================================

-- ----------------------------------------------------------------
-- FEED POSTS
-- ----------------------------------------------------------------
create table public.feed_posts (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references public.profiles(id) on delete cascade,
  run_id              uuid        references public.runs(id) on delete set null,
  content             text,                    -- optional caption
  distance_km         numeric(6,3),            -- denormalized for display
  territories_claimed int         default 0,   -- denormalized for display
  likes               int         not null default 0,
  comment_count       int         not null default 0,
  created_at          timestamptz not null default now()
);

create index feed_posts_created_at_idx on public.feed_posts(created_at desc);
create index feed_posts_user_id_idx    on public.feed_posts(user_id);

comment on table public.feed_posts is 'Social feed posts — one created automatically after each run.';

-- ----------------------------------------------------------------
-- LIKES (junction table — prevents double-liking)
-- ----------------------------------------------------------------
create table public.feed_post_likes (
  post_id     uuid        not null references public.feed_posts(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

comment on table public.feed_post_likes is 'Per-user like records; counter on feed_posts kept in sync via toggle_like().';

-- ----------------------------------------------------------------
-- COMMENTS
-- ----------------------------------------------------------------
create table public.feed_post_comments (
  id          uuid        primary key default gen_random_uuid(),
  post_id     uuid        not null references public.feed_posts(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  content     text        not null check (char_length(content) between 1 and 500),
  created_at  timestamptz not null default now()
);

create index feed_post_comments_post_id_idx on public.feed_post_comments(post_id, created_at);

comment on table public.feed_post_comments is 'Comments on feed posts.';

-- Trigger: keep comment_count on feed_posts in sync
create or replace function public.sync_comment_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.feed_posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.feed_posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger trg_sync_comment_count
  after insert or delete on public.feed_post_comments
  for each row execute function public.sync_comment_count();

-- ----------------------------------------------------------------
-- FOLLOW GRAPH
-- Directed edges: follower_id -> following_id
-- ----------------------------------------------------------------
create table public.followers (
  follower_id   uuid        not null references public.profiles(id) on delete cascade,
  following_id  uuid        not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)   -- no self-follows
);

create index followers_following_id_idx on public.followers(following_id);
create index followers_follower_id_idx  on public.followers(follower_id);

comment on table public.followers is 'Social follow graph — directed edges between profiles.';

-- Trigger: keep follower_count / following_count on profiles in sync
create or replace function public.sync_follow_counts()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set follower_count  = follower_count  + 1 where id = new.following_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set following_count = greatest(0, following_count - 1) where id = old.follower_id;
    update public.profiles set follower_count  = greatest(0, follower_count  - 1) where id = old.following_id;
  end if;
  return null;
end;
$$;

create trigger trg_sync_follow_counts
  after insert or delete on public.followers
  for each row execute function public.sync_follow_counts();

-- ----------------------------------------------------------------
-- RPCs
-- ----------------------------------------------------------------

-- Atomic like / unlike — avoids race conditions from client increments
create or replace function public.toggle_like(p_post_id uuid, p_user_id uuid)
returns boolean   -- true = now liked, false = unliked
language plpgsql security definer set search_path = public
as $$
declare
  already_liked boolean;
begin
  select exists(
    select 1 from public.feed_post_likes
    where post_id = p_post_id and user_id = p_user_id
  ) into already_liked;

  if already_liked then
    delete from public.feed_post_likes
      where post_id = p_post_id and user_id = p_user_id;
    update public.feed_posts
      set likes = greatest(0, likes - 1)
      where id = p_post_id;
    return false;
  else
    insert into public.feed_post_likes (post_id, user_id)
      values (p_post_id, p_user_id)
      on conflict do nothing;
    update public.feed_posts
      set likes = likes + 1
      where id = p_post_id;
    return true;
  end if;
end;
$$;

-- Atomic follow / unfollow — returns the new follow state
create or replace function public.toggle_follow(target_id uuid)
returns boolean   -- true = now following, false = unfollowed
language plpgsql security definer as $$
declare
  already boolean;
begin
  select exists(
    select 1 from public.followers
    where follower_id = auth.uid() and following_id = target_id
  ) into already;

  if already then
    delete from public.followers
      where follower_id = auth.uid() and following_id = target_id;
    return false;
  else
    insert into public.followers (follower_id, following_id)
      values (auth.uid(), target_id);
    return true;
  end if;
end;
$$;

-- Personalized feed: own posts + followed users, newest first
create or replace function public.get_feed(lim int default 40, off_set int default 0)
returns table (
  id                  uuid,
  user_id             uuid,
  run_id              uuid,
  content             text,
  distance_km         numeric,
  territories_claimed int,
  likes               int,
  comment_count       int,
  created_at          timestamptz,
  username            text,
  avatar_url          text,
  level               int
)
language sql security definer stable as $$
  select
    fp.id, fp.user_id, fp.run_id, fp.content,
    fp.distance_km, fp.territories_claimed, fp.likes, fp.comment_count,
    fp.created_at, p.username, p.avatar_url, p.level
  from public.feed_posts fp
  join public.profiles p on p.id = fp.user_id
  where fp.user_id = auth.uid()
     or fp.user_id in (
          select following_id from public.followers where follower_id = auth.uid()
        )
  order by fp.created_at desc
  limit lim offset off_set;
$$;

-- ----------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------
alter table public.feed_posts         enable row level security;
alter table public.feed_post_likes    enable row level security;
alter table public.feed_post_comments enable row level security;
alter table public.followers          enable row level security;

create policy "feed_posts: anyone can read"
  on public.feed_posts for select using (true);
create policy "feed_posts: owner can insert"
  on public.feed_posts for insert with check (auth.uid() = user_id);
create policy "feed_posts: owner can delete"
  on public.feed_posts for delete using (auth.uid() = user_id);

create policy "feed_post_likes: anyone can read"
  on public.feed_post_likes for select using (true);
create policy "feed_post_likes: owner can insert"
  on public.feed_post_likes for insert with check (auth.uid() = user_id);
create policy "feed_post_likes: owner can delete"
  on public.feed_post_likes for delete using (auth.uid() = user_id);

create policy "feed_post_comments: anyone can read"
  on public.feed_post_comments for select using (true);
create policy "feed_post_comments: authenticated can post"
  on public.feed_post_comments for insert with check (auth.uid() = user_id);
create policy "feed_post_comments: owner can delete"
  on public.feed_post_comments for delete using (auth.uid() = user_id);

create policy "followers: anyone can read"
  on public.followers for select using (true);
create policy "followers: self can follow"
  on public.followers for insert with check (auth.uid() = follower_id);
create policy "followers: self can unfollow"
  on public.followers for delete using (auth.uid() = follower_id);

-- ----------------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------------
alter publication supabase_realtime add table public.feed_posts;
alter publication supabase_realtime add table public.feed_post_comments;

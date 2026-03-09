-- ----------------------------------------------------------------
-- Invite / referral system
-- ----------------------------------------------------------------

-- Track who referred each user (nullable — most users have no referrer)
alter table public.profiles
  add column if not exists referred_by text default null;

-- When a new user signs up with a referral, auto-follow the referrer
-- and reward both parties with +50 coins.
create or replace function public.handle_referral(
  p_new_user_id  uuid,
  p_referrer_username text
)
returns void
language plpgsql security definer as $$
declare
  v_referrer_id uuid;
begin
  -- Look up the referrer's user id
  select id into v_referrer_id
  from public.profiles
  where username = p_referrer_username
  limit 1;

  if v_referrer_id is null then
    return; -- unknown referrer, silently ignore
  end if;

  -- Store the referral link
  update public.profiles
  set referred_by = p_referrer_username
  where id = p_new_user_id;

  -- Auto-follow the referrer (new user follows referrer)
  insert into public.followers (follower_id, following_id)
  values (p_new_user_id, v_referrer_id)
  on conflict do nothing;

  -- Reward referrer +50 coins
  update public.profiles
  set coins = coins + 50
  where id = v_referrer_id;

  -- Reward new user +50 coins
  update public.profiles
  set coins = coins + 50
  where id = p_new_user_id;
end;
$$;

grant execute on function public.handle_referral(uuid, text) to authenticated;

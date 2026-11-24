-- ============================================================
-- PACE Store Phase 1: make spending safe
-- ============================================================
-- Nothing has ever spent PACE — the "Claim Reward" button is a hardcoded
-- Alert.alert('Coming Soon') with no backend at all (see
-- 20260701000073_pace_ledger_diagnostic.sql's own comment: "PACE Store
-- redemption is not live yet"). Earning has an atomic, race-safe RPC
-- (apply_pace_adjustment); spending has had nothing equivalent — this
-- migration adds that missing half.
--
-- redeem_reward() locks both the reward row and the profile row (`for
-- update`) before checking availability/balance and debiting, so two
-- concurrent redemption attempts by the same user (double-tap, retried
-- request) can't both succeed against a balance that only covers one. It's
-- SECURITY DEFINER and granted to service_role only — like
-- apply_pace_adjustment, it must be called from an edge function using the
-- service-role key (not directly from the client), because it writes
-- profiles.pace_balance, which protect_profile_columns() silently reverts
-- for any non-service-role caller.
--
-- One redemption per user per reward (UNIQUE constraint) — these are
-- one-time discount/perk rewards, not consumables; nothing today models
-- "redeem N times". Revisit if a reward type that wants repeat redemption
-- is ever added.

create table if not exists public.pace_redemptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  reward_id       uuid not null references public.pace_store_rewards(id),
  pace_spent      int  not null check (pace_spent > 0),
  -- Fulfillment is a manual follow-up for now (no code-pool/brand
  -- infrastructure exists yet — that's Phase 2). Both columns stay null
  -- until an operator fulfills the redemption by hand.
  fulfillment_code text,
  fulfilled_at     timestamptz,
  created_at       timestamptz not null default now(),
  unique (user_id, reward_id)
);

comment on table public.pace_redemptions is
  'Ledger of PACE spent on rewards. The only writer is redeem_reward() — no direct insert/update policy exists for authenticated users.';

alter table public.pace_redemptions enable row level security;

create policy "pace_redemptions: read own"
  on public.pace_redemptions for select
  using (auth.uid() = user_id);

create index if not exists idx_pace_redemptions_user on public.pace_redemptions(user_id);

create or replace function public.redeem_reward(
  p_user_id   uuid,
  p_reward_id uuid
)
returns table(success boolean, message text, new_balance int, redemption_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward  record;
  v_balance int;
  v_new_id  uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'redeem_reward is service_role only';
  end if;

  select * into v_reward
  from public.pace_store_rewards
  where id = p_reward_id
  for update;

  if v_reward is null then
    return query select false, 'Reward not found', null::int, null::uuid;
    return;
  end if;

  if v_reward.status <> 'available' then
    return query select false, 'This reward is not currently available', null::int, null::uuid;
    return;
  end if;

  if exists (
    select 1 from public.pace_redemptions
    where user_id = p_user_id and reward_id = p_reward_id
  ) then
    return query select false, 'You''ve already redeemed this reward', null::int, null::uuid;
    return;
  end if;

  select pace_balance into v_balance
  from public.profiles
  where id = p_user_id
  for update;

  if v_balance is null then
    return query select false, 'Profile not found', null::int, null::uuid;
    return;
  end if;

  if v_balance < v_reward.pace_cost then
    return query select false, 'Not enough PACE', v_balance, null::uuid;
    return;
  end if;

  update public.profiles
  set pace_balance = pace_balance - v_reward.pace_cost
  where id = p_user_id;

  insert into public.pace_redemptions (user_id, reward_id, pace_spent)
  values (p_user_id, p_reward_id, v_reward.pace_cost)
  returning id into v_new_id;

  return query select true, 'Redeemed', v_balance - v_reward.pace_cost, v_new_id;
end;
$$;

grant execute on function public.redeem_reward(uuid, uuid) to service_role;

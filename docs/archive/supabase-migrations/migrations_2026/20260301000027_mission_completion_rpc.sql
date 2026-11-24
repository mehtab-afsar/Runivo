-- ============================================================
-- Migration 027: Idempotent mission reward RPC
-- ============================================================
-- Adds a claimed boolean column to mission_progress (if not
-- already present) and a server-side RPC that awards XP and
-- coins exactly once per completed mission.
--
-- The client calls claim_mission_reward() instead of updating
-- profiles directly. The function:
--   1. Marks the mission row as claimed (only if completed=true
--      and claimed=false) using a single UPDATE … WHERE …
--   2. If the UPDATE touched exactly one row, increments the
--      caller's XP and coins atomically.
--   3. Returns false if the mission was already claimed or not
--      yet completed, so the client can show the right UI.
-- ============================================================

-- Add claimed column if a previous migration hasn't already
alter table public.mission_progress
  add column if not exists claimed boolean not null default false;

-- ── RPC ───────────────────────────────────────────────────────
create or replace function public.claim_mission_reward(
  p_mission_id text,
  p_xp         int,
  p_coins      int
)
returns boolean   -- true = reward granted, false = already claimed / not completed
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Atomically flip claimed → true, but only when the row belongs to the
  -- caller, is complete, and has not yet been claimed.
  update public.mission_progress
  set    claimed = true
  where  id      = p_mission_id
    and  user_id = auth.uid()
    and  completed = true
    and  claimed   = false;

  if not found then
    -- Either already claimed, not completed, or doesn't belong to this user.
    return false;
  end if;

  -- Exactly one row was flipped — award the rewards.
  update public.profiles
  set    xp    = xp    + p_xp,
         coins = coins + p_coins
  where  id = auth.uid();

  return true;
end;
$$;

comment on function public.claim_mission_reward is
  'Idempotent mission reward: awards XP and coins server-side only on the first claim call.
   Returns true when the reward was granted, false when already claimed or not completed.';

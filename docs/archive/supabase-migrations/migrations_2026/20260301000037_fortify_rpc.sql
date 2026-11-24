-- ============================================================
-- Migration 031: Fortify territory RPC
-- ============================================================
-- Adds a server-side fortify_territory function that:
--   1. Verifies the caller owns the territory
--   2. Deducts 30 energy atomically (fails cleanly if insufficient)
--   3. Increases defense by 20 (capped at 100)
--   4. Awards 10 XP
-- ============================================================

create or replace function public.fortify_territory(
  p_h3_index text,
  p_user_id  uuid
)
returns jsonb   -- {success: bool, reason: text|null}
language plpgsql
security definer
set search_path = public
as $$
declare
  energy_cost constant int := 30;
  xp_award    constant int := 10;
begin
  -- 1. Verify ownership
  if not exists (
    select 1 from public.territories
    where h3_index = p_h3_index and owner_id = p_user_id
  ) then
    return jsonb_build_object('success', false, 'reason', 'not_owner');
  end if;

  -- 2. Deduct energy atomically (WHERE energy >= cost prevents overdraft)
  update public.profiles
  set    energy = energy - energy_cost
  where  id     = p_user_id
    and  energy >= energy_cost;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'insufficient_energy');
  end if;

  -- 3. Increase defense (cap at 100)
  update public.territories
  set    defense          = least(defense + 20, 100),
         last_fortified_at = now(),
         updated_at        = now()
  where  h3_index = p_h3_index;

  -- 4. Award XP
  update public.profiles
  set    xp = xp + xp_award
  where  id = p_user_id;

  return jsonb_build_object('success', true, 'reason', null);
end;
$$;

comment on function public.fortify_territory is
  'Server-authoritative territory fortification. Deducts 30 energy, raises defense by 20 (max 100), awards 10 XP.';

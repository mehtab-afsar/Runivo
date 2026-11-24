-- ============================================================
-- Migration 026: Server-side energy regen RPC
-- ============================================================
-- Replaces the client-side 30-second polling interval that
-- computed energy regen from player.lastEnergyRegen.
--
-- Clients call sync_energy() on app foreground or run start.
-- The server uses its own clock, preventing manipulation by
-- users who advance their device clock to gain free energy.
--
-- Rate: 1 energy per hour (game scale 0-10), cap: 10 (MAX_ENERGY).
-- ============================================================

create or replace function public.sync_energy(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_energy   int;
  last_regen   timestamptz;
  gained       int;
  new_energy   int;
begin
  select energy, last_energy_regen
  into   cur_energy, last_regen
  from   public.profiles
  where  id = p_user_id;

  if not found then
    return 0;
  end if;

  -- 1 energy per hour = 1 per 3600 seconds (game scale: 0-10)
  gained := floor(extract(epoch from (now() - last_regen)) / 3600)::int;

  if gained <= 0 then
    return cur_energy;
  end if;

  new_energy := least(cur_energy + gained, 10);

  update public.profiles
  set    energy            = new_energy,
         last_energy_regen = now()
  where  id = p_user_id;

  return new_energy;
end;
$$;

comment on function public.sync_energy is
  'Applies time-based energy regen using server clock. Call on app foreground and run start.
   Returns the updated energy value. Rate: 1/hr, cap: 10 (game scale 0-10).';

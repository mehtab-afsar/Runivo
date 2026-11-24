-- Fix BUG-11: fortify_territory costs 30 energy but profiles.energy is capped at 10
-- Migration 047 changed the energy scale from 0-100 to 0-10 and updated claim_territory
-- to cost 1 energy, but forgot to update fortify_territory (still costs 30).
-- New cost: 3 energy (allows ~3 fortifies per full energy bar on the 0-10 scale).

CREATE OR REPLACE FUNCTION public.fortify_territory(
  p_h3_index text,
  p_user_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  energy_cost CONSTANT int := 3;   -- was 30; rescaled with migration 047 (energy now 0-10)
  xp_award    CONSTANT int := 10;
BEGIN
  -- 1. Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM public.territories
    WHERE h3_index = p_h3_index AND owner_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_owner');
  END IF;

  -- 2. Deduct energy atomically (WHERE energy >= cost prevents overdraft)
  UPDATE public.profiles
  SET    energy = energy - energy_cost
  WHERE  id     = p_user_id
    AND  energy >= energy_cost;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'insufficient_energy');
  END IF;

  -- 3. Increase defense (cap at 100)
  UPDATE public.territories
  SET    defense           = LEAST(defense + 20, 100),
         last_fortified_at = now(),
         updated_at        = now()
  WHERE  h3_index = p_h3_index;

  -- 4. Award XP
  UPDATE public.profiles
  SET    xp = xp + xp_award
  WHERE  id = p_user_id;

  RETURN jsonb_build_object('success', true, 'reason', null);
END;
$$;

COMMENT ON FUNCTION public.fortify_territory IS
  'Server-authoritative territory fortification. Deducts 3 energy (0-10 scale), raises defense by 20 (max 100), awards 10 XP.';

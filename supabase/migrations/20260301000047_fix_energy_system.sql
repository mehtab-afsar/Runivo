-- ============================================================
-- Migration 047: Fix energy system constants
-- ============================================================
-- The claim_territory() RPC was written with energy_cost = 10
-- (a 0-100 scale assumption) but the game design uses a 0-10
-- scale: MAX_ENERGY=10, ENERGY_COST_CLAIM=1, regen 1/km.
--
-- This also fixes the profiles.energy default which was 100
-- (impossible on the 0-10 scale) and adds a check constraint
-- so energy can never exceed 10.
--
-- Changes:
--   1. ALTER TABLE profiles — cap energy at 10, fix default
--   2. UPDATE profiles — bring existing rows into range
--   3. Replace claim_territory() energy_cost constant (10 → 1)
-- ============================================================

-- ── 1. Correct profiles.energy column ────────────────────────
alter table public.profiles
  alter column energy set default 10;

-- Clamp existing rows BEFORE adding the check constraint
update public.profiles set energy = 10 where energy > 10;
update public.profiles set energy = 0  where energy < 0;

alter table public.profiles
  add constraint profiles_energy_range check (energy between 0 and 10);

-- ── 2. Patch claim_territory() energy constant ────────────────
-- Full replacement — only the energy_cost constant changes.
create or replace function public.claim_territory(
  p_h3_index   text,
  p_owner_id   uuid,
  p_owner_name text,
  p_gps_proof  jsonb   -- [{lat, lng, timestamp}]  timestamp in ms epoch
)
returns jsonb   -- {success: bool, reason: text|null}
language plpgsql security definer set search_path = public
as $$
declare
  cur_energy    int;
  cur_tier      text;
  expires_at    timestamptz;
  tier_limit    int;
  zone_count    int;
  proof_count   int;
  pt0           jsonb;
  pt_last       jsonb;
  time_span_ms  float8;
  dist_m        float8;
  speed_ms      float8;
  energy_cost   constant int := 1;   -- ← was 10; game design: 0-10 scale, 1 per claim
begin
  -- ── 1. Load caller profile ────────────────────────────────
  select energy, subscription_tier, subscription_expires_at
  into   cur_energy, cur_tier, expires_at
  from   public.profiles
  where  id = p_owner_id;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'profile_not_found');
  end if;

  -- ── 2. Auto-downgrade expired subscription ────────────────
  if cur_tier <> 'free'
     and expires_at is not null
     and expires_at < now()
  then
    update public.profiles
    set    subscription_tier = 'free'
    where  id = p_owner_id;
    cur_tier := 'free';
  end if;

  -- ── 3. Tier territory cap ─────────────────────────────────
  tier_limit := case cur_tier
    when 'free'            then 50
    when 'runner-plus'     then null  -- unlimited
    when 'territory-lord'  then null
    when 'empire-builder'  then null
    else                        50
  end;

  if tier_limit is not null then
    select count(*) into zone_count
    from   public.territories
    where  owner_id = p_owner_id;

    if zone_count >= tier_limit then
      return jsonb_build_object('success', false, 'reason', 'tier_limit_reached');
    end if;
  end if;

  -- ── 4. Energy check ───────────────────────────────────────
  if cur_energy < energy_cost then
    return jsonb_build_object('success', false, 'reason', 'insufficient_energy');
  end if;

  -- ── 5. GPS proof validation ───────────────────────────────
  proof_count := jsonb_array_length(p_gps_proof);
  if proof_count < 3 then
    return jsonb_build_object('success', false, 'reason', 'insufficient_gps_proof');
  end if;

  pt0    := p_gps_proof->0;
  pt_last := p_gps_proof->(proof_count - 1);

  -- Time span between first and last point must be >= 30 seconds
  time_span_ms := ((pt_last->>'timestamp')::float8) - ((pt0->>'timestamp')::float8);
  if time_span_ms < 30000 then
    return jsonb_build_object('success', false, 'reason', 'gps_proof_too_short');
  end if;

  -- Implied speed must not exceed 12 m/s (~43 km/h)
  dist_m := public.haversine_m(
    (pt0->>'lat')::float8,     (pt0->>'lng')::float8,
    (pt_last->>'lat')::float8, (pt_last->>'lng')::float8
  );
  speed_ms := dist_m / (time_span_ms / 1000.0);
  if speed_ms > 12.0 then
    return jsonb_build_object('success', false, 'reason', 'gps_speed_implausible');
  end if;

  -- ── 6. Deduct energy atomically ───────────────────────────
  update public.profiles
  set    energy = energy - energy_cost
  where  id = p_owner_id;

  -- ── 7. Upsert territory ownership ────────────────────────
  insert into public.territories (h3_index, owner_id, owner_name, defense, tier, captured_at)
  values (p_h3_index, p_owner_id, p_owner_name, 50, 'bronze', now())
  on conflict (h3_index) do update
    set owner_id    = excluded.owner_id,
        owner_name  = excluded.owner_name,
        defense     = 50,
        tier        = 'bronze',
        captured_at = now(),
        updated_at  = now();

  -- ── 8. Increment profile territory counter ────────────────
  update public.profiles
  set    total_territories_claimed = total_territories_claimed + 1
  where  id = p_owner_id;

  return jsonb_build_object('success', true, 'reason', null);
end;
$$;

comment on function public.claim_territory is
  'Server-authoritative territory claim. Energy scale: 0-10, cost 1 per claim.
   Validates GPS proof plausibility and subscription tier limits.';

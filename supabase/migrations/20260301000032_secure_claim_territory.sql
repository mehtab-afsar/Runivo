-- ============================================================
-- Migration 023: Harden claim_territory RPC
-- ============================================================
-- Replaces the original claim_territory function (migration 003)
-- with a fully server-authoritative version that:
--   1. Checks energy >= 10 and deducts it atomically
--   2. Enforces per-tier territory count limits
--   3. Auto-downgrades expired subscriptions on every claim
--   4. Validates GPS proof: min 3 points, time span >= 30s,
--      implied speed <= 12 m/s (prevents teleport spoofing)
-- ============================================================

-- ── Helper: haversine distance in metres ─────────────────────
create or replace function public.haversine_m(
  lat1 float8, lng1 float8,
  lat2 float8, lng2 float8
)
returns float8
language sql immutable parallel safe as $$
  select 6371000.0 * 2.0 * asin(sqrt(
    pow(sin(radians((lat2 - lat1) / 2.0)), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    pow(sin(radians((lng2 - lng1) / 2.0)), 2)
  ))
$$;

-- ── Hardened RPC ─────────────────────────────────────────────
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
  energy_cost   constant int := 10;
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
    when 'free'            then 20
    when 'runner-plus'     then 100
    when 'territory-lord'  then 500
    when 'empire-builder'  then null  -- unlimited
    else                        20
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

  -- Implied speed must not exceed 12 m/s (~43 km/h, hard sprint cap)
  dist_m := public.haversine_m(
    (pt0->>'lat')::float8,    (pt0->>'lng')::float8,
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
  'Server-authoritative territory claim. Validates energy, subscription tier limits,
   expired subscriptions, and GPS proof plausibility before writing.';

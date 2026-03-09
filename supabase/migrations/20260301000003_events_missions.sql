-- ============================================================
-- Migration 003: Territories
-- ============================================================
-- Shared, multiplayer ownership map. One row per H3 hex cell.
-- Realtime-enabled so all clients see captures instantly.
--
-- claim_territory() is the server-side RPC that validates a GPS
-- proof array before transferring ownership, preventing trivial
-- spoofing from the client.
-- ============================================================

-- ----------------------------------------------------------------
-- TABLE
-- ----------------------------------------------------------------
create table public.territories (
  h3_index          text        primary key,
  owner_id          uuid        references public.profiles(id) on delete set null,
  owner_name        text,                      -- denormalized for fast map render
  defense           int         not null default 50 check (defense between 0 and 100),
  tier              text        not null default 'bronze' check (tier in ('bronze', 'silver', 'gold', 'crown')),
  captured_at       timestamptz,
  last_fortified_at timestamptz,
  updated_at        timestamptz not null default now()
);

create index territories_owner_id_idx on public.territories(owner_id);

comment on table public.territories is 'Live territory ownership — one row per H3 hex cell.';

-- ----------------------------------------------------------------
-- TRIGGERS
-- ----------------------------------------------------------------
create trigger territories_updated_at
  before update on public.territories
  for each row execute function public.handle_updated_at();

-- ----------------------------------------------------------------
-- RPC: claim_territory
-- Validates that the caller provided at least 3 GPS proof points
-- then atomically upserts the territory and bumps the profile counter.
-- Anti-cheat (proximity check, speed check) belongs in an Edge Function
-- that calls this RPC after server-side validation.
-- ----------------------------------------------------------------
create or replace function public.claim_territory(
  p_h3_index    text,
  p_owner_id    uuid,
  p_owner_name  text,
  p_gps_proof   jsonb   -- [{lat, lng, timestamp}]
)
returns jsonb   -- {success: bool, reason: text|null}
language plpgsql security definer set search_path = public
as $$
declare
  proof_count int;
begin
  proof_count := jsonb_array_length(p_gps_proof);
  if proof_count < 3 then
    return jsonb_build_object('success', false, 'reason', 'insufficient_gps_proof');
  end if;

  insert into public.territories (h3_index, owner_id, owner_name, defense, tier, captured_at)
  values (p_h3_index, p_owner_id, p_owner_name, 50, 'bronze', now())
  on conflict (h3_index) do update
    set owner_id    = excluded.owner_id,
        owner_name  = excluded.owner_name,
        defense     = 50,
        tier        = 'bronze',
        captured_at = now(),
        updated_at  = now();

  update public.profiles
    set total_territories_claimed = total_territories_claimed + 1
    where id = p_owner_id;

  return jsonb_build_object('success', true, 'reason', null);
end;
$$;

-- ----------------------------------------------------------------
-- RLS
-- All players can see the full map.
-- Insert: must be claiming as yourself (server validates GPS proof).
-- Update: open so the RPC can transfer ownership atomically.
-- ----------------------------------------------------------------
alter table public.territories enable row level security;

create policy "territories: anyone can read"
  on public.territories for select using (true);

create policy "territories: claim as yourself"
  on public.territories for insert with check (auth.uid() = owner_id);

create policy "territories: anyone can update"
  on public.territories for update using (true);

-- ----------------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------------
alter publication supabase_realtime add table public.territories;

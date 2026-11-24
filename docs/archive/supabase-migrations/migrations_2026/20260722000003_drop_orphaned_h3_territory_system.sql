-- ============================================================
-- Drop the orphaned H3-hexagon territory system
-- ============================================================
-- Runivo has shipped two parallel territory models since early on: the H3
-- hex-grid system defined here (migrations 003, 023/032, 037, 047, 054) and
-- the GPS-corridor-polygon system (territory_polygons, process-run-territory,
-- claim_unclaimed_area/steal_territory_portion/defend_own_territories) that
-- the live client actually uses. Confirmed zero live callers of the H3 path:
--   - Client: claimTerritoryRemote() (packages/shared/src/services/sync.ts)
--     was the only caller of claim_territory() and had zero callers itself.
--   - fortify_territory() has zero client callers under any name.
--   - Nothing reads or writes public.territories from client code (grepped
--     apps/mobile/src and packages/shared/src for `.from('territories')`).
--   - haversine_m() is referenced only by the two H3-cluster migrations
--     being dropped here, not by any live corridor-system function.
-- Keeping two territory models in the schema — only one of them wired to
-- anything — is exactly the "half-real hexagon" confusion a prior audit
-- flagged (P2-5). This migration removes the dead one outright rather than
-- leaving it as ambiguous tech debt.

DROP FUNCTION IF EXISTS public.claim_territory(text, uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.fortify_territory(text, uuid);
DROP FUNCTION IF EXISTS public.haversine_m(float8, float8, float8, float8);
DROP TABLE IF EXISTS public.territories CASCADE;

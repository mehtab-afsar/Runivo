-- ============================================================
-- P0: territory_score never populated + client can forge territory_polygons
-- ============================================================
-- C6: leaderboard_weekly (20260515000060) sorts by profiles.territory_score, and
-- get_territory_score() (20260515000056) computes it correctly, but nothing ever
-- persists that value onto the row — protect_profile_columns (20260701000075)
-- even locks clients out of setting it, and its own comment admits "NOTHING
-- writes this column". Every profile ships with territory_score = 0, so the
-- leaderboard's primary sort key is a tie across all users.
--
-- Fix: a trigger on territory_polygons recomputes the affected owner's
-- territory_score after every insert/update/delete. This always runs in a
-- service_role context (see H13 below — clients can no longer write this table
-- directly), so protect_profile_columns' service_role bypass lets it through.

CREATE OR REPLACE FUNCTION sync_territory_score(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  UPDATE profiles SET territory_score = get_territory_score(p_user_id) WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_territory_score TO service_role;

CREATE OR REPLACE FUNCTION territory_polygons_sync_score()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM sync_territory_score(OLD.owner_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM sync_territory_score(NEW.owner_id);
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
      PERFORM sync_territory_score(OLD.owner_id);
    END IF;
    RETURN NEW;
  ELSE
    PERFORM sync_territory_score(NEW.owner_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS territory_polygons_score_sync ON territory_polygons;
CREATE TRIGGER territory_polygons_score_sync
  AFTER INSERT OR UPDATE OR DELETE ON territory_polygons
  FOR EACH ROW EXECUTE FUNCTION territory_polygons_sync_score();

-- Backfill existing rows so scores aren't stuck at 0 until the next claim/steal.
DO $$
DECLARE v_owner UUID;
BEGIN
  FOR v_owner IN SELECT DISTINCT owner_id FROM territory_polygons WHERE owner_id IS NOT NULL LOOP
    PERFORM sync_territory_score(v_owner);
  END LOOP;
END;
$$;

-- ============================================================
-- H13: any authenticated client can INSERT/UPDATE/DELETE forged polygons
-- ============================================================
-- "tp_owner ON territory_polygons FOR ALL USING (owner_id = auth.uid())"
-- (20260515000056) lets a client insert an arbitrary area_m2/tier/polygon_coords
-- row for themselves directly — one curl with the anon key claims a
-- 10^9 m^2 "domain" that dominates every ranking and is un-stealable (near-zero
-- overlap %). The client no longer needs write access here: process-run-territory
-- (service_role, via claim_unclaimed_area / steal_territory_portion /
-- defend_own_territories) is the sole claim path (see packages/shared's sync.ts —
-- pushPolygonTerritories was removed). Reads stay public for map/rival rendering.

DROP POLICY IF EXISTS "tp_owner" ON territory_polygons;

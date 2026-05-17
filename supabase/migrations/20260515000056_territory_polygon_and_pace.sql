-- Territory polygon table + PACE economy columns
-- Replaces H3 hex-dwell model with GPS corridor polygon model.
-- Non-destructive: existing xp/coins/energy columns are kept for soft migration.

-- ── territory_polygons ────────────────────────────────────────────────────────

CREATE TABLE territory_polygons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           UUID REFERENCES runs(id) ON DELETE CASCADE,
  owner_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  geom             GEOMETRY(Polygon, 4326) NOT NULL,
  geom_simplified  GEOMETRY(Polygon, 4326),
  area_m2          FLOAT8 NOT NULL,
  freshness        SMALLINT NOT NULL DEFAULT 100 CHECK (freshness BETWEEN 0 AND 100),
  last_defended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_loop_fill     BOOLEAN NOT NULL DEFAULT false,
  tier             TEXT NOT NULL CHECK (tier IN ('patch','block','district','quarter','domain')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON territory_polygons USING gist(geom);
CREATE INDEX ON territory_polygons(owner_id);
CREATE INDEX ON territory_polygons(last_defended_at);

ALTER TABLE territory_polygons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tp_read"  ON territory_polygons FOR SELECT USING (true);
CREATE POLICY "tp_owner" ON territory_polygons FOR ALL    USING (owner_id = auth.uid());

-- ── profiles: PACE columns (additive — keep xp/coins/energy) ─────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pace_balance       INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pace_total_earned  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pace_weekly_earned INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pace_weekly_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS runner_rank        TEXT NOT NULL DEFAULT 'pacer'
    CHECK (runner_rank IN ('pacer','strider','chaser','hunter','sovereign')),
  ADD COLUMN IF NOT EXISTS territory_score    FLOAT8 NOT NULL DEFAULT 0;

-- ── Realtime ──────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE territory_polygons;

-- ── RPCs ──────────────────────────────────────────────────────────────────────

-- Compute live territory score from polygons with freshness decay applied.
CREATE OR REPLACE FUNCTION get_territory_score(p_user_id UUID)
RETURNS FLOAT8
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(SUM(
    area_m2 * (
      0.5 + GREATEST(0,
        freshness - (
          EXTRACT(EPOCH FROM (now() - last_defended_at)) / 86400 * 10
        )::INT
      ) / 100.0 * 0.5
    )
  ), 0)
  FROM territory_polygons
  WHERE owner_id = p_user_id;
$$;

-- Return polygons intersecting a viewport bounding box (for map rendering).
CREATE OR REPLACE FUNCTION get_map_polygons(
  min_lat FLOAT8,
  min_lng FLOAT8,
  max_lat FLOAT8,
  max_lng FLOAT8
)
RETURNS TABLE(
  id               UUID,
  owner_id         UUID,
  owner_name       TEXT,
  area_m2          FLOAT8,
  freshness        SMALLINT,
  last_defended_at TIMESTAMPTZ,
  is_loop_fill     BOOLEAN,
  tier             TEXT,
  geom_simplified  GEOMETRY
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    tp.id,
    tp.owner_id,
    p.username,
    tp.area_m2,
    tp.freshness,
    tp.last_defended_at,
    tp.is_loop_fill,
    tp.tier,
    tp.geom_simplified
  FROM territory_polygons tp
  JOIN profiles p ON p.id = tp.owner_id
  WHERE ST_Intersects(
    tp.geom,
    ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  )
  LIMIT 500;
$$;

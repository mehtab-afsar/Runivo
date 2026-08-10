-- ============================================================
-- Awards were spoofable: eligibility was computed entirely on-device
-- (packages/shared/src/hooks/useGameEngine.ts checkAndAwardAchievements)
-- and written with a bare `insert into user_awards`. The only RLS check was
-- `user_id = auth.uid()` — it never validated award_id against anything, so
-- any authenticated client could grant itself any of the 21 awards directly
-- via the REST API with zero runs.
--
-- While auditing that path we found a second, larger problem, verified against
-- a real local instance (pg_default_acl): this project's `public` schema has
-- default privileges of `GRANT EXECUTE ON FUNCTIONS TO anon, authenticated,
-- service_role`, applied automatically to every new function at creation time.
-- That means the existing server-authoritative territory/PACE RPCs
-- (apply_pace_adjustment, steal_territory_portion, claim_unclaimed_area,
-- defend_own_territories, find_intersecting_territories — all added in
-- 20260515000059_territory_engine_rpcs.sql) were callable by ANY authenticated
-- client the moment they were created — `GRANT EXECUTE ... TO service_role`
-- was pure decoration; nothing ever took the automatic authenticated/anon grant
-- away. Since `public` is exposed to PostgREST (supabase/config.toml), any
-- signed-in user could already call these directly — e.g.
-- `rpc('apply_pace_adjustment', {p_user_id: self, p_pace_delta: 999999})` to
-- mint unlimited PACE, or `claim_unclaimed_area` with a fabricated polygon
-- anywhere on Earth — completely bypassing process-run-territory's
-- GPS/distance/cap checks. A plain `REVOKE ... FROM PUBLIC` does NOT undo this
-- (confirmed by testing: has_function_privilege('authenticated', ...) stayed
-- true after a PUBLIC-only revoke) — the grant to `authenticated`/`anon` has
-- to be revoked explicitly, which is what every REVOKE below does. This
-- migration closes both holes in one place.
--
-- This default-privilege setup affects every function in `public`, not just
-- these six — any other SECURITY DEFINER / privileged function added without
-- an explicit REVOKE FROM anon, authenticated has the same exposure. Worth a
-- dedicated follow-up pass across the rest of the schema; out of scope here.
-- ============================================================

-- ── 1. Awards can no longer be inserted directly by clients ──────────────────

DROP POLICY IF EXISTS "awards_insert_own" ON user_awards;
-- No replacement INSERT policy: every grant now goes through grant_award() /
-- sync_user_awards() below, both SECURITY DEFINER and service_role-only, which
-- bypass RLS as the table owner (same pattern as apply_pace_adjustment).

-- ── 2. grant_award — idempotent, single-award grant for event-based awards ───
-- Used by process-run-territory for awards tied to a specific run's server-
-- computed outcome (first_blood / defender) rather than a re-checkable
-- threshold over current state.

CREATE OR REPLACE FUNCTION grant_award(p_user_id UUID, p_award_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_awards (user_id, award_id) VALUES (p_user_id, p_award_id)
    ON CONFLICT (user_id, award_id) DO NOTHING;
  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION grant_award(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION grant_award(UUID, TEXT) TO service_role;

-- ── 3. sync_user_awards — re-derives every threshold-based award from real,
-- current-state tables (runs, territory_polygons, profiles, personal_records)
-- and grants whatever newly qualifies. Safe to call after every run; it only
-- ever inserts awards the caller has actually earned, and re-running it is a
-- no-op for anything already granted.
--
-- sub_5 / sub_4_30 are intentionally left ungranted here: nothing in the app
-- currently writes personal_records.best_pace_sec, so those two awards are not
-- yet earnable through any path, client or server. Wiring that computation is
-- a separate, larger feature (a real personal-records pipeline) — left as a
-- known gap rather than faked.
-- ============================================================

CREATE OR REPLACE FUNCTION sync_user_awards(p_user_id UUID)
RETURNS TEXT[] LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total_km       FLOAT8;
  v_best_run_km    FLOAT8;
  v_month_km       FLOAT8;
  v_early_count    INT;
  v_streak_days    INT;
  v_pace_total     INT;
  v_runner_rank    TEXT;
  v_owns_any       BOOLEAN;
  v_owns_district  BOOLEAN;
  v_owns_quarter   BOOLEAN;
  v_owns_domain    BOOLEAN;
  v_owns_loop_fill BOOLEAN;
  v_territory_area FLOAT8;
  v_candidate      TEXT;
  v_granted        TEXT[] := '{}';
BEGIN
  SELECT COALESCE(SUM(distance_m), 0) / 1000.0, COALESCE(MAX(distance_m), 0) / 1000.0
    INTO v_total_km, v_best_run_km
    FROM runs WHERE user_id = p_user_id AND activity_type = 'run';

  SELECT COALESCE(MAX(month_km), 0) INTO v_month_km FROM (
    SELECT SUM(distance_m) / 1000.0 AS month_km
    FROM runs WHERE user_id = p_user_id AND activity_type = 'run'
    GROUP BY date_trunc('month', started_at)
  ) months;

  -- UTC hour, not the runner's local time (the server has no notion of it —
  -- same caveat already documented for streak crediting in process-run-territory).
  SELECT COUNT(*) INTO v_early_count
    FROM runs
    WHERE user_id = p_user_id AND activity_type = 'run'
      AND EXTRACT(HOUR FROM started_at AT TIME ZONE 'utc') < 6;

  SELECT streak_days, pace_total_earned, runner_rank
    INTO v_streak_days, v_pace_total, v_runner_rank
    FROM profiles WHERE id = p_user_id;

  SELECT
    bool_or(TRUE),
    bool_or(tier IN ('district', 'quarter', 'domain')),
    bool_or(tier IN ('quarter', 'domain')),
    bool_or(tier = 'domain'),
    bool_or(is_loop_fill),
    COALESCE(SUM(area_m2), 0)
  INTO v_owns_any, v_owns_district, v_owns_quarter, v_owns_domain, v_owns_loop_fill, v_territory_area
  FROM territory_polygons WHERE owner_id = p_user_id;

  FOR v_candidate IN
    SELECT unnest(ARRAY[
      CASE WHEN v_owns_any                                  THEN 'first_claim' END,
      CASE WHEN v_owns_district                             THEN 'district_owner' END,
      CASE WHEN v_owns_quarter                              THEN 'quarter_owner' END,
      CASE WHEN v_owns_domain                                THEN 'domain_lord' END,
      CASE WHEN v_owns_loop_fill                             THEN 'park_capture' END,
      CASE WHEN v_territory_area >= 500000                   THEN 'city_builder' END,
      CASE WHEN v_runner_rank = 'sovereign' OR v_pace_total >= 4000 THEN 'sovereign_rank' END,
      CASE WHEN v_best_run_km >= 5                           THEN 'first_5k' END,
      CASE WHEN v_best_run_km >= 10                          THEN 'first_10k' END,
      CASE WHEN v_best_run_km >= 21                          THEN 'first_halfmarathon' END,
      CASE WHEN v_total_km >= 100                            THEN 'km_100' END,
      CASE WHEN v_total_km >= 500                            THEN 'km_500' END,
      CASE WHEN v_total_km >= 1000                           THEN 'km_1000' END,
      CASE WHEN v_month_km >= 100                            THEN 'monthly_100' END,
      CASE WHEN v_streak_days >= 7                           THEN 'streak_7' END,
      CASE WHEN v_streak_days >= 30                          THEN 'streak_30' END,
      CASE WHEN v_early_count >= 5                           THEN 'early_bird' END
    ])
  LOOP
    CONTINUE WHEN v_candidate IS NULL;
    INSERT INTO user_awards (user_id, award_id) VALUES (p_user_id, v_candidate)
      ON CONFLICT (user_id, award_id) DO NOTHING;
    IF FOUND THEN
      v_granted := array_append(v_granted, v_candidate);
    END IF;
  END LOOP;

  RETURN v_granted;
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_user_awards(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sync_user_awards(UUID) TO service_role;

-- ── 4. count_defendable_stale_zones — lets process-run-territory detect the
-- "defender" award (re-ran a stale zone before a rival could steal it) using
-- the same freshness/intersection signal it already uses for
-- defend_own_territories, checked BEFORE that call refreshes freshness.
-- ============================================================

CREATE OR REPLACE FUNCTION count_defendable_stale_zones(
  p_wkt      TEXT,
  p_owner_id UUID,
  p_stale_at SMALLINT
)
RETURNS INT LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT COUNT(*)::INT FROM territory_polygons
  WHERE owner_id = p_owner_id
    AND geom IS NOT NULL
    AND freshness < p_stale_at
    AND ST_Intersects(geom, ST_GeomFromText(p_wkt, 4326));
$$;

REVOKE EXECUTE ON FUNCTION count_defendable_stale_zones(TEXT, UUID, SMALLINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION count_defendable_stale_zones(TEXT, UUID, SMALLINT) TO service_role;

-- ── 5. Lock down the territory/PACE RPCs that were silently PUBLIC-executable
-- since 20260515000059_territory_engine_rpcs.sql. GRANT ... TO service_role
-- there was never paired with a REVOKE FROM PUBLIC, so any authenticated
-- client could already call these directly and bypass process-run-territory's
-- anti-cheat checks entirely (fabricate a WKT anywhere, credit unlimited PACE,
-- steal any zone with no GPS trace). get_map_polygons is deliberately left
-- alone — the map screen calls it directly and it only reads public data.
-- ============================================================

REVOKE EXECUTE ON FUNCTION apply_pace_adjustment(UUID, INT)                         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION steal_territory_portion(UUID, TEXT, UUID, UUID)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION claim_unclaimed_area(TEXT, UUID, UUID)                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION defend_own_territories(TEXT, UUID)                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION find_intersecting_territories(TEXT, UUID)                FROM PUBLIC, anon, authenticated;

-- ── 6. get_profile_stats referenced a column that has never existed on `runs`
-- (`distance_meters` / `calories_burned` instead of the real `distance_m`) —
-- every call to this RPC (StatsTab's per-period fetch, via useProfile.ts
-- loadStats) has been erroring out since it was written. One-line fix,
-- touched while already in this file for the awards work.
-- ============================================================

CREATE OR REPLACE FUNCTION get_profile_stats(
  p_user_id UUID,
  p_period  TEXT DEFAULT 'all'
) RETURNS JSON AS $$
DECLARE v_cutoff TIMESTAMPTZ;
BEGIN
  v_cutoff := CASE p_period
    WHEN 'week'  THEN date_trunc('week',  now() AT TIME ZONE 'utc')
    WHEN 'month' THEN date_trunc('month', now() AT TIME ZONE 'utc')
    WHEN 'year'  THEN date_trunc('year',  now() AT TIME ZONE 'utc')
    ELSE '1970-01-01'::TIMESTAMPTZ
  END;
  RETURN (
    SELECT json_build_object(
      'totalKm',       COALESCE(SUM(distance_m) / 1000.0, 0),
      'totalRuns',     COUNT(*),
      'avgPaceSec',    COALESCE(AVG(NULLIF(duration_sec::FLOAT / NULLIF(distance_m / 1000.0, 0), 0)), 0)::INT,
      'totalCalories', COALESCE(SUM(calories_burned), 0),
      'totalZones',    COALESCE(SUM(CARDINALITY(territories_claimed)), 0)
    )
    FROM runs
    WHERE user_id = p_user_id AND started_at >= v_cutoff
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

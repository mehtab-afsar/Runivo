-- ============================================================
-- v1 integrity pass: PACE can't be farmed, territory maths agrees
-- with the app, scores fade on the leaderboard.
-- ============================================================
-- Findings this closes (see docs/V1_AUDIT.md):
--   PACE-1  pace_weekly_reset_at was client-writable -> unlimited weekly cap
--   PACE-3  cap read-then-write race in the edge function and missions
--   PACE-4  mission credits were reverted by protect_profile_columns (the
--           SECURITY DEFINER function still runs as role 'authenticated');
--           missions could be re-claimed under new ids
--   PACE-6  runner_rank was client-writable
--   PACE-10 redemption ignored expires_at and had no stock
--   TERR-1/3 server corridors could self-cross (invalid geometry); loops were
--           never filled. The server now builds shapes with PostGIS.
--   TERR-5  profiles.territory_score never decayed
--   TERR-6  decay rounded on the server, floored on the client
--   TERR-9  steal counted/paid even when nothing moved; rival kept old tier
--   TERR-10 claim_unclaimed_area dropped every piece but the largest
--
-- Rules here must match packages/shared/src/engine/runEngine.ts (ENGINE).

-- ── 1. Trusted-writer bypass + lock the remaining economy columns ─────────────
-- Our own SECURITY DEFINER functions set runivo.trusted_writer for the length
-- of one statement block. Clients can't call set_config through PostgREST
-- (pg_catalog isn't exposed), so this can't be spoofed from the app.

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role'
     OR current_setting('runivo.trusted_writer', true) = 'on' THEN
    RETURN NEW;
  END IF;

  NEW.subscription_tier       := OLD.subscription_tier;
  NEW.subscription_expires_at := OLD.subscription_expires_at;
  NEW.pace_balance            := OLD.pace_balance;
  NEW.pace_total_earned       := OLD.pace_total_earned;
  NEW.pace_weekly_earned      := OLD.pace_weekly_earned;
  NEW.pace_weekly_reset_at    := OLD.pace_weekly_reset_at;
  NEW.runner_rank             := OLD.runner_rank;
  NEW.territory_score         := OLD.territory_score;
  NEW.follower_count          := OLD.follower_count;
  NEW.following_count         := OLD.following_count;
  NEW.streak_days             := OLD.streak_days;
  NEW.last_run_date           := OLD.last_run_date;
  NEW.total_distance_km       := OLD.total_distance_km;
  NEW.total_runs              := OLD.total_runs;

  RETURN NEW;
END;
$$;

-- ── 2. Rank from lifetime PACE (mirrors ENGINE.RANK_THRESHOLDS) ───────────────

CREATE OR REPLACE FUNCTION public.rank_for_pace(p_total int)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_total >= 4000 THEN 'sovereign'
    WHEN p_total >= 1500 THEN 'hunter'
    WHEN p_total >=  600 THEN 'chaser'
    WHEN p_total >=  200 THEN 'strider'
    ELSE 'pacer'
  END;
$$;

-- ── 3. PACE ledger and the one function allowed to credit PACE ────────────────

CREATE TABLE IF NOT EXISTS public.pace_awards (
  id          bigserial   PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source      text        NOT NULL CHECK (source IN ('run', 'mission', 'campaign', 'adjustment')),
  source_key  text        NOT NULL,
  requested   int         NOT NULL,
  credited    int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_key)
);

COMMENT ON TABLE public.pace_awards IS
  'Every PACE credit, once per (source, source_key). Written only by credit_pace_capped().';

ALTER TABLE public.pace_awards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pace_awards: read own" ON public.pace_awards;
CREATE POLICY "pace_awards: read own" ON public.pace_awards
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_pace_awards_user ON public.pace_awards(user_id, created_at DESC);

-- Atomic: locks the profile row, applies the weekly cap (Monday 00:00 UTC),
-- records the award once, updates balance, lifetime total and rank.
-- Returns PACE actually credited (0 if already awarded or capped).
CREATE OR REPLACE FUNCTION public.credit_pace_capped(
  p_user_id    uuid,
  p_amount     int,
  p_source     text,
  p_source_key text
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start timestamptz := date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_weekly     int;
  v_reset_at   timestamptz;
  v_tier       text;
  v_total      int;
  v_cap        int;
  v_credit     int;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.pace_awards (user_id, source, source_key, requested)
  VALUES (p_user_id, p_source, p_source_key, p_amount)
  ON CONFLICT (source, source_key) DO NOTHING;
  IF NOT FOUND THEN
    RETURN 0; -- already awarded: replays pay nothing
  END IF;

  SELECT pace_weekly_earned, pace_weekly_reset_at, subscription_tier, pace_total_earned
    INTO v_weekly, v_reset_at, v_tier, v_total
    FROM public.profiles WHERE id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF v_reset_at IS NULL OR v_reset_at < v_week_start THEN
    v_weekly := 0;
  END IF;
  v_weekly := COALESCE(v_weekly, 0);
  v_cap    := CASE WHEN v_tier IN ('premium', 'admin') THEN 150 ELSE 100 END;
  v_credit := LEAST(p_amount, GREATEST(0, v_cap - v_weekly));
  v_total  := COALESCE(v_total, 0) + v_credit;

  PERFORM set_config('runivo.trusted_writer', 'on', true);
  UPDATE public.profiles
  SET pace_balance         = COALESCE(pace_balance, 0) + v_credit,
      pace_total_earned    = v_total,
      pace_weekly_earned   = v_weekly + v_credit,
      pace_weekly_reset_at = v_week_start,
      runner_rank          = public.rank_for_pace(v_total)
  WHERE id = p_user_id;
  PERFORM set_config('runivo.trusted_writer', 'off', true);

  UPDATE public.pace_awards SET credited = v_credit
  WHERE source = p_source AND source_key = p_source_key;

  RETURN v_credit;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_pace_capped(uuid, int, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_pace_capped(uuid, int, text, text) TO service_role;

-- The old uncapped helper must not be callable by anything but the server.
REVOKE ALL ON FUNCTION public.apply_pace_adjustment(uuid, int) FROM PUBLIC, anon, authenticated;

-- Backfill ranks from lifetime PACE.
DO $$
BEGIN
  PERFORM set_config('runivo.trusted_writer', 'on', true);
  UPDATE public.profiles
  SET runner_rank = public.rank_for_pace(COALESCE(pace_total_earned, 0))
  WHERE runner_rank IS DISTINCT FROM public.rank_for_pace(COALESCE(pace_total_earned, 0));
  PERFORM set_config('runivo.trusted_writer', 'off', true);
END $$;

-- ── 4. Missions: once per title per UTC day, credited through the ledger ──────

CREATE OR REPLACE FUNCTION public.claim_mission_reward(
  p_mission_id text,
  p_title      text
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward int;
  v_today  date := (now() AT TIME ZONE 'UTC')::date;
  v_credit int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  v_reward := public.mission_pace_reward(p_title);
  IF v_reward IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT public.mission_completed_today(auth.uid(), p_title) THEN
    RETURN 0;
  END IF;

  -- History row (kept for the app's "claimed" state); the ledger key below is
  -- what actually stops a second payout, whatever mission id the app sends.
  INSERT INTO public.mission_claims (user_id, mission_id, pace_earned)
  VALUES (auth.uid(), p_mission_id, 0)
  ON CONFLICT (user_id, mission_id) DO NOTHING;

  v_credit := public.credit_pace_capped(
    auth.uid(), v_reward, 'mission',
    auth.uid()::text || ':' || p_title || ':' || v_today::text
  );

  UPDATE public.mission_claims SET pace_earned = v_credit
  WHERE user_id = auth.uid() AND mission_id = p_mission_id;

  RETURN v_credit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_mission_reward(text, text) TO authenticated;

-- ── 5. One processing per run ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.run_processing (
  run_id      uuid        PRIMARY KEY REFERENCES public.runs(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  result      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.run_processing IS
  'process-run-territory claims a run here first; a replay returns the stored result and changes nothing.';

ALTER TABLE public.run_processing ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.

-- ── 6. Territory geometry built by PostGIS ────────────────────────────────────
-- The edge function sends the simplified route line and, for loops, the loop
-- ring. The strip is a true 12 m buffer; a loop adds its (repaired) interior.
-- Returns one valid polygon (largest part) without holes, plus its area.

CREATE OR REPLACE FUNCTION public.build_territory_geom(
  p_line_wkt     text,
  p_ring_wkt     text,
  p_half_width_m float8 DEFAULT 12
)
RETURNS TABLE(wkt text, area_m2 float8, is_loop boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_strip geometry;
  v_fill  geometry;
  v_geom  geometry;
  v_best  geometry;
  v_solid geometry;
  v_loop  boolean := false;
BEGIN
  v_strip := ST_Buffer(ST_GeomFromText(p_line_wkt, 4326)::geography, p_half_width_m, 'quad_segs=4')::geometry;
  v_geom  := v_strip;

  IF p_ring_wkt IS NOT NULL THEN
    v_fill := ST_CollectionExtract(ST_MakeValid(ST_GeomFromText(p_ring_wkt, 4326)), 3);
    IF v_fill IS NOT NULL AND NOT ST_IsEmpty(v_fill) AND ST_Area(v_fill::geography) <= 500000 THEN
      v_geom := ST_Union(v_strip, v_fill);
      v_loop := true;
    END IF;
  END IF;

  SELECT d.geom INTO v_best
  FROM ST_Dump(ST_CollectionExtract(ST_MakeValid(v_geom), 3)) d
  ORDER BY ST_Area(d.geom::geography) DESC
  LIMIT 1;
  IF v_best IS NULL THEN
    RETURN;
  END IF;

  -- polygon_coords only stores the outer ring, so store a solid shape whose
  -- area matches what's drawn. Very large enclosed holes keep their holes.
  v_solid := ST_MakePolygon(ST_ExteriorRing(v_best));
  IF ST_Area(v_solid::geography) <= 500000 OR v_loop THEN
    v_best := v_solid;
  END IF;

  wkt     := ST_AsText(v_best);
  area_m2 := ST_Area(v_best::geography);
  is_loop := v_loop;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.build_territory_geom(text, text, float8) TO service_role;

-- ── 7. Claims keep every free piece, and report what they inserted ────────────

DROP FUNCTION IF EXISTS public.claim_unclaimed_area(text, uuid, uuid);

CREATE OR REPLACE FUNCTION public.claim_unclaimed_area(
  p_wkt      text,
  p_owner_id uuid,
  p_run_id   uuid,
  p_is_loop  boolean DEFAULT false
)
RETURNS TABLE(pieces int, area_m2 float8)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_run      geometry := ST_GeomFromText(p_wkt, 4326);
  v_existing geometry;
  v_free     geometry;
  v_part     geometry;
  v_area     float8;
  v_coords   jsonb;
  v_pieces   int := 0;
  v_total    float8 := 0;
BEGIN
  SELECT ST_Union(geom) INTO v_existing
  FROM public.territory_polygons
  WHERE geom IS NOT NULL AND ST_Intersects(geom, v_run);

  v_free := CASE WHEN v_existing IS NULL THEN v_run ELSE ST_Difference(v_run, v_existing) END;
  IF v_free IS NULL OR ST_IsEmpty(v_free) THEN
    pieces := 0; area_m2 := 0; RETURN NEXT; RETURN;
  END IF;

  FOR v_part IN
    SELECT d.geom FROM ST_Dump(ST_CollectionExtract(v_free, 3)) d
    ORDER BY ST_Area(d.geom::geography) DESC
  LOOP
    v_area := ST_Area(v_part::geography);
    CONTINUE WHEN v_area < 100;
    v_coords := (ST_AsGeoJSON(v_part)::jsonb -> 'coordinates' -> 0);
    CONTINUE WHEN v_coords IS NULL OR jsonb_array_length(v_coords) < 4;

    INSERT INTO public.territory_polygons (
      id, run_id, owner_id, polygon_coords, area_m2,
      freshness, last_defended_at, claimed_at, is_loop_fill, tier
    ) VALUES (
      gen_random_uuid(), p_run_id, p_owner_id, v_coords, v_area,
      100, now(), now(), p_is_loop,
      CASE
        WHEN v_area <   5000 THEN 'patch'
        WHEN v_area <  50000 THEN 'block'
        WHEN v_area < 200000 THEN 'district'
        WHEN v_area < 500000 THEN 'quarter'
        ELSE 'domain'
      END
    );
    v_pieces := v_pieces + 1;
    v_total  := v_total + v_area;
  END LOOP;

  pieces := v_pieces; area_m2 := v_total; RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_unclaimed_area(text, uuid, uuid, boolean) TO service_role;

-- ── 8. Steals report the area that actually moved; rival tier recomputed ──────

DROP FUNCTION IF EXISTS public.steal_territory_portion(uuid, text, uuid, uuid);

CREATE OR REPLACE FUNCTION public.steal_territory_portion(
  p_rival_id   uuid,
  p_new_wkt    text,
  p_new_owner  uuid,
  p_run_id     uuid
)
RETURNS float8
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rival_geom  geometry;
  run_geom    geometry;
  stolen_geom geometry;
  remain_geom geometry;
  part        geometry;
  part_area   float8;
  part_coords jsonb;
  is_first    boolean;
  v_taken     float8 := 0;
BEGIN
  SELECT geom INTO rival_geom FROM public.territory_polygons WHERE id = p_rival_id FOR UPDATE;
  IF rival_geom IS NULL THEN RETURN 0; END IF;

  run_geom    := ST_GeomFromText(p_new_wkt, 4326);
  stolen_geom := ST_Intersection(rival_geom, run_geom);
  remain_geom := ST_Difference(rival_geom, run_geom);

  IF stolen_geom IS NULL OR ST_IsEmpty(stolen_geom) OR ST_Area(stolen_geom::geography) < 50 THEN
    RETURN 0;
  END IF;

  -- Attacker's pieces first, so the return value is what they actually gained.
  FOR part IN
    SELECT d.geom FROM ST_Dump(ST_CollectionExtract(stolen_geom, 3)) d
    ORDER BY ST_Area(d.geom::geography) DESC
  LOOP
    part_area := ST_Area(part::geography);
    CONTINUE WHEN part_area < 50;
    part_coords := (ST_AsGeoJSON(part)::jsonb -> 'coordinates' -> 0);
    CONTINUE WHEN part_coords IS NULL OR jsonb_array_length(part_coords) < 4;

    INSERT INTO public.territory_polygons (
      id, run_id, owner_id, polygon_coords, area_m2,
      freshness, last_defended_at, claimed_at, is_loop_fill, tier
    ) VALUES (
      gen_random_uuid(), p_run_id, p_new_owner, part_coords, part_area,
      100, now(), now(), false,
      CASE
        WHEN part_area <   5000 THEN 'patch'
        WHEN part_area <  50000 THEN 'block'
        WHEN part_area < 200000 THEN 'district'
        WHEN part_area < 500000 THEN 'quarter'
        ELSE 'domain'
      END
    );
    v_taken := v_taken + part_area;
  END LOOP;

  IF v_taken = 0 THEN
    RETURN 0; -- nothing usable moved: leave the rival untouched
  END IF;

  IF remain_geom IS NULL OR ST_IsEmpty(remain_geom) THEN
    DELETE FROM public.territory_polygons WHERE id = p_rival_id;
    RETURN v_taken;
  END IF;

  is_first := true;
  FOR part IN
    SELECT d.geom FROM ST_Dump(ST_CollectionExtract(remain_geom, 3)) d
    ORDER BY ST_Area(d.geom::geography) DESC
  LOOP
    part_area := ST_Area(part::geography);
    CONTINUE WHEN part_area < 100;
    part_coords := (ST_AsGeoJSON(part)::jsonb -> 'coordinates' -> 0);
    CONTINUE WHEN part_coords IS NULL OR jsonb_array_length(part_coords) < 4;

    IF is_first THEN
      UPDATE public.territory_polygons SET
        polygon_coords = part_coords,
        area_m2        = part_area,
        freshness      = GREATEST(0, freshness - 20),
        tier           = CASE
                           WHEN part_area <   5000 THEN 'patch'
                           WHEN part_area <  50000 THEN 'block'
                           WHEN part_area < 200000 THEN 'district'
                           WHEN part_area < 500000 THEN 'quarter'
                           ELSE 'domain'
                         END
      WHERE id = p_rival_id;
      is_first := false;
    ELSE
      INSERT INTO public.territory_polygons (
        id, run_id, owner_id, polygon_coords, area_m2,
        freshness, last_defended_at, claimed_at, is_loop_fill, tier
      )
      SELECT gen_random_uuid(), tp.run_id, tp.owner_id, part_coords, part_area,
             GREATEST(0, tp.freshness - 20), tp.last_defended_at, tp.claimed_at, tp.is_loop_fill,
             CASE
               WHEN part_area <   5000 THEN 'patch'
               WHEN part_area <  50000 THEN 'block'
               WHEN part_area < 200000 THEN 'district'
               WHEN part_area < 500000 THEN 'quarter'
               ELSE 'domain'
             END
      FROM public.territory_polygons tp WHERE tp.id = p_rival_id;
    END IF;
  END LOOP;

  IF is_first THEN
    DELETE FROM public.territory_polygons WHERE id = p_rival_id;
  END IF;

  RETURN v_taken;
END;
$$;

GRANT EXECUTE ON FUNCTION public.steal_territory_portion(uuid, text, uuid, uuid) TO service_role;

-- ── 9. Decay floors (matches the app's decayedFreshness) ──────────────────────

CREATE OR REPLACE FUNCTION public.find_intersecting_territories(
  p_wkt      text,
  p_owner_id uuid
)
RETURNS TABLE(
  id                uuid,
  owner_id          uuid,
  freshness         smallint,
  area_m2           float8,
  intersection_area float8
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    tp.id,
    tp.owner_id,
    GREATEST(0, floor(tp.freshness - EXTRACT(EPOCH FROM (now() - tp.last_defended_at)) / 86400 * 10))::smallint,
    tp.area_m2,
    ST_Area(ST_Intersection(tp.geom, ST_GeomFromText(p_wkt, 4326))::geography)
  FROM public.territory_polygons tp
  WHERE tp.owner_id <> p_owner_id
    AND tp.geom IS NOT NULL
    AND ST_Intersects(tp.geom, ST_GeomFromText(p_wkt, 4326));
$$;

CREATE OR REPLACE FUNCTION public.get_territory_score(p_user_id uuid)
RETURNS float8
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(SUM(
    area_m2 * (0.5 + LEAST(100, GREATEST(0,
      floor(freshness - EXTRACT(EPOCH FROM (now() - last_defended_at)) / 86400 * 10)
    )) / 100.0 * 0.5)
  ), 0)
  FROM public.territory_polygons
  WHERE owner_id = p_user_id;
$$;

-- ── 10. Leaderboard scores fade daily ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.refresh_all_territory_scores()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  PERFORM set_config('runivo.trusted_writer', 'on', true);
  UPDATE public.profiles p
  SET territory_score = public.get_territory_score(p.id)
  WHERE EXISTS (SELECT 1 FROM public.territory_polygons t WHERE t.owner_id = p.id)
     OR p.territory_score <> 0;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM set_config('runivo.trusted_writer', 'off', true);
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_all_territory_scores() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_all_territory_scores() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('refresh-territory-scores')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-territory-scores');
    PERFORM cron.schedule('refresh-territory-scores', '5 0 * * *', 'SELECT public.refresh_all_territory_scores()');
  END IF;
END $$;

-- ── 11. Redemption honours expiry and stock ───────────────────────────────────

ALTER TABLE public.pace_store_rewards ADD COLUMN IF NOT EXISTS stock int CHECK (stock IS NULL OR stock >= 0);

CREATE OR REPLACE FUNCTION public.redeem_reward(
  p_user_id   uuid,
  p_reward_id uuid
)
RETURNS TABLE(success boolean, message text, new_balance int, redemption_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward  record;
  v_balance int;
  v_new_id  uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'redeem_reward is service_role only';
  END IF;

  SELECT * INTO v_reward FROM public.pace_store_rewards WHERE id = p_reward_id FOR UPDATE;
  IF v_reward IS NULL THEN
    RETURN QUERY SELECT false, 'Reward not found', NULL::int, NULL::uuid; RETURN;
  END IF;
  IF v_reward.status <> 'available'
     OR (v_reward.expires_at IS NOT NULL AND v_reward.expires_at <= now()) THEN
    RETURN QUERY SELECT false, 'This reward is not currently available', NULL::int, NULL::uuid; RETURN;
  END IF;
  IF v_reward.stock IS NOT NULL AND v_reward.stock <= 0 THEN
    RETURN QUERY SELECT false, 'This reward has run out', NULL::int, NULL::uuid; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.pace_redemptions WHERE user_id = p_user_id AND reward_id = p_reward_id) THEN
    RETURN QUERY SELECT false, 'You''ve already redeemed this reward', NULL::int, NULL::uuid; RETURN;
  END IF;

  SELECT pace_balance INTO v_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF v_balance IS NULL THEN
    RETURN QUERY SELECT false, 'Profile not found', NULL::int, NULL::uuid; RETURN;
  END IF;
  IF v_balance < v_reward.pace_cost THEN
    RETURN QUERY SELECT false, 'Not enough PACE', v_balance, NULL::uuid; RETURN;
  END IF;

  UPDATE public.profiles SET pace_balance = pace_balance - v_reward.pace_cost WHERE id = p_user_id;
  IF v_reward.stock IS NOT NULL THEN
    UPDATE public.pace_store_rewards SET stock = stock - 1 WHERE id = p_reward_id;
  END IF;

  INSERT INTO public.pace_redemptions (user_id, reward_id, pace_spent)
  VALUES (p_user_id, p_reward_id, v_reward.pace_cost)
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT true, 'Redeemed', v_balance - v_reward.pace_cost, v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid) TO service_role;

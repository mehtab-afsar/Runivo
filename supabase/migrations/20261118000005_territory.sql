-- ========================================================================
-- Territory
-- ========================================================================
-- Zones, claims, contests, decay, zone history and leaderboards.
--
-- One file per feature: this file creates everything this feature owns
-- (tables, functions, triggers, row-level security, grants, scheduled jobs).
-- It needs only the files before it. Built from the 178 migrations up to
-- 20261117000012 (the 178 old files were removed after commit 9e5cf19; see git history); a fresh
-- database built from these files matches one built from those exactly.
--
-- Tables: city_runner_counts, leaderboard_weekly, run_territories, run_territory_contests, territory_polygons, zone_events

SET check_function_bodies = false;
SET client_min_messages = warning;
SET search_path = public, extensions;


-- ── Tables ────────────────────────────────────────────────────────────

CREATE TABLE public.city_runner_counts (
    city text NOT NULL,
    runners integer NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.run_territories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    owner_name text,
    run_id uuid,
    polygon jsonb NOT NULL,
    area_m2 double precision DEFAULT 0 NOT NULL,
    defense integer DEFAULT 30 NOT NULL,
    tier text DEFAULT 'common'::text NOT NULL,
    claimed_at timestamp with time zone DEFAULT now(),
    last_fortified_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.run_territory_contests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rival_owner_id uuid NOT NULL,
    overlap_pct numeric NOT NULL,
    qualified boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.territory_polygons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid,
    owner_id uuid,
    geom public.geometry(Polygon,4326) NOT NULL,
    geom_simplified public.geometry(Polygon,4326),
    area_m2 double precision NOT NULL,
    freshness smallint DEFAULT 100 NOT NULL,
    last_defended_at timestamp with time zone DEFAULT now() NOT NULL,
    claimed_at timestamp with time zone DEFAULT now() NOT NULL,
    is_loop_fill boolean DEFAULT false NOT NULL,
    tier text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_name text,
    polygon_coords jsonb DEFAULT '[]'::jsonb NOT NULL,
    near_private_place boolean DEFAULT false NOT NULL,
    CONSTRAINT territory_polygons_freshness_check CHECK (((freshness >= 0) AND (freshness <= 100))),
    CONSTRAINT territory_polygons_tier_check CHECK ((tier = ANY (ARRAY['patch'::text, 'block'::text, 'district'::text, 'quarter'::text, 'domain'::text])))
);

CREATE TABLE public.zone_events (
    id bigint NOT NULL,
    zone_id uuid,
    kind text NOT NULL,
    user_id uuid NOT NULL,
    prev_owner_id uuid,
    at timestamp with time zone DEFAULT now() NOT NULL,
    geom public.geometry(Geometry,4326) NOT NULL,
    CONSTRAINT zone_events_kind_check CHECK ((kind = ANY (ARRAY['claimed'::text, 'stolen'::text, 'defended'::text])))
);


-- ── Defaults ──────────────────────────────────────────────────────────

ALTER TABLE public.zone_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.zone_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- ── Keys and checks ───────────────────────────────────────────────────

ALTER TABLE ONLY public.city_runner_counts
    ADD CONSTRAINT city_runner_counts_pkey PRIMARY KEY (city);

ALTER TABLE ONLY public.run_territories
    ADD CONSTRAINT run_territories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.run_territory_contests
    ADD CONSTRAINT run_territory_contests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.territory_polygons
    ADD CONSTRAINT territory_polygons_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.zone_events
    ADD CONSTRAINT zone_events_pkey PRIMARY KEY (id);


-- ── Functions ─────────────────────────────────────────────────────────

CREATE FUNCTION public.build_territory_geom(p_line_wkt text, p_ring_wkt text, p_half_width_m double precision DEFAULT 12) RETURNS TABLE(wkt text, area_m2 double precision, is_loop boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.city_runner_count(p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision) RETURNS TABLE(city text, runners integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
#variable_conflict use_column
DECLARE
  v_city   text;
  v_center geometry;
  v_radius double precision;
  v_n      integer;
  v_cached public.city_runner_counts%ROWTYPE;
BEGIN
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL
     AND p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180 THEN
    v_city := public.city_for_point(ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326));
  END IF;
  -- No location (or not in a launch city): show the busiest launch city.
  IF v_city IS NULL THEN
    SELECT c.city INTO v_city FROM public.city_runner_counts c ORDER BY c.runners DESC LIMIT 1;
    IF v_city IS NULL THEN
      SELECT s.name INTO v_city FROM public.store_cities s ORDER BY s.name LIMIT 1;
    END IF;
  END IF;
  IF v_city IS NULL THEN RETURN; END IF;

  SELECT * INTO v_cached FROM public.city_runner_counts c WHERE c.city = v_city;
  IF FOUND AND v_cached.computed_at > now() - interval '30 minutes' THEN
    v_n := v_cached.runners;
  ELSE
    SELECT s.center, s.radius_km INTO v_center, v_radius FROM public.store_cities s WHERE s.name = v_city;
    IF v_center IS NULL THEN RETURN; END IF;
    SELECT count(DISTINCT r.user_id)::int INTO v_n
      FROM public.runs r
     WHERE r.started_at > now() - interval '7 days'
       AND r.route IS NOT NULL
       AND NOT COALESCE(r.excluded, false)
       AND r.integrity_status IN ('ok', 'cleared')
       AND ST_DWithin(ST_StartPoint(r.route)::geography, v_center::geography, v_radius * 1000);
    INSERT INTO public.city_runner_counts AS t (city, runners, computed_at) VALUES (v_city, v_n, now())
      ON CONFLICT ON CONSTRAINT city_runner_counts_pkey DO UPDATE SET runners = EXCLUDED.runners, computed_at = EXCLUDED.computed_at;
  END IF;

  IF v_n < 50 THEN RETURN; END IF;
  city := v_city;
  runners := (v_n / 10) * 10;
  RETURN NEXT;
END;
$$;

CREATE FUNCTION public.claim_unclaimed_area(p_wkt text, p_owner_id uuid, p_run_id uuid, p_is_loop boolean DEFAULT false) RETURNS TABLE(pieces integer, area_m2 double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.count_defendable_stale_zones(p_wkt text, p_owner_id uuid, p_stale_at smallint) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT COUNT(*)::INT FROM territory_polygons
  WHERE owner_id = p_owner_id
    AND geom IS NOT NULL
    AND freshness < p_stale_at
    AND ST_Intersects(geom, ST_GeomFromText(p_wkt, 4326));
$$;

CREATE FUNCTION public.defend_own_territories(p_wkt text, p_owner_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    AS $$
  UPDATE territory_polygons
  SET freshness        = LEAST(100, freshness + 10),
      last_defended_at = now()
  WHERE owner_id = p_owner_id
    AND geom IS NOT NULL
    AND ST_Intersects(geom, ST_GeomFromText(p_wkt, 4326));
$$;

CREATE FUNCTION public.find_intersecting_territories(p_wkt text, p_owner_id uuid) RETURNS TABLE(id uuid, owner_id uuid, freshness smallint, area_m2 double precision, intersection_area double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

CREATE FUNCTION public.get_circle_leaderboard(p_metric text, p_period text, p_circle text, p_limit integer DEFAULT 100) RETURNS TABLE(user_id uuid, username text, runner_rank text, country text, value numeric, rank integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  PERFORM public.leaderboard_check_args(p_metric, p_period);
  IF p_circle NOT IN ('following', 'clubs') THEN
    RAISE EXCEPTION 'circle must be following or clubs' USING ERRCODE = '22023';
  END IF;
  IF v_uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT v.user_id, pr.username, COALESCE(pr.runner_rank, 'pacer'), pr.country,
         round(v.value, 1),
         (rank() OVER (ORDER BY v.value DESC))::integer
    FROM public.leaderboard_values(p_metric, p_period) v
    JOIN public.profiles pr ON pr.id = v.user_id
   WHERE v.user_id IN (SELECT public.leaderboard_circle(v_uid, p_circle))
   ORDER BY v.value DESC, pr.username
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);
END;
$$;

CREATE FUNCTION public.get_city_rank(p_user_id uuid, p_lat double precision, p_lng double precision, p_radius_km double precision DEFAULT 10) RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_radius_km double precision := LEAST(GREATEST(COALESCE(p_radius_km, 10), 5), 50);
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT COUNT(*)::integer + 1
    FROM (
      SELECT t.owner_id, SUM(t.area_m2) AS total_area
      FROM territory_polygons t
      JOIN profiles p ON p.id = t.owner_id
      WHERE t.owner_id <> p_user_id
        AND p.last_known_location IS NOT NULL
        AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
              p.last_known_location::geography,
              v_radius_km * 1000
            )
      GROUP BY t.owner_id
    ) rivals
    WHERE rivals.total_area > (
      SELECT COALESCE(SUM(area_m2), 0) FROM territory_polygons WHERE owner_id = p_user_id
    )
  );
END;
$$;

CREATE FUNCTION public.get_leaderboard(p_metric text, p_period text, p_country text DEFAULT NULL::text, p_limit integer DEFAULT 100) RETURNS TABLE(user_id uuid, username text, runner_rank text, country text, value numeric, rank integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.leaderboard_check_args(p_metric, p_period);
  RETURN QUERY
  SELECT v.user_id, pr.username, COALESCE(pr.runner_rank, 'pacer'), pr.country,
         round(v.value, 1),
         (rank() OVER (ORDER BY v.value DESC))::integer
    FROM public.leaderboard_values(p_metric, p_period) v
    JOIN public.profiles pr ON pr.id = v.user_id
   WHERE p_country IS NULL OR pr.country = p_country
   ORDER BY v.value DESC, pr.username
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);
END;
$$;

CREATE FUNCTION public.get_local_leaderboard(p_metric text, p_period text, p_radius_km double precision DEFAULT 10, p_limit integer DEFAULT 100) RETURNS TABLE(user_id uuid, username text, runner_rank text, value numeric, rank integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_at  geometry;
BEGIN
  PERFORM public.leaderboard_check_args(p_metric, p_period);
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT last_known_location INTO v_at FROM public.profiles WHERE id = v_uid;
  IF v_at IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT v.user_id, pr.username, COALESCE(pr.runner_rank, 'pacer'), round(v.value, 1),
         (rank() OVER (ORDER BY v.value DESC))::integer
    FROM public.leaderboard_values(p_metric, p_period) v
    JOIN public.profiles pr ON pr.id = v.user_id
   WHERE pr.last_known_location IS NOT NULL
     AND ST_DWithin(pr.last_known_location::geography, v_at::geography, LEAST(GREATEST(COALESCE(p_radius_km, 10), 0.5), 50) * 1000)
     AND (v.user_id = v_uid OR v.user_id NOT IN (SELECT public.hidden_user_ids(v_uid)))
   ORDER BY v.value DESC, pr.username
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);
END;
$$;

CREATE FUNCTION public.get_my_leaderboard_rank(p_metric text, p_period text, p_country text DEFAULT NULL::text) RETURNS TABLE(value numeric, rank integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_val numeric;
BEGIN
  PERFORM public.leaderboard_check_args(p_metric, p_period);
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT v.value INTO v_val FROM public.leaderboard_values(p_metric, p_period) v WHERE v.user_id = v_uid;
  IF v_val IS NULL THEN
    RETURN QUERY SELECT 0::numeric, NULL::integer;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT round(v_val, 1),
         (1 + COUNT(*))::integer
    FROM public.leaderboard_values(p_metric, p_period) v
    JOIN public.profiles pr ON pr.id = v.user_id
   WHERE v.value > v_val
     AND (p_country IS NULL OR pr.country = p_country);
END;
$$;

CREATE FUNCTION public.get_own_distance_rank(p_user_id uuid, p_cutoff timestamp with time zone) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT (COUNT(*) + 1)::int
  FROM (
    SELECT user_id, SUM(verified_distance_m) AS total
    FROM public.runs
    WHERE started_at >= p_cutoff AND COALESCE(activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike', 'wheelchair', 'stroller']) AND NOT excluded AND integrity_status IN ('ok', 'cleared')
    GROUP BY user_id
  ) totals
  WHERE totals.total > COALESCE((
    SELECT SUM(verified_distance_m) FROM public.runs
    WHERE user_id = p_user_id AND started_at >= p_cutoff AND COALESCE(activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike', 'wheelchair', 'stroller']) AND NOT excluded AND integrity_status IN ('ok', 'cleared')
  ), 0);
$$;

CREATE FUNCTION public.get_territory_score(p_user_id uuid) RETURNS double precision
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(SUM(
    area_m2 * (0.5 + LEAST(100, GREATEST(0,
      floor(freshness - EXTRACT(EPOCH FROM (now() - last_defended_at)) / 86400 * 10)
    )) / 100.0 * 0.5)
  ), 0)
  FROM public.territory_polygons
  WHERE owner_id = p_user_id;
$$;

CREATE FUNCTION public.get_zone_history(p_zone uuid) RETURNS TABLE(kind text, user_id uuid, username text, prev_username text, at timestamp with time zone, is_legend boolean, legend_defences integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH z AS (
    SELECT geom, owner_id, near_private_place FROM territory_polygons WHERE id = p_zone
  ), visible AS (
    SELECT * FROM z WHERE zone_visible_to(auth.uid(), z.owner_id, z.near_private_place)
  ), ev AS (
    SELECT e.* FROM zone_events e, visible v
     WHERE e.geom && v.geom AND ST_Intersects(e.geom, v.geom)
       AND e.user_id NOT IN (SELECT hidden_user_ids(auth.uid()))
       AND (e.user_id = auth.uid() OR NOT EXISTS (
             SELECT 1 FROM privacy_places pp
              WHERE pp.user_id = e.user_id AND ST_DWithin(pp.center, e.geom::geography, pp.radius_m)))
  ), legend AS (
    SELECT user_id, count(*)::int AS n FROM ev
     WHERE kind = 'defended' AND at > now() - interval '90 days'
     GROUP BY user_id ORDER BY count(*) DESC, max(at) DESC LIMIT 1
  )
  SELECT ev.kind, ev.user_id, p.username, pp.username, ev.at,
         ev.user_id = (SELECT user_id FROM legend), COALESCE((SELECT n FROM legend), 0)
    FROM ev
    JOIN profiles p ON p.id = ev.user_id
    LEFT JOIN profiles pp ON pp.id = ev.prev_owner_id
   ORDER BY ev.at DESC
   LIMIT 20;
$$;

CREATE FUNCTION public.largest_polygon(geom public.geometry) RETURNS public.geometry
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  SELECT g FROM (
    SELECT (ST_Dump(geom)).geom AS g
  ) sub
  ORDER BY ST_Area(g) DESC
  LIMIT 1;
$$;

CREATE FUNCTION public.leaderboard_check_args(p_metric text, p_period text) RETURNS void
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  IF p_metric NOT IN ('distance', 'pace', 'territory') THEN
    RAISE EXCEPTION 'metric must be distance, pace or territory' USING ERRCODE = '22023';
  END IF;
  IF p_period NOT IN ('week', 'month', 'all') THEN
    RAISE EXCEPTION 'period must be week, month or all' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE FUNCTION public.leaderboard_circle(p_viewer uuid, p_circle text) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p_viewer
  UNION
  SELECT f.following_id FROM public.followers f
   WHERE p_circle = 'following' AND f.follower_id = p_viewer
  UNION
  SELECT m2.user_id FROM public.club_members m1
    JOIN public.club_members m2 ON m2.club_id = m1.club_id
   WHERE p_circle = 'clubs' AND m1.user_id = p_viewer
  EXCEPT
  SELECT public.hidden_user_ids(p_viewer);
$$;

CREATE FUNCTION public.leaderboard_period_start(p_period text) RETURNS timestamp with time zone
    LANGUAGE sql STABLE
    AS $$
  SELECT CASE p_period
    WHEN 'week'  THEN date_trunc('week',  now() AT TIME ZONE 'utc') AT TIME ZONE 'utc'
    WHEN 'month' THEN date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc'
    ELSE '-infinity'::timestamptz
  END;
$$;

CREATE FUNCTION public.leaderboard_values(p_metric text, p_period text) RETURNS TABLE(user_id uuid, value numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT v.user_id, v.value
    FROM public.leaderboard_values_all(p_metric, p_period) v
   WHERE v.user_id = auth.uid()
      OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v.user_id AND p.hide_from_leaderboards);
$$;

CREATE FUNCTION public.leaderboard_values_all(p_metric text, p_period text) RETURNS TABLE(user_id uuid, value numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH b AS (SELECT public.leaderboard_period_start(p_period) AS since)
  SELECT r.user_id, SUM(r.verified_distance_m) / 1000.0
    FROM public.runs r, b
   WHERE p_metric = 'distance'
     AND r.started_at >= b.since
     AND COALESCE(r.activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike', 'wheelchair', 'stroller'])
     AND NOT r.excluded
     AND r.integrity_status IN ('ok', 'cleared')
   GROUP BY r.user_id
  HAVING SUM(r.verified_distance_m) > 0
  UNION ALL
  SELECT a.user_id, SUM(a.credited)::numeric
    FROM public.pace_awards a, b
   WHERE p_metric = 'pace' AND p_period <> 'all' AND a.created_at >= b.since
   GROUP BY a.user_id
  HAVING SUM(a.credited) > 0
  UNION ALL
  SELECT p.id, p.pace_total_earned::numeric
    FROM public.profiles p
   WHERE p_metric = 'pace' AND p_period = 'all' AND COALESCE(p.pace_total_earned, 0) > 0
  UNION ALL
  SELECT t.owner_id, SUM(t.area_m2)::numeric
    FROM public.territory_polygons t, b
   WHERE p_metric = 'territory' AND p_period <> 'all' AND t.claimed_at >= b.since
   GROUP BY t.owner_id
  HAVING SUM(t.area_m2) > 0
  UNION ALL
  SELECT p.id, p.territory_score::numeric
    FROM public.profiles p
   WHERE p_metric = 'territory' AND p_period = 'all' AND COALESCE(p.territory_score, 0) > 0;
$$;

CREATE FUNCTION public.legend_zone_count(p_user uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT count(*)::int FROM territory_polygons t
   WHERE (
     SELECT e.user_id FROM zone_events e
      WHERE e.kind = 'defended' AND e.at > now() - interval '90 days'
        AND e.geom && t.geom AND ST_Intersects(e.geom, t.geom)
      GROUP BY e.user_id ORDER BY count(*) DESC, max(e.at) DESC LIMIT 1
   ) = p_user;
$$;

CREATE FUNCTION public.log_zone_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_prev uuid;
BEGIN
  IF NEW.geom IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    -- A steal inserts the thief's piece while the rival's zone is still there.
    SELECT t.owner_id INTO v_prev
      FROM territory_polygons t
     WHERE t.id <> NEW.id AND t.owner_id <> NEW.owner_id
       AND t.geom && NEW.geom AND ST_Intersects(t.geom, ST_PointOnSurface(NEW.geom))
     LIMIT 1;
    INSERT INTO zone_events (zone_id, kind, user_id, prev_owner_id, at, geom)
    VALUES (NEW.id, CASE WHEN v_prev IS NULL THEN 'claimed' ELSE 'stolen' END, NEW.owner_id, v_prev,
            COALESCE(NEW.claimed_at, now()), ST_PointOnSurface(NEW.geom));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      INSERT INTO zone_events (zone_id, kind, user_id, prev_owner_id, geom)
      VALUES (NEW.id, 'stolen', NEW.owner_id, OLD.owner_id, ST_PointOnSurface(NEW.geom));
    ELSIF NEW.last_defended_at IS DISTINCT FROM OLD.last_defended_at AND NEW.last_defended_at > COALESCE(OLD.last_defended_at, '-infinity') THEN
      INSERT INTO zone_events (zone_id, kind, user_id, at, geom)
      VALUES (NEW.id, 'defended', NEW.owner_id, NEW.last_defended_at, ST_PointOnSurface(NEW.geom));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.notify_friend_zone_nearby() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  r record;
  v_name text;
BEGIN
  IF NEW.geom IS NULL THEN RETURN NEW; END IF;
  SELECT username INTO v_name FROM profiles WHERE id = NEW.owner_id;
  FOR r IN
    SELECT DISTINCT f.follower_id AS uid
      FROM followers f
      JOIN profiles fp ON fp.id = f.follower_id AND fp.friend_zone_alerts
     WHERE f.following_id = NEW.owner_id
       AND NOT is_blocked_between(f.follower_id, NEW.owner_id)
       AND EXISTS (SELECT 1 FROM territory_polygons t
                    WHERE t.owner_id = f.follower_id
                      AND ST_DWithin(t.geom::geography, NEW.geom::geography, 300))
  LOOP
    PERFORM queue_notification(
      r.uid, 'territory_claimed',
      v_name || ' just claimed a zone next to yours',
      'Go and see what they took, or claim the ground around it first.',
      '/map', 'friend_zone:' || NEW.owner_id || ':' || to_char(now(), 'YYYY-MM-DD'), false);
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.refresh_all_territory_scores() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.refresh_private_zones(p_user uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE public.territory_polygons t
     SET near_private_place = public.zone_near_private_place(p_user, t.geom)
   WHERE t.owner_id = p_user;
$$;

CREATE FUNCTION public.steal_territory_portion(p_rival_id uuid, p_new_wkt text, p_new_owner uuid, p_run_id uuid) RETURNS double precision
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.sync_territory_score(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  UPDATE profiles SET territory_score = get_territory_score(p_user_id) WHERE id = p_user_id;
END;
$$;

CREATE FUNCTION public.territory_polygons_sync_score() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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

CREATE FUNCTION public.tp_derive_geom() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF jsonb_array_length(NEW.polygon_coords) < 4 THEN
    RAISE EXCEPTION 'territory_polygons: polygon_coords must have >= 4 points';
  END IF;

  NEW.geom = ST_SetSRID(
    ST_GeomFromGeoJSON(
      json_build_object(
        'type',        'Polygon',
        'coordinates', json_build_array(NEW.polygon_coords)
      )::text
    ),
    4326
  );
  NEW.geom_simplified = ST_SimplifyPreserveTopology(NEW.geom, 0.0001);
  RETURN NEW;
END;
$$;


-- ── Views ─────────────────────────────────────────────────────────────

CREATE VIEW public.leaderboard_weekly AS
 SELECT p.id,
    p.username,
    p.avatar_url,
    p.runner_rank,
    p.territory_score,
    p.pace_weekly_earned AS weekly_pace,
    (COALESCE((sum(r.verified_distance_m) / 1000.0), (0)::numeric))::numeric(10,3) AS weekly_km,
    (COALESCE(sum(cardinality(r.territories_claimed)), (0)::bigint))::integer AS weekly_territories,
    (dense_rank() OVER (ORDER BY p.territory_score DESC))::integer AS rank,
    p.country
   FROM (public.profiles p
     LEFT JOIN public.runs r ON (((r.user_id = p.id) AND (r.started_at >= date_trunc('week'::text, (now() AT TIME ZONE 'utc'::text))) AND (COALESCE(r.activity_type, 'run'::text) = ANY (ARRAY['run'::text, 'trail_run'::text, 'trail'::text, 'walk'::text, 'hike'::text, 'wheelchair'::text, 'stroller'::text])) AND (NOT r.excluded) AND (r.integrity_status = ANY (ARRAY['ok'::text, 'cleared'::text])))))
  GROUP BY p.id, p.username, p.avatar_url, p.runner_rank, p.territory_score, p.pace_weekly_earned, p.country;


-- ── Foreign keys ──────────────────────────────────────────────────────

ALTER TABLE ONLY public.run_territories
    ADD CONSTRAINT run_territories_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.run_territories
    ADD CONSTRAINT run_territories_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.run_territory_contests
    ADD CONSTRAINT run_territory_contests_rival_owner_id_fkey FOREIGN KEY (rival_owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.run_territory_contests
    ADD CONSTRAINT run_territory_contests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.territory_polygons
    ADD CONSTRAINT territory_polygons_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.territory_polygons
    ADD CONSTRAINT territory_polygons_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.zone_events
    ADD CONSTRAINT zone_events_prev_owner_id_fkey FOREIGN KEY (prev_owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.zone_events
    ADD CONSTRAINT zone_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- ── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX run_territories_owner_id_idx ON public.run_territories USING btree (owner_id);

CREATE INDEX run_territories_run_id_idx ON public.run_territories USING btree (run_id);

CREATE INDEX run_territory_contests_user_id_idx ON public.run_territory_contests USING btree (user_id);

CREATE INDEX territory_polygons_claimed_owner_idx ON public.territory_polygons USING btree (claimed_at, owner_id);

CREATE INDEX territory_polygons_geom_idx ON public.territory_polygons USING gist (geom);

CREATE INDEX territory_polygons_last_defended_at_idx ON public.territory_polygons USING btree (last_defended_at);

CREATE INDEX territory_polygons_owner_id_idx ON public.territory_polygons USING btree (owner_id);

CREATE INDEX zone_events_at_idx ON public.zone_events USING btree (at DESC);

CREATE INDEX zone_events_geom_idx ON public.zone_events USING gist (geom);


-- ── Triggers ──────────────────────────────────────────────────────────

CREATE TRIGGER territory_polygons_score_sync AFTER INSERT OR DELETE OR UPDATE ON public.territory_polygons FOR EACH ROW EXECUTE FUNCTION public.territory_polygons_sync_score();

CREATE TRIGGER tp_geom_trigger BEFORE INSERT OR UPDATE OF polygon_coords ON public.territory_polygons FOR EACH ROW EXECUTE FUNCTION public.tp_derive_geom();

CREATE TRIGGER trg_log_zone_event AFTER INSERT OR UPDATE OF owner_id, last_defended_at ON public.territory_polygons FOR EACH ROW EXECUTE FUNCTION public.log_zone_event();

CREATE TRIGGER trg_mark_private_zone BEFORE INSERT OR UPDATE OF geom, owner_id ON public.territory_polygons FOR EACH ROW EXECUTE FUNCTION public.mark_private_zone();

CREATE TRIGGER trg_notify_friend_zone AFTER INSERT ON public.territory_polygons FOR EACH ROW EXECUTE FUNCTION public.notify_friend_zone_nearby();


-- ── Row-level security ────────────────────────────────────────────────

ALTER TABLE public.city_runner_counts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.run_territories ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.run_territory_contests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.territory_polygons ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.zone_events ENABLE ROW LEVEL SECURITY;


-- ── Policies ──────────────────────────────────────────────────────────

CREATE POLICY "run_territories: anyone can read" ON public.run_territories FOR SELECT USING (true);

CREATE POLICY "run_territories: owner can insert" ON public.run_territories FOR INSERT WITH CHECK ((auth.uid() = owner_id));

CREATE POLICY "run_territories: owner can update" ON public.run_territories FOR UPDATE USING ((auth.uid() = owner_id));

CREATE POLICY tp_read ON public.territory_polygons FOR SELECT TO authenticated USING (public.zone_visible_to(auth.uid(), owner_id, near_private_place));

CREATE POLICY "users can read their own contest log" ON public.run_territory_contests FOR SELECT USING ((auth.uid() = user_id));


-- ── Comments ──────────────────────────────────────────────────────────

COMMENT ON VIEW public.leaderboard_weekly IS 'Weekly leaderboard — sorted by territory_score. Recalculated on every query.';


-- ── Grants ────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.build_territory_geom(p_line_wkt text, p_ring_wkt text, p_half_width_m double precision) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.build_territory_geom(p_line_wkt text, p_ring_wkt text, p_half_width_m double precision) TO service_role;

REVOKE ALL ON FUNCTION public.city_runner_count(p_lat double precision, p_lng double precision) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.city_runner_count(p_lat double precision, p_lng double precision) TO anon;
GRANT ALL ON FUNCTION public.city_runner_count(p_lat double precision, p_lng double precision) TO authenticated;
GRANT ALL ON FUNCTION public.city_runner_count(p_lat double precision, p_lng double precision) TO service_role;

REVOKE ALL ON FUNCTION public.claim_unclaimed_area(p_wkt text, p_owner_id uuid, p_run_id uuid, p_is_loop boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.claim_unclaimed_area(p_wkt text, p_owner_id uuid, p_run_id uuid, p_is_loop boolean) TO service_role;

REVOKE ALL ON FUNCTION public.count_defendable_stale_zones(p_wkt text, p_owner_id uuid, p_stale_at smallint) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.count_defendable_stale_zones(p_wkt text, p_owner_id uuid, p_stale_at smallint) TO service_role;

REVOKE ALL ON FUNCTION public.defend_own_territories(p_wkt text, p_owner_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.defend_own_territories(p_wkt text, p_owner_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.find_intersecting_territories(p_wkt text, p_owner_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.find_intersecting_territories(p_wkt text, p_owner_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_city_rank(p_user_id uuid, p_lat double precision, p_lng double precision, p_radius_km double precision) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.get_city_rank(p_user_id uuid, p_lat double precision, p_lng double precision, p_radius_km double precision) TO authenticated;
GRANT ALL ON FUNCTION public.get_city_rank(p_user_id uuid, p_lat double precision, p_lng double precision, p_radius_km double precision) TO service_role;

REVOKE ALL ON FUNCTION public.get_own_distance_rank(p_user_id uuid, p_cutoff timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.get_own_distance_rank(p_user_id uuid, p_cutoff timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.get_zone_history(p_zone uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.get_zone_history(p_zone uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_zone_history(p_zone uuid) TO service_role;

REVOKE ALL ON FUNCTION public.largest_polygon(geom public.geometry) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.largest_polygon(geom public.geometry) TO service_role;

REVOKE ALL ON FUNCTION public.leaderboard_circle(p_viewer uuid, p_circle text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.leaderboard_circle(p_viewer uuid, p_circle text) TO anon;
GRANT ALL ON FUNCTION public.leaderboard_circle(p_viewer uuid, p_circle text) TO service_role;

REVOKE ALL ON FUNCTION public.leaderboard_values(p_metric text, p_period text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.leaderboard_values(p_metric text, p_period text) TO service_role;

REVOKE ALL ON FUNCTION public.leaderboard_values_all(p_metric text, p_period text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.leaderboard_values_all(p_metric text, p_period text) TO service_role;

REVOKE ALL ON FUNCTION public.legend_zone_count(p_user uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.legend_zone_count(p_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.legend_zone_count(p_user uuid) TO service_role;

REVOKE ALL ON FUNCTION public.refresh_all_territory_scores() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.refresh_all_territory_scores() TO service_role;

REVOKE ALL ON FUNCTION public.refresh_private_zones(p_user uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.refresh_private_zones(p_user uuid) TO service_role;

REVOKE ALL ON FUNCTION public.steal_territory_portion(p_rival_id uuid, p_new_wkt text, p_new_owner uuid, p_run_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.steal_territory_portion(p_rival_id uuid, p_new_wkt text, p_new_owner uuid, p_run_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.sync_territory_score(p_user_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.sync_territory_score(p_user_id uuid) TO service_role;

REVOKE ALL ON TABLE public.city_runner_counts FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.city_runner_counts TO service_role;


-- ── Realtime ───────────────────────────────────────────────────────────

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.territory_polygons; EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END;
END $$;


-- ── Scheduled jobs (pg_cron) ────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('refresh-territory-scores', '5 0 * * *', $cmd$SELECT public.refresh_all_territory_scores()$cmd$);
  END IF;
END $$;

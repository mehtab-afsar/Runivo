-- ========================================================================
-- Runs
-- ========================================================================
-- Runs and their processing, photos, routes, shoes, records, live runs, cheers and safety shares.
--
-- One file per feature: this file creates everything this feature owns
-- (tables, functions, triggers, row-level security, grants, scheduled jobs).
-- It needs only the files before it. Built from the 178 migrations up to
-- 20261117000012 (the 178 old files were removed after commit 9e5cf19; see git history); a fresh
-- database built from these files matches one built from those exactly.
--
-- Tables: device_activities, live_run_positions, personal_records, run_cheers, run_photos, run_processing, runs, safety_shares, saved_routes, shoe_stats, shoes, weekly_consistency

SET check_function_bodies = false;
SET client_min_messages = warning;
SET search_path = public, extensions;


-- ── Tables ────────────────────────────────────────────────────────────

CREATE TABLE public.device_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_type text NOT NULL,
    external_id text NOT NULL,
    activity_type text,
    started_at timestamp with time zone,
    duration_sec integer,
    distance_m numeric,
    avg_hr integer,
    max_hr integer,
    avg_cadence integer,
    elevation_gain_m numeric,
    hrv_ms numeric,
    calories_kcal integer,
    raw_payload jsonb,
    run_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    activity_type text DEFAULT 'run'::text NOT NULL,
    started_at timestamp with time zone NOT NULL,
    finished_at timestamp with time zone NOT NULL,
    distance_m numeric(10,2) NOT NULL,
    duration_sec integer NOT NULL,
    avg_pace text NOT NULL,
    gps_points jsonb DEFAULT '[]'::jsonb NOT NULL,
    route public.geometry(LineString,4326),
    territories_claimed text[] DEFAULT '{}'::text[] NOT NULL,
    territories_fortified text[] DEFAULT '{}'::text[] NOT NULL,
    xp_earned integer DEFAULT 0 NOT NULL,
    coins_earned integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    calories_burned integer,
    enemy_captured integer DEFAULT 0 NOT NULL,
    pre_run_level integer DEFAULT 1 NOT NULL,
    stats_synced boolean DEFAULT false NOT NULL,
    shoe_id uuid,
    avg_hr integer,
    max_hr integer,
    avg_cadence integer,
    elevation_gain_m numeric,
    hrv_ms numeric,
    calories_kcal integer,
    import_source text,
    title text,
    description text,
    private_notes text,
    perceived_effort smallint,
    excluded boolean DEFAULT false NOT NULL,
    photo_paths text[] DEFAULT '{}'::text[] NOT NULL,
    integrity_status text DEFAULT 'ok'::text NOT NULL,
    integrity_reason text,
    integrity_appeal text,
    verified_distance_m numeric,
    CONSTRAINT runs_calories_burned_check CHECK ((calories_burned >= 0)),
    CONSTRAINT runs_edit_lengths_check CHECK ((((title IS NULL) OR (length(title) <= 80)) AND ((description IS NULL) OR (length(description) <= 2000)) AND ((private_notes IS NULL) OR (length(private_notes) <= 2000)) AND ((perceived_effort IS NULL) OR ((perceived_effort >= 1) AND (perceived_effort <= 10))))),
    CONSTRAINT runs_import_source_check CHECK ((import_source = ANY (ARRAY['apple_health'::text, 'garmin'::text, 'coros'::text, 'polar'::text]))),
    CONSTRAINT runs_integrity_appeal_check CHECK (((integrity_appeal IS NULL) OR (length(integrity_appeal) <= 500))),
    CONSTRAINT runs_integrity_status_check CHECK ((integrity_status = ANY (ARRAY['ok'::text, 'flagged'::text, 'appealed'::text, 'cleared'::text])))
);

CREATE TABLE public.live_run_positions (
    user_id uuid NOT NULL,
    run_id text NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    distance_m real,
    elapsed_sec integer,
    CONSTRAINT live_run_positions_distance_m_check CHECK (((distance_m IS NULL) OR ((distance_m >= (0)::double precision) AND (distance_m <= (500000)::double precision)))),
    CONSTRAINT live_run_positions_elapsed_sec_check CHECK (((elapsed_sec IS NULL) OR ((elapsed_sec >= 0) AND (elapsed_sec <= 172800))))
);

CREATE TABLE public.personal_records (
    user_id uuid NOT NULL,
    fastest_1k_sec integer,
    fastest_5k_sec integer,
    fastest_10k_sec integer,
    longest_run_m double precision,
    best_pace_sec integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.run_cheers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id text NOT NULL,
    to_user uuid NOT NULL,
    from_user uuid NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    thanked_at timestamp with time zone,
    CONSTRAINT run_cheers_message_check CHECK ((message = ANY (ARRAY['go'::text, 'pace'::text, 'home'::text, 'zone'::text, 'clap'::text])))
);

CREATE TABLE public.run_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    user_id uuid NOT NULL,
    storage_key text NOT NULL,
    width integer,
    height integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.run_processing (
    run_id uuid NOT NULL,
    user_id uuid NOT NULL,
    result jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.safety_shares (
    token text NOT NULL,
    user_id uuid NOT NULL,
    run_id text,
    sport text DEFAULT 'run'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '12:00:00'::interval) NOT NULL,
    ended_at timestamp with time zone,
    lat double precision,
    lng double precision,
    position_at timestamp with time zone,
    distance_m numeric,
    elapsed_sec integer
);

CREATE TABLE public.saved_routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    emoji text DEFAULT '🏃'::text NOT NULL,
    distance_m numeric(10,2) NOT NULL,
    duration_sec integer,
    gps_points jsonb DEFAULT '[]'::jsonb NOT NULL,
    route public.geometry(LineString,4326),
    is_public boolean DEFAULT true NOT NULL,
    source_run_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.shoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    brand text NOT NULL,
    model text NOT NULL,
    nickname text,
    category text DEFAULT 'road'::text NOT NULL,
    purchased_at date,
    max_km numeric DEFAULT 700 NOT NULL,
    is_retired boolean DEFAULT false NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    color text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.weekly_consistency (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    week_start date NOT NULL,
    plan_id uuid,
    sessions_planned integer DEFAULT 0 NOT NULL,
    sessions_completed integer DEFAULT 0 NOT NULL,
    sessions_missed integer DEFAULT 0 NOT NULL,
    km_actual double precision DEFAULT 0 NOT NULL,
    consistency_score integer DEFAULT 0 NOT NULL,
    streak_days_eow integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- ── Keys and checks ───────────────────────────────────────────────────

ALTER TABLE ONLY public.device_activities
    ADD CONSTRAINT device_activities_device_type_external_id_key UNIQUE (device_type, external_id);

ALTER TABLE ONLY public.device_activities
    ADD CONSTRAINT device_activities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.live_run_positions
    ADD CONSTRAINT live_run_positions_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.weekly_consistency
    ADD CONSTRAINT no_duplicate_week UNIQUE (user_id, week_start);

ALTER TABLE ONLY public.personal_records
    ADD CONSTRAINT personal_records_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.run_cheers
    ADD CONSTRAINT run_cheers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.run_cheers
    ADD CONSTRAINT run_cheers_run_id_from_user_key UNIQUE (run_id, from_user);

ALTER TABLE ONLY public.run_photos
    ADD CONSTRAINT run_photos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.run_processing
    ADD CONSTRAINT run_processing_pkey PRIMARY KEY (run_id);

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.safety_shares
    ADD CONSTRAINT safety_shares_pkey PRIMARY KEY (token);

ALTER TABLE ONLY public.saved_routes
    ADD CONSTRAINT saved_routes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shoes
    ADD CONSTRAINT shoes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.weekly_consistency
    ADD CONSTRAINT weekly_consistency_pkey PRIMARY KEY (id);


-- ── Functions ─────────────────────────────────────────────────────────

CREATE FUNCTION public.appeal_run_flag(p_run_id uuid, p_note text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  PERFORM set_config('runivo.integrity_writer', 'on', true);
  UPDATE public.runs
     SET integrity_status = 'appealed', integrity_appeal = left(NULLIF(trim(COALESCE(p_note, '')), ''), 500)
   WHERE id = p_run_id AND user_id = auth.uid() AND integrity_status = 'flagged';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('runivo.integrity_writer', 'off', true);
  RETURN v_n > 0;
END;
$$;

CREATE FUNCTION public.cheer_text(p_message text, p_name text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE p_message
    WHEN 'go'   THEN 'Go ' || COALESCE(NULLIF(p_name, ''), 'you') || '!'
    WHEN 'pace' THEN 'Keep that pace'
    WHEN 'home' THEN 'Bring it home'
    WHEN 'zone' THEN 'Take that zone'
    ELSE 'Clap clap!'
  END $$;

CREATE FUNCTION public.derive_run_route() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  coords text;
begin
  if new.gps_points is null or jsonb_array_length(new.gps_points) < 2 then
    return new;
  end if;

  select string_agg(
    (p->>'lng') || ' ' || (p->>'lat'),
    ','
    order by (p->>'timestamp')::bigint
  )
  into coords
  from jsonb_array_elements(new.gps_points) as p;

  new.route := st_geomfromtext('LINESTRING(' || coords || ')', 4326);
  return new;
end;
$$;

CREATE FUNCTION public.derive_saved_route_geometry() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  coords text;
begin
  if new.gps_points is null or jsonb_array_length(new.gps_points) < 2 then
    return new;
  end if;

  select string_agg(
    (p->>'lng') || ' ' || (p->>'lat'),
    ','
  )
  into coords
  from jsonb_array_elements(new.gps_points) as p;

  new.route := st_geomfromtext('LINESTRING(' || coords || ')', 4326);
  return new;
end;
$$;

CREATE FUNCTION public.end_safety_share(p_token text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE public.safety_shares SET ended_at = COALESCE(ended_at, now())
   WHERE token = p_token AND user_id = auth.uid();
$$;

CREATE FUNCTION public.fill_run_calories() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_weight  numeric(5,1);
  v_gender  text;
  v_age     smallint;
BEGIN
  -- Only fill if not already supplied by the client
  IF NEW.calories_burned IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch biometrics for this runner
  SELECT weight_kg, gender, age
  INTO   v_weight, v_gender, v_age
  FROM   public.profiles
  WHERE  id = NEW.user_id;

  NEW.calories_burned := public.calculate_calories(
    (NEW.distance_m::numeric / 1000),   -- metres → km
    NEW.duration_sec,
    COALESCE(v_weight, 70),
    COALESCE(v_gender, 'other'),
    COALESCE(v_age, 30)
  );

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.flag_run_integrity() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE v_reason text;
BEGIN
  -- Staff decisions stand; a fresh route is checked again.
  IF TG_OP = 'UPDATE' AND NEW.integrity_status IN ('cleared', 'appealed')
     AND NEW.gps_points IS NOT DISTINCT FROM OLD.gps_points THEN
    RETURN NEW;
  END IF;
  v_reason := public.run_integrity_reason(NEW.gps_points, NEW.activity_type);
  IF v_reason IS NULL THEN
    IF NEW.integrity_status = 'flagged' THEN NEW.integrity_status := 'ok'; NEW.integrity_reason := NULL; END IF;
  ELSE
    NEW.integrity_status := 'flagged';
    NEW.integrity_reason := v_reason;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.get_consistency_history(p_user_id uuid, p_weeks integer DEFAULT 8) RETURNS TABLE(week_start date, consistency_score integer, sessions_completed integer, sessions_planned integer, km_actual double precision, streak_days_eow integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT wc.week_start, wc.consistency_score, wc.sessions_completed,
         wc.sessions_planned, wc.km_actual, wc.streak_days_eow
    FROM public.weekly_consistency wc
   WHERE wc.user_id = p_user_id
     AND (auth.role() = 'service_role' OR p_user_id = auth.uid())
   ORDER BY wc.week_start DESC
   LIMIT LEAST(GREATEST(p_weeks, 1), 52);
$$;

CREATE FUNCTION public.get_runner_activities(p_user_id uuid, p_limit integer DEFAULT 200) RETURNS TABLE(id uuid, activity_type text, title text, started_at timestamp with time zone, distance_m numeric, duration_sec integer, avg_pace text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_vis text;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT profile_visibility INTO v_vis FROM public.profiles WHERE profiles.id = p_user_id;
  IF v_vis IS NULL OR public.is_blocked_between(v_uid, p_user_id) THEN RETURN; END IF;
  IF v_uid <> p_user_id AND NOT (
       v_vis = 'public'
       OR (v_vis = 'followers' AND EXISTS (SELECT 1 FROM public.followers f WHERE f.follower_id = v_uid AND f.following_id = p_user_id))
     ) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT r.id, COALESCE(r.activity_type, 'run'), COALESCE(fp.title, r.title), r.started_at,
           r.distance_m::numeric, r.duration_sec, r.avg_pace
      FROM public.feed_posts fp
      JOIN public.runs r ON r.id = fp.run_id
     WHERE fp.user_id = p_user_id
       AND fp.post_type = 'run'
       AND NOT r.excluded
       AND public.can_view_post(v_uid, fp.user_id, fp.visibility)
     ORDER BY r.started_at DESC
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
END;
$$;

CREATE FUNCTION public.get_year_in_runivo(p_year integer) RETURNS TABLE(activities integer, km numeric, hours numeric, longest_km numeric, active_days integer, zones_claimed integer, pace_earned integer, biggest_steal_m2 numeric, biggest_steal_from text, times_stolen_from integer, biggest_zone_m2 numeric, best_month integer, best_month_km numeric)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_from timestamptz := make_timestamptz(p_year, 1, 1, 0, 0, 0, 'UTC');
  v_to   timestamptz := make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'UTC');
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH r AS (
    SELECT distance_m, duration_sec, started_at FROM public.runs
     WHERE user_id = v_uid AND started_at >= v_from AND started_at < v_to
       AND COALESCE(activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike', 'wheelchair', 'stroller'])
       AND NOT excluded
  ), m AS (
    SELECT extract(month FROM started_at)::int AS mo, sum(distance_m) / 1000.0 AS mkm FROM r GROUP BY 1 ORDER BY 2 DESC LIMIT 1
  ), steal AS (
    SELECT stolen_area_m2, stolen_from_username FROM public.feed_posts
     WHERE user_id = v_uid AND post_type = 'conquest' AND created_at >= v_from AND created_at < v_to
     ORDER BY stolen_area_m2 DESC NULLS LAST LIMIT 1
  )
  SELECT
    (SELECT count(*)::int FROM r),
    round(COALESCE((SELECT sum(distance_m) FROM r), 0) / 1000.0, 1),
    round(COALESCE((SELECT sum(duration_sec) FROM r), 0) / 3600.0, 1),
    round(COALESCE((SELECT max(distance_m) FROM r), 0) / 1000.0, 2),
    (SELECT count(DISTINCT started_at::date)::int FROM r),
    COALESCE((SELECT sum(territories_claimed)::int FROM public.feed_posts
               WHERE user_id = v_uid AND post_type = 'run' AND created_at >= v_from AND created_at < v_to), 0),
    COALESCE((SELECT sum(credited)::int FROM public.pace_awards
               WHERE user_id = v_uid AND created_at >= v_from AND created_at < v_to), 0),
    (SELECT round(stolen_area_m2::numeric) FROM steal),
    (SELECT stolen_from_username FROM steal),
    (SELECT count(*)::int FROM public.feed_posts
      WHERE user_id = v_uid AND post_type = 'attack' AND created_at >= v_from AND created_at < v_to),
    (SELECT round(max(area_m2)::numeric) FROM public.territory_polygons WHERE owner_id = v_uid),
    (SELECT mo FROM m),
    (SELECT round(mkm::numeric, 1) FROM m);
END;
$$;

CREATE FUNCTION public.gps_polyline_length_m(points jsonb) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  pt       jsonb;
  prev_lat numeric;
  prev_lng numeric;
  cur_lat  numeric;
  cur_lng  numeric;
  d_lat    numeric;
  d_lng    numeric;
  a        numeric;
  total_m  numeric := 0;
BEGIN
  IF jsonb_typeof(points) IS DISTINCT FROM 'array' THEN
    RETURN 0;
  END IF;

  FOR pt IN SELECT * FROM jsonb_array_elements(points) LOOP
    cur_lat := (pt->>'lat')::numeric;
    cur_lng := (pt->>'lng')::numeric;

    IF prev_lat IS NOT NULL THEN
      d_lat := radians(cur_lat - prev_lat);
      d_lng := radians(cur_lng - prev_lng);
      a := sin(d_lat / 2) ^ 2
         + cos(radians(prev_lat)) * cos(radians(cur_lat)) * sin(d_lng / 2) ^ 2;
      total_m := total_m + 6371000 * 2 * atan2(sqrt(a), sqrt(1 - a));
    END IF;

    prev_lat := cur_lat;
    prev_lng := cur_lng;
  END LOOP;

  RETURN total_m;
END;
$$;

CREATE FUNCTION public.increment_run_stats(p_user_id uuid, p_distance_km numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.profiles
  SET total_distance_km = total_distance_km + GREATEST(p_distance_km, 0),
      total_runs        = total_runs + 1
  WHERE id = p_user_id;
END;
$$;

CREATE FUNCTION public.protect_run_integrity() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND current_setting('runivo.integrity_writer', true) IS DISTINCT FROM 'on' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.integrity_status := 'ok'; NEW.integrity_reason := NULL; NEW.integrity_appeal := NULL;
    ELSE
      NEW.integrity_status := OLD.integrity_status; NEW.integrity_reason := OLD.integrity_reason; NEW.integrity_appeal := OLD.integrity_appeal;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.protect_verified_distance() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND current_setting('runivo.integrity_writer', true) IS DISTINCT FROM 'on' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.verified_distance_m := NULL;
    ELSE
      NEW.verified_distance_m := OLD.verified_distance_m;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.public_route_for(p_user uuid, p_points jsonb, p_post_hidden boolean) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN p_post_hidden OR COALESCE(pr.map_hide_all, false) THEN '[]'::jsonb
    ELSE public.drop_private_points(p_user, public.blur_route(p_points, GREATEST(200, COALESCE(pr.map_hide_radius_m, 200))))
  END
  FROM (SELECT 1) one
  LEFT JOIN public.profiles pr ON pr.id = p_user;
$$;

CREATE FUNCTION public.revert_profile_run_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only revert stats that were counted (stats_synced = true means trigger ran on INSERT)
  IF OLD.stats_synced THEN
    UPDATE public.profiles
    SET
      total_runs        = GREATEST(total_runs - 1, 0),
      total_distance_km = GREATEST(total_distance_km - (OLD.distance_m / 1000.0), 0)
    WHERE id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE FUNCTION public.run_integrity_reason(points jsonb, activity text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  pt jsonb; plat float8; plng float8; pts float8; lat float8; lng float8; ts float8;
  a float8; d float8; dt float8; fast_m float8 := 0;
  on_foot boolean := COALESCE(activity, 'run') IN ('run', 'trail_run', 'trail', 'walk', 'hike');
BEGIN
  IF jsonb_typeof(points) IS DISTINCT FROM 'array' THEN RETURN NULL; END IF;
  FOR pt IN SELECT * FROM jsonb_array_elements(points) LOOP
    lat := (pt->>'lat')::float8; lng := (pt->>'lng')::float8; ts := (pt->>'timestamp')::float8;
    IF lat IS NULL OR lng IS NULL THEN CONTINUE; END IF;
    IF plat IS NOT NULL THEN
      a := sin(radians(lat - plat) / 2) ^ 2 + cos(radians(plat)) * cos(radians(lat)) * sin(radians(lng - plng) / 2) ^ 2;
      d := 6371000 * 2 * atan2(sqrt(a), sqrt(1 - a));
      dt := CASE WHEN ts IS NOT NULL AND pts IS NOT NULL AND ts > pts THEN (ts - pts) / 1000.0 ELSE NULL END;
      IF (dt IS NULL AND d >= 1000) OR (dt IS NOT NULL AND d >= 250 AND d / dt >= 15) THEN
        RETURN 'teleport';
      END IF;
      IF on_foot AND dt IS NOT NULL AND d / dt > 8 THEN
        fast_m := fast_m + d;
        IF fast_m >= 1000 THEN RETURN 'vehicle'; END IF;
      END IF;
    END IF;
    plat := lat; plng := lng; pts := ts;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE FUNCTION public.runner_recent_cities(p_user uuid, p_now timestamp with time zone DEFAULT now()) RETURNS text[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(array_agg(DISTINCT c), '{}')
    FROM (
      SELECT public.city_for_point(ST_StartPoint(r.route)) AS c
        FROM public.runs r
       WHERE r.user_id = p_user
         AND r.started_at > p_now - interval '30 days'
         AND r.started_at <= p_now
         AND r.route IS NOT NULL
         AND COALESCE(r.verified_distance_m, 0) > 0
         AND NOT COALESCE(r.excluded, false)
         AND r.integrity_status IN ('ok', 'cleared')
    ) x
   WHERE c IS NOT NULL;
$$;

CREATE FUNCTION public.send_cheer(p_to uuid, p_message text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_me     uuid := auth.uid();
  v_run    text;
  v_from   text;
  v_to     text;
  v_id     uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF p_message IS NULL OR p_message NOT IN ('go', 'pace', 'home', 'zone', 'clap') THEN RETURN 'bad_message'; END IF;
  IF p_to IS NULL OR p_to = v_me THEN RETURN 'not_live'; END IF;

  -- Same rule as reading the runner's live position (20260811000004), with a
  -- little slack for a cheer composed on a slow connection.
  SELECT lp.run_id INTO v_run
    FROM live_run_positions lp
    JOIN profiles p ON p.id = lp.user_id
   WHERE lp.user_id = p_to
     AND lp.updated_at > now() - interval '60 seconds'
     AND p.live_run_sharing_enabled
     AND EXISTS (SELECT 1 FROM followers WHERE follower_id = v_me AND following_id = p_to)
     AND EXISTS (SELECT 1 FROM followers WHERE follower_id = p_to AND following_id = v_me)
     AND NOT EXISTS (
       SELECT 1 FROM user_blocks
        WHERE (blocker_id = p_to AND blocked_id = v_me) OR (blocker_id = v_me AND blocked_id = p_to)
     );
  IF v_run IS NULL THEN RETURN 'not_live'; END IF;

  IF (SELECT count(*) FROM run_cheers WHERE from_user = v_me AND created_at > now() - interval '1 hour') >= 30 THEN
    RETURN 'too_many';
  END IF;

  INSERT INTO run_cheers (run_id, to_user, from_user, message)
  VALUES (v_run, p_to, v_me, p_message)
  ON CONFLICT (run_id, from_user) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN 'already'; END IF;

  SELECT username INTO v_from FROM profiles WHERE id = v_me;
  SELECT username INTO v_to   FROM profiles WHERE id = p_to;
  INSERT INTO notifications (user_id, type, title, body, action_url, dedupe_key)
  VALUES (p_to, 'cheer', COALESCE(v_from, 'A friend') || ' cheered you on',
          cheer_text(p_message, v_to), '/run', 'cheer:' || v_id::text);

  RETURN 'sent';
END;
$$;

CREATE FUNCTION public.set_activity_excluded(p_run_id uuid, p_excluded boolean) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  UPDATE public.runs SET excluded = COALESCE(p_excluded, false)
   WHERE id = p_run_id AND user_id = auth.uid();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;

CREATE FUNCTION public.set_activity_map_hidden(p_run_id uuid, p_hidden boolean) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n   integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;

  UPDATE public.feed_posts
     SET map_hidden = COALESCE(p_hidden, false)
   WHERE user_id = v_uid AND run_id = p_run_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- Showing it again needs the route back from the private run.
  IF v_n > 0 AND NOT COALESCE(p_hidden, false) THEN
    PERFORM public.refresh_post_routes(v_uid, p_run_id);
  END IF;
  RETURN v_n;
END;
$$;

CREATE FUNCTION public.start_safety_share(p_run_id text, p_sport text DEFAULT 'run'::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_uid uuid := auth.uid(); v_token text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  UPDATE public.safety_shares SET ended_at = now() WHERE user_id = v_uid AND ended_at IS NULL;
  IF (SELECT count(*) FROM public.safety_shares WHERE user_id = v_uid AND started_at > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'too many shares today' USING ERRCODE = '54000';
  END IF;
  -- 244 random bits; gen_random_uuid is core Postgres (no extension schema needed).
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  INSERT INTO public.safety_shares (token, user_id, run_id, sport)
  VALUES (v_token, v_uid, p_run_id, COALESCE(NULLIF(p_sport, ''), 'run'));
  RETURN v_token;
END;
$$;

CREATE FUNCTION public.sync_profile_run_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  today    date := new.started_at::date;
  last_run date;
begin
  -- Skip if already processed (idempotency guard)
  if new.stats_synced then
    return new;
  end if;

  -- Rides don't count toward running totals or the streak (left unsynced, so
  -- revert_profile_run_stats has nothing to undo either).
  if coalesce(new.activity_type, 'run') not in ('run', 'trail_run', 'trail', 'walk', 'hike') then
    return new;
  end if;

  -- Increment lifetime stats
  update public.profiles
  set
    total_runs        = total_runs + 1,
    total_distance_km = total_distance_km + (new.distance_m / 1000.0)
  where id = new.user_id;

  -- Update streak server-side
  select last_run_date into last_run
  from   public.profiles
  where  id = new.user_id;

  if last_run is null or last_run < today - interval '1 day' then
    -- First run ever, or streak broken
    update public.profiles
    set streak_days   = 1,
        last_run_date = today
    where id = new.user_id;
  elsif last_run = today - interval '1 day' then
    -- Consecutive day — extend streak
    update public.profiles
    set streak_days   = streak_days + 1,
        last_run_date = today
    where id = new.user_id;
  elsif last_run = today then
    -- Already ran today — just update last_run_date, no streak change
    update public.profiles
    set last_run_date = today
    where id = new.user_id;
  end if;

  -- Mark this row as processed
  new.stats_synced := true;
  return new;
end;
$$;

CREATE FUNCTION public.thank_cheer(p_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH t AS (
    UPDATE run_cheers SET thanked_at = COALESCE(thanked_at, now())
     WHERE id = p_id AND to_user = auth.uid()
     RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM t);
$$;

CREATE FUNCTION public.update_activity(p_run_id uuid, p_title text, p_description text, p_visibility text, p_perceived_effort smallint DEFAULT NULL::smallint, p_private_notes text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_title text := NULLIF(trim(COALESCE(p_title, '')), '');
  v_desc  text := NULLIF(trim(COALESCE(p_description, '')), '');
  v_notes text := NULLIF(trim(COALESCE(p_private_notes, '')), '');
  v_n     integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF p_visibility NOT IN ('everyone', 'followers', 'only_me') THEN
    RAISE EXCEPTION 'visibility must be everyone, followers or only_me' USING ERRCODE = '22023';
  END IF;

  UPDATE public.runs
     SET title = v_title, description = v_desc, private_notes = v_notes, perceived_effort = p_perceived_effort
   WHERE id = p_run_id AND user_id = v_uid;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE public.feed_posts
     SET title = v_title, content = v_desc, visibility = p_visibility
   WHERE run_id = p_run_id AND user_id = v_uid;

  RETURN v_n > 0;
END;
$$;

CREATE FUNCTION public.update_safety_share(p_token text, p_lat double precision, p_lng double precision, p_distance_m numeric, p_elapsed_sec integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_n integer;
BEGIN
  IF p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'bad position' USING ERRCODE = '22023';
  END IF;
  UPDATE public.safety_shares
     SET lat = p_lat, lng = p_lng, position_at = now(), distance_m = GREATEST(0, p_distance_m), elapsed_sec = GREATEST(0, p_elapsed_sec)
   WHERE token = p_token AND user_id = auth.uid() AND ended_at IS NULL AND expires_at > now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;

CREATE FUNCTION public.validate_run_distance() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  point_count      int := 0;
  max_plausible_m  numeric;
  polyline_m       numeric;
BEGIN
  -- process-run-territory and the sync backfill run as service_role and have already
  -- done (or are performing) the authoritative computation.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.distance_m IS NULL OR NEW.distance_m < 0 THEN
    RAISE EXCEPTION 'runs.distance_m must be a non-negative number';
  END IF;

  IF NEW.duration_sec IS NULL OR NEW.duration_sec < 0 THEN
    RAISE EXCEPTION 'runs.duration_sec must be a non-negative number';
  END IF;

  -- Speed gate. 5.5 m/s is MAX_RUN_SPEED_MS, shared by the client claim engine
  -- (packages/shared/src/services/config.ts:4) and the territory edge function
  -- (supabase/functions/process-run-territory/index.ts:4). 10% headroom absorbs
  -- GPS jitter and rounding. Only enforced for foot activities so that adding a
  -- cycling type later fails loudly in review rather than silently rejecting rides.
  -- Rides (activity_type 'cycle') get their own cap: 22 m/s, the engine's
  -- MAX_RIDE_SEGMENT_SPEED_MS, plus the same 10% headroom.
  IF NEW.activity_type = 'cycle' THEN
    max_plausible_m := NEW.duration_sec * 22 * 1.1;
    IF NEW.distance_m > max_plausible_m THEN
      RAISE EXCEPTION
        'runs.distance_m % implausible for a ride of duration_sec % (max %m at 22 m/s)',
        NEW.distance_m, NEW.duration_sec, round(max_plausible_m);
    END IF;
  END IF;

  -- Self-propelled (ENGINE.TERRITORY_ACTIVITIES plus treadmill). Wheelchairs
  -- are faster downhill (9 m/s); a treadmill is a run with no GPS.
  IF COALESCE(NEW.activity_type, 'run') IN ('run', 'trail_run', 'trail', 'walk', 'hike', 'stroller', 'wheelchair', 'treadmill') THEN
    max_plausible_m := NEW.duration_sec * (CASE WHEN NEW.activity_type = 'wheelchair' THEN 9 WHEN NEW.activity_type = 'treadmill' THEN 6.5 ELSE 5.5 END) * 1.1;
    IF NEW.distance_m > max_plausible_m THEN
      RAISE EXCEPTION
        'runs.distance_m % implausible for duration_sec % (max %m at 5.5 m/s)',
        NEW.distance_m, NEW.duration_sec, round(max_plausible_m);
    END IF;

    -- No two runs for the same user can occupy overlapping time — see header.
    IF NEW.started_at IS NOT NULL AND NEW.finished_at IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.runs r
      WHERE r.user_id = NEW.user_id
        AND r.id <> NEW.id
        AND COALESCE(r.activity_type, 'run') IN ('run', 'trail_run', 'trail', 'walk', 'hike', 'stroller', 'wheelchair', 'treadmill')
        AND r.started_at < NEW.finished_at
        AND r.finished_at > NEW.started_at
    ) THEN
      RAISE EXCEPTION
        'runs: started_at/finished_at overlaps another run already recorded for this user';
    END IF;
  END IF;

  -- Anything beyond a token distance must carry a GPS trace. jsonb_array_length
  -- raises on a non-array, so only call it once the type is known to be an array.
  IF jsonb_typeof(NEW.gps_points) = 'array' THEN
    point_count := jsonb_array_length(NEW.gps_points);
  END IF;

  -- Treadmill runs carry no trace; they never claim zones or earn PACE.
  IF NEW.activity_type = 'treadmill' THEN
    RETURN NEW;
  END IF;

  IF NEW.distance_m > 1000 AND point_count < 10 THEN
    RAISE EXCEPTION
      'runs.distance_m % requires a GPS trace (got % points)',
      NEW.distance_m, point_count;
  END IF;

  -- Polyline consistency — see validate_run_distance_polyline.sql for the 2.5x rationale.
  IF NEW.distance_m > 1000 AND point_count >= 10 THEN
    polyline_m := public.gps_polyline_length_m(NEW.gps_points);
    IF polyline_m > 0 AND NEW.distance_m > polyline_m * 2.5 THEN
      RAISE EXCEPTION
        'runs.distance_m % implausible for a %m GPS trace (% points)',
        NEW.distance_m, round(polyline_m), point_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ── Views ─────────────────────────────────────────────────────────────

CREATE VIEW public.shoe_stats AS
SELECT
    NULL::uuid AS id,
    NULL::uuid AS user_id,
    NULL::text AS brand,
    NULL::text AS model,
    NULL::text AS nickname,
    NULL::numeric AS max_km,
    NULL::boolean AS is_retired,
    NULL::boolean AS is_default,
    NULL::text AS color,
    NULL::numeric AS total_km,
    NULL::bigint AS total_runs,
    NULL::timestamp with time zone AS last_used_at;

CREATE OR REPLACE VIEW public.shoe_stats AS
 SELECT s.id,
    s.user_id,
    s.brand,
    s.model,
    s.nickname,
    s.max_km,
    s.is_retired,
    s.is_default,
    s.color,
    COALESCE((sum(r.distance_m) / 1000.0), (0)::numeric) AS total_km,
    count(r.id) AS total_runs,
    max(r.started_at) AS last_used_at
   FROM (public.shoes s
     LEFT JOIN public.runs r ON (((r.shoe_id = s.id) AND (r.user_id = s.user_id))))
  GROUP BY s.id;


-- ── Foreign keys ──────────────────────────────────────────────────────

ALTER TABLE ONLY public.device_activities
    ADD CONSTRAINT device_activities_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.device_activities
    ADD CONSTRAINT device_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.live_run_positions
    ADD CONSTRAINT live_run_positions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.personal_records
    ADD CONSTRAINT personal_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pinned_run_id_fkey FOREIGN KEY (pinned_run_id) REFERENCES public.runs(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.run_cheers
    ADD CONSTRAINT run_cheers_from_user_fkey FOREIGN KEY (from_user) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.run_cheers
    ADD CONSTRAINT run_cheers_to_user_fkey FOREIGN KEY (to_user) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.run_photos
    ADD CONSTRAINT run_photos_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.run_photos
    ADD CONSTRAINT run_photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.run_processing
    ADD CONSTRAINT run_processing_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.run_processing
    ADD CONSTRAINT run_processing_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_shoe_id_fkey FOREIGN KEY (shoe_id) REFERENCES public.shoes(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.safety_shares
    ADD CONSTRAINT safety_shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.saved_routes
    ADD CONSTRAINT saved_routes_source_run_id_fkey FOREIGN KEY (source_run_id) REFERENCES public.runs(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.saved_routes
    ADD CONSTRAINT saved_routes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shoes
    ADD CONSTRAINT shoes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.weekly_consistency
    ADD CONSTRAINT weekly_consistency_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- ── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX device_activities_run_idx ON public.device_activities USING btree (run_id) WHERE (run_id IS NOT NULL);

CREATE INDEX device_activities_user_idx ON public.device_activities USING btree (user_id, started_at DESC);

CREATE INDEX idx_runs_user_started_verified ON public.runs USING btree (user_id, started_at) WHERE (verified_distance_m IS NOT NULL);

CREATE INDEX run_cheers_from_recent_idx ON public.run_cheers USING btree (from_user, created_at DESC);

CREATE INDEX run_cheers_to_run_idx ON public.run_cheers USING btree (to_user, run_id);

CREATE INDEX run_photos_run_id_idx ON public.run_photos USING btree (run_id);

CREATE INDEX runs_route_gist_idx ON public.runs USING gist (route);

CREATE INDEX runs_started_at_idx ON public.runs USING btree (started_at DESC);

CREATE INDEX runs_user_id_started_at_idx ON public.runs USING btree (user_id, started_at DESC);

CREATE INDEX safety_shares_user_idx ON public.safety_shares USING btree (user_id, started_at DESC);

CREATE INDEX saved_routes_route_gist_idx ON public.saved_routes USING gist (route);

CREATE INDEX saved_routes_user_id_idx ON public.saved_routes USING btree (user_id, created_at DESC);

CREATE INDEX shoes_user_idx ON public.shoes USING btree (user_id);

CREATE INDEX wc_user_week ON public.weekly_consistency USING btree (user_id, week_start DESC);


-- ── Triggers ──────────────────────────────────────────────────────────

CREATE TRIGGER runs_a_protect_integrity BEFORE INSERT OR UPDATE ON public.runs FOR EACH ROW EXECUTE FUNCTION public.protect_run_integrity();

CREATE TRIGGER runs_a_protect_verified_distance BEFORE INSERT OR UPDATE ON public.runs FOR EACH ROW EXECUTE FUNCTION public.protect_verified_distance();

CREATE TRIGGER runs_fill_calories BEFORE INSERT OR UPDATE OF distance_m, duration_sec ON public.runs FOR EACH ROW EXECUTE FUNCTION public.fill_run_calories();

CREATE TRIGGER runs_flag_integrity BEFORE INSERT OR UPDATE OF gps_points, activity_type ON public.runs FOR EACH ROW EXECUTE FUNCTION public.flag_run_integrity();

CREATE TRIGGER runs_validate_distance BEFORE INSERT OR UPDATE OF distance_m, duration_sec, gps_points, activity_type, started_at, finished_at ON public.runs FOR EACH ROW EXECUTE FUNCTION public.validate_run_distance();

CREATE TRIGGER trg_derive_run_route BEFORE INSERT ON public.runs FOR EACH ROW EXECUTE FUNCTION public.derive_run_route();

CREATE TRIGGER trg_derive_saved_route_geometry BEFORE INSERT OR UPDATE OF gps_points ON public.saved_routes FOR EACH ROW EXECUTE FUNCTION public.derive_saved_route_geometry();

CREATE TRIGGER trg_revert_profile_run_stats AFTER DELETE ON public.runs FOR EACH ROW EXECUTE FUNCTION public.revert_profile_run_stats();

CREATE TRIGGER trg_sync_profile_run_stats BEFORE INSERT ON public.runs FOR EACH ROW EXECUTE FUNCTION public.sync_profile_run_stats();


-- ── Row-level security ────────────────────────────────────────────────

ALTER TABLE public.device_activities ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.live_run_positions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.run_cheers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.run_photos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.run_processing ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.safety_shares ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.saved_routes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shoes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.weekly_consistency ENABLE ROW LEVEL SECURITY;


-- ── Policies ──────────────────────────────────────────────────────────

CREATE POLICY "live_run_positions: owner full access" ON public.live_run_positions TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY owner_all ON public.device_activities USING ((auth.uid() = user_id));

CREATE POLICY owner_all ON public.shoes USING ((auth.uid() = user_id));

CREATE POLICY pr_read ON public.personal_records FOR SELECT USING (true);

CREATE POLICY pr_write ON public.personal_records USING ((user_id = auth.uid()));

CREATE POLICY "run_cheers: sender and runner read" ON public.run_cheers FOR SELECT TO authenticated USING (((auth.uid() = to_user) OR (auth.uid() = from_user)));

CREATE POLICY "run_photos: anyone can read" ON public.run_photos FOR SELECT USING (true);

CREATE POLICY "run_photos: owner can delete" ON public.run_photos FOR DELETE USING ((auth.uid() = user_id));

CREATE POLICY "run_photos: owner can insert" ON public.run_photos FOR INSERT WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "runs: owner can delete" ON public.runs FOR DELETE USING ((auth.uid() = user_id));

CREATE POLICY "runs: owner can insert" ON public.runs FOR INSERT WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "runs: owner can read" ON public.runs FOR SELECT USING ((auth.uid() = user_id));

CREATE POLICY "safety_shares: owner reads" ON public.safety_shares FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY "saved_routes: anyone can read public" ON public.saved_routes FOR SELECT USING (((is_public = true) OR (auth.uid() = user_id)));

CREATE POLICY "saved_routes: owner can delete" ON public.saved_routes FOR DELETE USING ((auth.uid() = user_id));

CREATE POLICY "saved_routes: owner can insert" ON public.saved_routes FOR INSERT WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "saved_routes: owner can update" ON public.saved_routes FOR UPDATE USING ((auth.uid() = user_id));

CREATE POLICY wc_own ON public.weekly_consistency USING ((user_id = auth.uid()));

CREATE POLICY "user-media: owner delete" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'user-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "user-media: owner update" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'user-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "user-media: owner write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'user-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "user-media: public read" ON storage.objects FOR SELECT USING ((bucket_id = 'user-media'::text));


-- ── Comments ──────────────────────────────────────────────────────────

COMMENT ON FUNCTION public.revert_profile_run_stats() IS 'Reverses total_runs and total_distance_km on run DELETE.
   Only acts when stats_synced=true (confirming the INSERT trigger already counted this run).
   profiles.xp is NOT reversed here — it is client-driven via pushProfile().';

COMMENT ON TABLE public.runs IS 'Completed run sessions with GPS tracks and territory outcomes.';

COMMENT ON COLUMN public.runs.calories_burned IS 'Kilocalories burned during this run, calculated via calculate_calories().';

COMMENT ON COLUMN public.runs.enemy_captured IS 'Number of enemy territories captured during this run.';

COMMENT ON COLUMN public.runs.pre_run_level IS 'Player level at the start of the run (used for level-up detection).';

COMMENT ON COLUMN public.runs.stats_synced IS 'True once sync_profile_run_stats has run for this row. Prevents double-counting on retried pushes.';

COMMENT ON COLUMN public.runs.avg_hr IS 'Average heart rate in BPM from paired wearable';

COMMENT ON COLUMN public.runs.max_hr IS 'Peak heart rate in BPM from paired wearable';

COMMENT ON COLUMN public.runs.avg_cadence IS 'Average step cadence in steps/min';

COMMENT ON COLUMN public.runs.elevation_gain_m IS 'Total elevation gain in metres';

COMMENT ON COLUMN public.runs.hrv_ms IS 'HRV (RMSSD) at run start for recovery context';

COMMENT ON COLUMN public.runs.calories_kcal IS 'Active calories burned during run';

COMMENT ON COLUMN public.runs.import_source IS 'Source platform when run was imported from a device';

COMMENT ON TABLE public.live_run_positions IS 'Ephemeral, single-row-per-user live position during an active run. Overwritten every update, deleted on run stop — never a history table.';

COMMENT ON TABLE public.run_photos IS 'Optional photos attached to a run — stored in the run-photos Storage bucket.';

COMMENT ON TABLE public.run_processing IS 'process-run-territory claims a run here first; a replay returns the stored result and changes nothing.';

COMMENT ON TABLE public.saved_routes IS 'Named GPS routes saved by users for reuse and sharing.';

COMMENT ON TRIGGER runs_fill_calories ON public.runs IS 'Auto-calculates calories_burned using the runner''s stored biometrics.
   Skips calculation if the client already supplied a value.';


-- ── Grants ────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.get_consistency_history(p_user_id uuid, p_weeks integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.get_consistency_history(p_user_id uuid, p_weeks integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_consistency_history(p_user_id uuid, p_weeks integer) TO service_role;

REVOKE ALL ON FUNCTION public.increment_run_stats(p_user_id uuid, p_distance_km numeric) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.increment_run_stats(p_user_id uuid, p_distance_km numeric) TO service_role;

REVOKE ALL ON FUNCTION public.protect_verified_distance() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.protect_verified_distance() TO service_role;

REVOKE ALL ON FUNCTION public.runner_recent_cities(p_user uuid, p_now timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.runner_recent_cities(p_user uuid, p_now timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.send_cheer(p_to uuid, p_message text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.send_cheer(p_to uuid, p_message text) TO authenticated;
GRANT ALL ON FUNCTION public.send_cheer(p_to uuid, p_message text) TO service_role;

REVOKE ALL ON FUNCTION public.thank_cheer(p_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.thank_cheer(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.thank_cheer(p_id uuid) TO service_role;

REVOKE ALL ON TABLE public.run_cheers FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.run_cheers TO authenticated;
GRANT ALL ON TABLE public.run_cheers TO service_role;


-- ── Storage buckets ────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-media', 'user-media', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ── Realtime ───────────────────────────────────────────────────────────

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.live_run_positions; EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.run_cheers; EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END;
END $$;

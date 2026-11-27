-- ========================================================================
-- Accounts
-- ========================================================================
-- Profiles, sign-up, privacy, devices, subscriptions and onboarding.
--
-- One file per feature: this file creates everything this feature owns
-- (tables, functions, triggers, row-level security, grants, scheduled jobs).
-- It needs only the files before it. Built from the 178 migrations up to
-- 20261117000012 (the 178 old files were removed after commit 9e5cf19; see git history); a fresh
-- database built from these files matches one built from those exactly.
--
-- Tables: device_connections, privacy_places, profiles, profiles_public

SET check_function_bodies = false;
SET client_min_messages = warning;
SET search_path = public, extensions;


-- ── Tables ────────────────────────────────────────────────────────────

CREATE TABLE public.device_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_type text NOT NULL,
    status text DEFAULT 'connected'::text NOT NULL,
    last_sync_at timestamp with time zone,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    secrets jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT device_connections_device_type_check CHECK ((device_type = ANY (ARRAY['apple_health'::text, 'garmin'::text, 'coros'::text, 'polar'::text]))),
    CONSTRAINT device_connections_status_check CHECK ((status = ANY (ARRAY['connected'::text, 'disconnected'::text, 'error'::text])))
);

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text NOT NULL,
    avatar_url text,
    level integer DEFAULT 1 NOT NULL,
    xp integer DEFAULT 0 NOT NULL,
    coins integer DEFAULT 100 NOT NULL,
    energy integer DEFAULT 10 NOT NULL,
    last_energy_regen timestamp with time zone DEFAULT now() NOT NULL,
    total_distance_km numeric(10,3) DEFAULT 0 NOT NULL,
    total_runs integer DEFAULT 0 NOT NULL,
    total_territories_claimed integer DEFAULT 0 NOT NULL,
    streak_days integer DEFAULT 0 NOT NULL,
    last_run_date date,
    follower_count integer DEFAULT 0 NOT NULL,
    following_count integer DEFAULT 0 NOT NULL,
    experience_level text,
    weekly_frequency integer,
    primary_goal text,
    preferred_distance text,
    playstyle text,
    distance_unit text DEFAULT 'km'::text NOT NULL,
    notifications_enabled boolean DEFAULT true NOT NULL,
    weekly_goal_km numeric(6,1) DEFAULT 20 NOT NULL,
    mission_difficulty text DEFAULT 'mixed'::text NOT NULL,
    onboarding_completed_at timestamp with time zone,
    phone text,
    subscription_tier text DEFAULT 'free'::text NOT NULL,
    subscription_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    referred_by text,
    age smallint,
    gender text,
    height_cm smallint,
    weight_kg numeric(5,1),
    bio text,
    location text,
    display_name text,
    strava text,
    instagram text,
    avatar_color text DEFAULT 'teal'::text NOT NULL,
    unlocked_achievements text[] DEFAULT '{}'::text[] NOT NULL,
    foot_type text,
    foot_scan_at timestamp with time zone,
    pace_balance integer DEFAULT 0 NOT NULL,
    pace_total_earned integer DEFAULT 0 NOT NULL,
    pace_weekly_earned integer DEFAULT 0 NOT NULL,
    pace_weekly_reset_at timestamp with time zone DEFAULT now() NOT NULL,
    runner_rank text DEFAULT 'pacer'::text NOT NULL,
    territory_score double precision DEFAULT 0 NOT NULL,
    last_known_location public.geometry(Point,4326),
    pinned_run_id uuid,
    country text,
    run_reminders_enabled boolean DEFAULT true NOT NULL,
    territory_alerts_enabled boolean DEFAULT true NOT NULL,
    announce_achievements_enabled boolean DEFAULT true NOT NULL,
    weekly_summary_enabled boolean DEFAULT true NOT NULL,
    profile_visibility text DEFAULT 'public'::text NOT NULL,
    live_run_sharing_enabled boolean DEFAULT false NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    offers_enabled boolean DEFAULT false NOT NULL,
    usual_distance_km numeric(4,1),
    recent_5k_seconds integer,
    pacex_tone text,
    age_range text,
    health_consent_at timestamp with time zone,
    health_consent_version text,
    health_baseline jsonb,
    map_hide_radius_m integer DEFAULT 200 NOT NULL,
    map_hide_all boolean DEFAULT false NOT NULL,
    default_activity_visibility text DEFAULT 'everyone'::text NOT NULL,
    hide_from_leaderboards boolean DEFAULT false NOT NULL,
    hide_zones_from_map boolean DEFAULT false NOT NULL,
    quiet_start smallint DEFAULT 22 NOT NULL,
    quiet_end smallint DEFAULT 7 NOT NULL,
    daily_nudge_limit smallint DEFAULT 3 NOT NULL,
    friend_zone_alerts boolean DEFAULT false NOT NULL,
    email_digest_enabled boolean DEFAULT true NOT NULL,
    onboarding_variant text,
    subscription_event_at timestamp with time zone,
    ai_consent_at timestamp with time zone,
    age_confirmed_at timestamp with time zone,
    race_distance text,
    race_date date,
    race_goal_seconds integer,
    run_days smallint[],
    long_run_day smallint,
    usual_run_time text,
    weekday_minutes smallint,
    niggles text[] DEFAULT '{}'::text[] NOT NULL,
    returning_from_break boolean DEFAULT false NOT NULL,
    referral_code text,
    CONSTRAINT profiles_age_check CHECK (((age >= 10) AND (age <= 120))),
    CONSTRAINT profiles_age_range_check CHECK ((age_range = ANY (ARRAY['under_18'::text, '18_24'::text, '25_34'::text, '35_44'::text, '45_54'::text, '55_64'::text, '65_plus'::text]))),
    CONSTRAINT profiles_bio_length CHECK (((bio IS NULL) OR (char_length(bio) <= 150))),
    CONSTRAINT profiles_default_activity_visibility_check CHECK ((default_activity_visibility = ANY (ARRAY['everyone'::text, 'followers'::text, 'only_me'::text]))),
    CONSTRAINT profiles_display_name_length CHECK (((display_name IS NULL) OR (char_length(display_name) <= 40))),
    CONSTRAINT profiles_distance_unit_check CHECK ((distance_unit = ANY (ARRAY['km'::text, 'mi'::text]))),
    CONSTRAINT profiles_energy_range CHECK (((energy >= 0) AND (energy <= 10))),
    CONSTRAINT profiles_experience_level_check CHECK ((experience_level = ANY (ARRAY['new'::text, 'casual'::text, 'regular'::text, 'competitive'::text]))),
    CONSTRAINT profiles_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text]))),
    CONSTRAINT profiles_height_cm_check CHECK (((height_cm >= 50) AND (height_cm <= 300))),
    CONSTRAINT profiles_instagram_length CHECK (((instagram IS NULL) OR (char_length(instagram) <= 100))),
    CONSTRAINT profiles_location_length CHECK (((location IS NULL) OR (char_length(location) <= 60))),
    CONSTRAINT profiles_long_run_day_check CHECK (((long_run_day IS NULL) OR ((long_run_day >= 0) AND (long_run_day <= 6)))),
    CONSTRAINT profiles_map_hide_radius_m_check CHECK ((map_hide_radius_m = ANY (ARRAY[200, 400, 800, 1600]))),
    CONSTRAINT profiles_mission_difficulty_check CHECK ((mission_difficulty = ANY (ARRAY['easy'::text, 'mixed'::text, 'hard'::text]))),
    CONSTRAINT profiles_niggles_check CHECK ((niggles <@ ARRAY['knee'::text, 'shin'::text, 'calf'::text, 'hip'::text, 'foot'::text])),
    CONSTRAINT profiles_onboarding_variant_check CHECK (((onboarding_variant IS NULL) OR (onboarding_variant = ANY (ARRAY['full'::text, 'short'::text])))),
    CONSTRAINT profiles_pacex_tone_check CHECK ((pacex_tone = ANY (ARRAY['encouraging'::text, 'structured'::text, 'competitive'::text, 'friendly'::text]))),
    CONSTRAINT profiles_playstyle_check CHECK ((playstyle = ANY (ARRAY['conqueror'::text, 'defender'::text, 'explorer'::text, 'social'::text]))),
    CONSTRAINT profiles_preferred_distance_check CHECK ((preferred_distance = ANY (ARRAY['short'::text, '5k'::text, '10k'::text, 'long'::text]))),
    CONSTRAINT profiles_primary_goal_check CHECK ((primary_goal = ANY (ARRAY['get_fit'::text, 'race'::text, 'compete'::text, 'social'::text, 'lose_weight'::text, 'run_faster'::text, 'explore'::text]))),
    CONSTRAINT profiles_profile_visibility_check CHECK ((profile_visibility = ANY (ARRAY['public'::text, 'followers'::text, 'private'::text]))),
    CONSTRAINT profiles_quiet_hours_chk CHECK ((((quiet_start >= 0) AND (quiet_start <= 23)) AND ((quiet_end >= 0) AND (quiet_end <= 23)) AND ((daily_nudge_limit >= 0) AND (daily_nudge_limit <= 10)))),
    CONSTRAINT profiles_race_distance_check CHECK (((race_distance IS NULL) OR (race_distance = ANY (ARRAY['5k'::text, '10k'::text, 'half'::text, 'marathon'::text])))),
    CONSTRAINT profiles_race_goal_check CHECK (((race_goal_seconds IS NULL) OR ((race_goal_seconds >= 600) AND (race_goal_seconds <= 36000)))),
    CONSTRAINT profiles_recent_5k_seconds_check CHECK (((recent_5k_seconds >= 720) AND (recent_5k_seconds <= 5400))),
    CONSTRAINT profiles_run_days_check CHECK (((run_days IS NULL) OR ((cardinality(run_days) <= 7) AND (run_days <@ ARRAY[(0)::smallint, (1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint])))),
    CONSTRAINT profiles_runner_rank_check CHECK ((runner_rank = ANY (ARRAY['pacer'::text, 'strider'::text, 'chaser'::text, 'hunter'::text, 'sovereign'::text]))),
    CONSTRAINT profiles_strava_length CHECK (((strava IS NULL) OR (char_length(strava) <= 200))),
    CONSTRAINT profiles_subscription_tier_check CHECK ((subscription_tier = ANY (ARRAY['free'::text, 'premium'::text, 'admin'::text]))),
    CONSTRAINT profiles_usual_distance_km_check CHECK (((usual_distance_km > (0)::numeric) AND (usual_distance_km <= (100)::numeric))),
    CONSTRAINT profiles_usual_run_time_check CHECK (((usual_run_time IS NULL) OR (usual_run_time = ANY (ARRAY['early'::text, 'morning'::text, 'evening'::text, 'varies'::text])))),
    CONSTRAINT profiles_weekday_minutes_check CHECK (((weekday_minutes IS NULL) OR ((weekday_minutes >= 10) AND (weekday_minutes <= 240)))),
    CONSTRAINT profiles_weight_kg_check CHECK (((weight_kg >= (20)::numeric) AND (weight_kg <= (500)::numeric)))
);

CREATE TABLE public.privacy_places (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    label text DEFAULT 'Home'::text NOT NULL,
    center public.geography(Point,4326) NOT NULL,
    radius_m integer DEFAULT 400 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT privacy_places_label_check CHECK (((length(label) >= 1) AND (length(label) <= 40))),
    CONSTRAINT privacy_places_radius_m_check CHECK ((radius_m = ANY (ARRAY[200, 400, 800, 1600])))
);


-- ── Keys and checks ───────────────────────────────────────────────────

ALTER TABLE ONLY public.device_connections
    ADD CONSTRAINT device_connections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.device_connections
    ADD CONSTRAINT device_connections_user_id_device_type_key UNIQUE (user_id, device_type);

ALTER TABLE ONLY public.privacy_places
    ADD CONSTRAINT privacy_places_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


-- ── Functions ─────────────────────────────────────────────────────────

CREATE FUNCTION public.add_privacy_place(p_label text, p_lat double precision, p_lng double precision, p_radius_m integer DEFAULT 400) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'bad position' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(*) FROM public.privacy_places WHERE user_id = v_uid) >= 5 THEN
    RAISE EXCEPTION 'at most 5 private places' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.privacy_places (user_id, label, center, radius_m)
  VALUES (v_uid, COALESCE(NULLIF(trim(p_label), ''), 'Home'), ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, COALESCE(p_radius_m, 400))
  RETURNING id INTO v_id;
  PERFORM public.refresh_private_zones(v_uid);
  PERFORM public.refresh_post_routes(v_uid);
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.clear_health_on_consent_withdrawal() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- No consent, no health data: covers withdrawal and a baseline sent without consent.
  IF NEW.health_consent_at IS NULL THEN
    NEW.health_baseline := NULL;
    NEW.health_consent_version := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.drop_private_points(p_user uuid, p_points jsonb) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN p_points IS NULL OR jsonb_typeof(p_points) <> 'array' THEN p_points
    WHEN NOT EXISTS (SELECT 1 FROM public.privacy_places WHERE user_id = p_user) THEN p_points
    ELSE COALESCE((
      SELECT jsonb_agg(e ORDER BY ord)
        FROM jsonb_array_elements(p_points) WITH ORDINALITY AS t(e, ord)
       WHERE NOT EXISTS (
         SELECT 1 FROM public.privacy_places pp
          WHERE pp.user_id = p_user
            AND (e->>'lat') IS NOT NULL AND (e->>'lng') IS NOT NULL
            AND ST_DWithin(ST_SetSRID(ST_MakePoint((e->>'lng')::float8, (e->>'lat')::float8), 4326)::geography, pp.center, pp.radius_m)
       )), '[]'::jsonb)
  END;
$$;

CREATE FUNCTION public.effective_tier(p_tier text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN COALESCE((SELECT value = 'true'::jsonb FROM public.app_settings WHERE key = 'subscriptions_enabled'), false)
      THEN COALESCE(p_tier, 'free')
    ELSE 'premium'
  END
$$;

CREATE FUNCTION public.expire_lapsed_subscriptions() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE n integer;
BEGIN
  PERFORM set_config('runivo.trusted_writer', 'on', true);
  UPDATE public.profiles
     SET subscription_tier = 'free'
   WHERE subscription_tier = 'premium'
     AND subscription_expires_at IS NOT NULL
     AND subscription_expires_at < now() - interval '3 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE FUNCTION public.find_routes_nearby(p_lng double precision, p_lat double precision, p_radius_m double precision DEFAULT 5000) RETURNS TABLE(id uuid, user_id uuid, name text, emoji text, distance_m numeric, duration_sec integer, gps_points jsonb, is_public boolean, created_at timestamp with time zone, username text, dist_m double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select
    sr.id, sr.user_id, sr.name, sr.emoji,
    sr.distance_m, sr.duration_sec, sr.gps_points,
    sr.is_public, sr.created_at,
    p.username,
    ST_Distance(
      sr.route::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) as dist_m
  from public.saved_routes sr
  join public.profiles p on p.id = sr.user_id
  where sr.is_public = true
    and sr.route is not null
    and ST_DWithin(
          sr.route::geography,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
          p_radius_m
        )
  order by dist_m
  limit 20;
$$;

CREATE FUNCTION public.get_club_territory(p_club_id uuid) RETURNS TABLE(id uuid, owner_id uuid, owner_name text, polygon_coords jsonb, area_m2 double precision, freshness smallint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT t.id, t.owner_id, p.username,
         CASE WHEN public.zone_visible_to(auth.uid(), t.owner_id, t.near_private_place) THEN t.polygon_coords END,
         t.area_m2, t.freshness
    FROM public.territory_polygons t
    JOIN public.club_members m ON m.user_id = t.owner_id AND m.club_id = p_club_id
    JOIN public.profiles p ON p.id = t.owner_id
   LIMIT 2000;
$$;

CREATE FUNCTION public.get_comments(p_post_id uuid, lim integer DEFAULT 50) RETURNS TABLE(id uuid, user_id uuid, username text, avatar_color text, content text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT c.id, c.user_id, p.username, p.avatar_color,
         c.content, c.created_at
  FROM public.feed_post_comments c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.post_id = p_post_id
    AND c.hidden_at IS NULL
    AND NOT public.is_blocked_between(auth.uid(), c.user_id)
  ORDER BY c.created_at ASC
  LIMIT lim;
$$;

CREATE FUNCTION public.get_map_polygons(min_lat double precision, min_lng double precision, max_lat double precision, max_lng double precision) RETURNS TABLE(id uuid, owner_id uuid, owner_name text, area_m2 double precision, freshness smallint, last_defended_at timestamp with time zone, is_loop_fill boolean, tier text, polygon_coords jsonb)
    LANGUAGE sql STABLE
    AS $$
  SELECT
    tp.id,
    tp.owner_id,
    COALESCE(tp.owner_name, p.username) AS owner_name,
    tp.area_m2,
    tp.freshness,
    tp.last_defended_at,
    tp.is_loop_fill,
    tp.tier,
    tp.polygon_coords
  FROM territory_polygons tp
  JOIN profiles_public p ON p.id = tp.owner_id
  WHERE tp.geom IS NOT NULL
    AND tp.polygon_coords IS NOT NULL
    AND jsonb_array_length(tp.polygon_coords) >= 4
    AND ST_Intersects(
      tp.geom,
      ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    )
  LIMIT 500;
$$;

CREATE FUNCTION public.get_my_blocks_and_mutes() RETURNS TABLE(user_id uuid, username text, avatar_color text, kind text, since timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT b.blocked_id, p.username, p.avatar_color, 'blocked', b.created_at
    FROM public.user_blocks b JOIN public.profiles p ON p.id = b.blocked_id
   WHERE b.blocker_id = auth.uid()
  UNION ALL
  SELECT m.muted_id, p.username, p.avatar_color, 'muted', m.created_at
    FROM public.user_mutes m JOIN public.profiles p ON p.id = m.muted_id
   WHERE m.muter_id = auth.uid()
  ORDER BY 5 DESC;
$$;

CREATE FUNCTION public.get_my_privacy_places() RETURNS TABLE(id uuid, label text, radius_m integer, lat double precision, lng double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT id, label, radius_m, ST_Y(center::geometry), ST_X(center::geometry)
    FROM public.privacy_places WHERE user_id = auth.uid() ORDER BY created_at;
$$;

CREATE FUNCTION public.get_post_likers(p_post_id uuid, lim integer DEFAULT 3) RETURNS TABLE(id uuid, username text, avatar_url text, avatar_color text)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT p.id, p.username, p.avatar_url, p.avatar_color
  FROM public.feed_post_likes l
  JOIN public.profiles p ON p.id = l.user_id
  WHERE l.post_id = p_post_id
  ORDER BY l.created_at DESC
  LIMIT lim;
$$;

CREATE FUNCTION public.get_profile_stats(p_user_id uuid, p_period text DEFAULT 'all'::text) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_vis    TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    SELECT profile_visibility INTO v_vis FROM public.profiles WHERE id = p_user_id;
    IF NOT FOUND OR NOT public.can_view_profile(auth.uid(), p_user_id, v_vis) THEN
      RETURN json_build_object(
        'totalKm', 0, 'totalRuns', 0, 'avgPaceSec', 0, 'totalCalories', 0, 'totalZones', 0
      );
    END IF;
  END IF;

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
    FROM public.runs
    WHERE user_id = p_user_id AND started_at >= v_cutoff
  );
END;
$$;

CREATE FUNCTION public.get_user_profile_for_viewer(p_target_id uuid) RETURNS TABLE(username text, display_name text, bio text, location text, avatar_url text, avatar_color text, runner_rank text, total_runs integer, total_distance_km double precision, total_territories_claimed integer, follower_count integer, following_count integer, restricted boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_visibility TEXT;
  v_can_view   BOOLEAN;
BEGIN
  SELECT profile_visibility INTO v_visibility FROM profiles WHERE id = p_target_id;
  IF v_visibility IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = p_target_id AND blocked_id = auth.uid()) THEN
    RETURN; -- they blocked you: as if the profile did not exist
  END IF;

  v_can_view := (
    auth.uid() = p_target_id
    OR (
      NOT EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = auth.uid() AND blocked_id = p_target_id)
      AND (
        v_visibility = 'public'
        OR (v_visibility = 'followers' AND EXISTS (
          SELECT 1 FROM followers WHERE follower_id = auth.uid() AND following_id = p_target_id
        ))
      )
    )
  );

  IF v_can_view THEN
    RETURN QUERY
      SELECT p.username, p.display_name, p.bio, p.location,
             p.avatar_url, p.avatar_color, p.runner_rank,
             p.total_runs, p.total_distance_km::FLOAT8, p.total_territories_claimed,
             p.follower_count, p.following_count,
             FALSE
      FROM profiles p WHERE p.id = p_target_id;
  ELSE
    RETURN QUERY
      SELECT p.username, p.display_name, NULL::TEXT, NULL::TEXT,
             p.avatar_url, p.avatar_color, NULL::TEXT,
             NULL::INT, NULL::FLOAT8, NULL::INT,
             NULL::INT, NULL::INT,
             TRUE
      FROM profiles p WHERE p.id = p_target_id;
  END IF;
END;
$$;

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  base_username  text;
  final_username text;
  attempt        int := 0;
BEGIN
  base_username := COALESCE(
    NULLIF(trim(new.raw_user_meta_data->>'username'), ''),
    NULLIF(split_part(COALESCE(new.email, ''), '@', 1), '')
  );
  base_username := substring(regexp_replace(COALESCE(base_username, ''), '[^a-zA-Z0-9_]', '', 'g'), 1, 20);
  IF base_username = '' THEN
    base_username := 'runner';
  END IF;

  final_username := base_username;
  LOOP
    BEGIN
      INSERT INTO public.profiles (id, username)
      VALUES (new.id, final_username)
      ON CONFLICT (id) DO NOTHING;
      RETURN new;
    EXCEPTION WHEN unique_violation THEN
      attempt := attempt + 1;
      IF attempt > 10 THEN
        final_username := base_username || '_' || substring(replace(new.id::text, '-', ''), 1, 6);
        INSERT INTO public.profiles (id, username)
        VALUES (new.id, final_username)
        ON CONFLICT DO NOTHING;
        RETURN new;
      END IF;
      final_username := base_username || '_' || substring(md5(random()::text), 1, 4);
    END;
  END LOOP;
END;
$$;

CREATE FUNCTION public.mark_private_zone() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.near_private_place := NEW.owner_id IS NOT NULL AND public.zone_near_private_place(NEW.owner_id, NEW.geom);
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.normalize_profile_timezone() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.timezone IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN
    NEW.timezone := 'UTC';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.onboarding_activation(p_since timestamp with time zone DEFAULT (now() - '30 days'::interval)) RETURNS TABLE(variant text, signed_up integer, finished_onboarding integer, ran_within_24h integer, activation_pct numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH c AS (
    SELECT p.id, COALESCE(p.onboarding_variant, 'full') AS variant, p.created_at, p.onboarding_completed_at,
           EXISTS (SELECT 1 FROM runs r WHERE r.user_id = p.id AND r.started_at <= p.created_at + interval '24 hours'
                     AND r.distance_m >= 500) AS ran
      FROM profiles p
     WHERE p.created_at >= p_since AND p.created_at <= now() - interval '24 hours'
  )
  SELECT variant, count(*)::int, count(onboarding_completed_at)::int, count(*) FILTER (WHERE ran)::int,
         round(100.0 * count(*) FILTER (WHERE ran) / NULLIF(count(*), 0), 1)
    FROM c GROUP BY variant ORDER BY variant;
$$;

CREATE FUNCTION public.protect_device_provider_id() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;                                   -- service role / migrations
  END IF;

  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) - 'provider_user_id';
  IF TG_OP = 'UPDATE' AND OLD.metadata ? 'provider_user_id' THEN
    NEW.metadata := NEW.metadata || jsonb_build_object('provider_user_id', OLD.metadata -> 'provider_user_id');
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.protect_profile_columns() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.role() = 'service_role'
     OR current_setting('runivo.trusted_writer', true) = 'on' THEN
    RETURN NEW;
  END IF;

  NEW.subscription_tier       := OLD.subscription_tier;
  NEW.subscription_expires_at := OLD.subscription_expires_at;
  NEW.subscription_event_at   := OLD.subscription_event_at;
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

CREATE FUNCTION public.remove_privacy_place(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  DELETE FROM public.privacy_places WHERE id = p_id AND user_id = v_uid;
  PERFORM public.refresh_private_zones(v_uid);
  PERFORM public.refresh_post_routes(v_uid);
END;
$$;

CREATE FUNCTION public.set_default_activity_visibility(p_visibility text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF p_visibility NOT IN ('everyone', 'followers', 'only_me') THEN
    RAISE EXCEPTION 'visibility must be everyone, followers or only_me' USING ERRCODE = '22023';
  END IF;
  UPDATE public.profiles SET default_activity_visibility = p_visibility WHERE id = auth.uid();
END;
$$;

CREATE FUNCTION public.set_map_visibility(p_radius_m integer, p_hide_all boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n   integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF p_radius_m NOT IN (200, 400, 800, 1600) THEN
    RAISE EXCEPTION 'radius must be 200, 400, 800 or 1600 m' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
     SET map_hide_radius_m = p_radius_m,
         map_hide_all      = COALESCE(p_hide_all, false)
   WHERE id = v_uid;

  v_n := public.refresh_post_routes(v_uid, NULL);
  RETURN jsonb_build_object('radius_m', p_radius_m, 'hide_all', COALESCE(p_hide_all, false), 'posts_updated', v_n);
END;
$$;

CREATE FUNCTION public.set_privacy_controls(p_hide_from_leaderboards boolean, p_hide_zones_from_map boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  UPDATE public.profiles
     SET hide_from_leaderboards = COALESCE(p_hide_from_leaderboards, hide_from_leaderboards),
         hide_zones_from_map    = COALESCE(p_hide_zones_from_map, hide_zones_from_map)
   WHERE id = auth.uid();
END;
$$;

CREATE FUNCTION public.sync_energy(p_user_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  cur_energy   int;
  last_regen   timestamptz;
  gained       int;
  new_energy   int;
begin
  select energy, last_energy_regen
  into   cur_energy, last_regen
  from   public.profiles
  where  id = p_user_id;

  if not found then
    return 0;
  end if;

  -- 1 energy per hour = 1 per 3600 seconds (game scale: 0-10)
  gained := floor(extract(epoch from (now() - last_regen)) / 3600)::int;

  if gained <= 0 then
    return cur_energy;
  end if;

  new_energy := least(cur_energy + gained, 10);

  update public.profiles
  set    energy            = new_energy,
         last_energy_regen = now()
  where  id = p_user_id;

  return new_energy;
end;
$$;

CREATE FUNCTION public.touch_device_connection() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.view_safety_share(p_token text) RETURNS TABLE(username text, sport text, status text, lat double precision, lng double precision, position_at timestamp with time zone, distance_m numeric, elapsed_sec integer, started_at timestamp with time zone, ended_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p.username, s.sport,
         CASE WHEN s.ended_at IS NOT NULL THEN 'finished'
              WHEN s.position_at IS NULL OR s.position_at < now() - interval '2 minutes' THEN 'no_signal'
              ELSE 'live' END,
         -- Location only while live or within 30 minutes of the end.
         CASE WHEN s.ended_at IS NULL OR s.ended_at > now() - interval '30 minutes' THEN s.lat END,
         CASE WHEN s.ended_at IS NULL OR s.ended_at > now() - interval '30 minutes' THEN s.lng END,
         s.position_at, s.distance_m, s.elapsed_sec, s.started_at, s.ended_at
    FROM public.safety_shares s JOIN public.profiles p ON p.id = s.user_id
   WHERE s.token = p_token AND s.expires_at > now();
$$;

CREATE FUNCTION public.zone_near_private_place(p_owner uuid, p_geom public.geometry) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.privacy_places pp
     WHERE pp.user_id = p_owner AND ST_DWithin(p_geom::geography, pp.center, pp.radius_m)
  );
$$;

CREATE FUNCTION public.zone_visible_to(p_viewer uuid, p_owner uuid, p_near_private boolean) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p_owner = p_viewer
      OR (NOT p_near_private AND NOT COALESCE((SELECT hide_zones_from_map FROM public.profiles WHERE id = p_owner), false));
$$;


-- ── Foreign keys ──────────────────────────────────────────────────────

ALTER TABLE ONLY public.device_connections
    ADD CONSTRAINT device_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.privacy_places
    ADD CONSTRAINT privacy_places_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- ── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX device_connections_user_idx ON public.device_connections USING btree (user_id);

CREATE INDEX privacy_places_user_idx ON public.privacy_places USING btree (user_id);

CREATE INDEX profiles_location_idx ON public.profiles USING gist (last_known_location);

CREATE UNIQUE INDEX profiles_referral_code_key ON public.profiles USING btree (referral_code) WHERE (referral_code IS NOT NULL);


-- ── Triggers ──────────────────────────────────────────────────────────

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER device_connections_updated_at BEFORE UPDATE ON public.device_connections FOR EACH ROW EXECUTE FUNCTION public.touch_device_connection();

CREATE TRIGGER profiles_protect_columns BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_profiles_health_consent BEFORE INSERT OR UPDATE OF health_consent_at, health_baseline ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.clear_health_on_consent_withdrawal();

CREATE TRIGGER trg_profiles_timezone BEFORE INSERT OR UPDATE OF timezone ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.normalize_profile_timezone();

CREATE TRIGGER trg_protect_device_provider_id BEFORE INSERT OR UPDATE OF metadata ON public.device_connections FOR EACH ROW EXECUTE FUNCTION public.protect_device_provider_id();


-- ── Row-level security ────────────────────────────────────────────────

ALTER TABLE public.device_connections ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.privacy_places ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- ── Policies ──────────────────────────────────────────────────────────

CREATE POLICY "device_connections: owner deletes own" ON public.device_connections FOR DELETE TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY "device_connections: owner inserts own" ON public.device_connections FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "device_connections: owner reads own" ON public.device_connections FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY "device_connections: owner updates own" ON public.device_connections FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "privacy_places: own" ON public.privacy_places FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY "profiles: owner can insert" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));

CREATE POLICY "profiles: owner can update" ON public.profiles FOR UPDATE USING ((auth.uid() = id));

CREATE POLICY "profiles: owner reads own row" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));

CREATE POLICY "avatars: owner can list" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

CREATE POLICY "avatars: owner delete" ON storage.objects FOR DELETE USING (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

CREATE POLICY "avatars: owner update" ON storage.objects FOR UPDATE USING (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

CREATE POLICY "avatars: owner upload" ON storage.objects FOR INSERT WITH CHECK (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));


-- ── Comments ──────────────────────────────────────────────────────────

COMMENT ON FUNCTION public.sync_energy(p_user_id uuid) IS 'Applies time-based energy regen using server clock. Call on app foreground and run start.
   Returns the updated energy value. Rate: 1/hr, cap: 10 (game scale 0-10).';

COMMENT ON COLUMN public.device_connections.secrets IS 'Provider OAuth tokens (access_token, refresh_token, token_secret, pending_token_secret). Service-role only — never grant to anon/authenticated. metadata is the client-visible blob; secrets is not.';

COMMENT ON TABLE public.profiles IS 'Public player profile — one row per authenticated user.';

COMMENT ON COLUMN public.profiles.age IS 'Age in years — used for max heart rate (220-age) and BMR';

COMMENT ON COLUMN public.profiles.gender IS 'Biological sex — used for Mifflin-St Jeor BMR formula';

COMMENT ON COLUMN public.profiles.height_cm IS 'Height in centimetres — used for BMR and stride estimation';

COMMENT ON COLUMN public.profiles.weight_kg IS 'Body weight in kilograms — primary input for calorie calculation';

COMMENT ON COLUMN public.profiles.bio IS 'Short user bio (max 150 characters).';

COMMENT ON COLUMN public.profiles.location IS 'User location string, e.g. "New Delhi, India".';

COMMENT ON COLUMN public.profiles.avatar_color IS 'Avatar color scheme ID matching AVATAR_COLORS in the frontend.';

COMMENT ON COLUMN public.profiles.unlocked_achievements IS 'Array of achievement IDs the user has unlocked. Merged (union) on pull.';

COMMENT ON COLUMN public.profiles.foot_type IS 'Foot arch type from foot scan: flat | neutral | high.';

COMMENT ON COLUMN public.profiles.foot_scan_at IS 'Timestamp when the foot scan was completed.';

COMMENT ON COLUMN public.profiles.usual_distance_km IS 'Onboarding: usual run distance. Sets the starting weekly target and PaceX pace zones.';

COMMENT ON COLUMN public.profiles.recent_5k_seconds IS 'Onboarding (optional): recent 5K time in seconds. PaceX pace zones.';

COMMENT ON COLUMN public.profiles.pacex_tone IS 'How PaceX talks to the runner, from their running goal.';

COMMENT ON COLUMN public.profiles.age_range IS 'Onboarding (optional): age range. Calories and heart-rate zones only.';

COMMENT ON COLUMN public.profiles.health_consent_at IS 'When the runner agreed to share health-app data. NULL = no consent. Separate from terms acceptance.';

COMMENT ON COLUMN public.profiles.health_baseline IS '90-day summary of imported runs {runs,totalKm,avgWeeklyKm,runsPerWeek,longestKm,avgPaceSecPerKm,days}. Never claims zones.';

COMMENT ON COLUMN public.profiles.ai_consent_at IS 'When the runner agreed to send their run and fitness data to the third-party AI provider (Anthropic) for PaceX. NULL = no consent; the ai-coach function refuses.';

COMMENT ON COLUMN public.profiles.age_confirmed_at IS 'When this runner passed the age screen (13 or over). NULL = not asked yet. The birth date is not stored.';

COMMENT ON COLUMN public.profiles.run_days IS '0 = Monday … 6 = Sunday, the days the runner said they can run.';

COMMENT ON COLUMN public.profiles.niggles IS 'Self-reported sore spots; plans go cautious and PaceX avoids loading them. Owner-only.';


-- ── Grants ────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.drop_private_points(p_user uuid, p_points jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.drop_private_points(p_user uuid, p_points jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.expire_lapsed_subscriptions() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.expire_lapsed_subscriptions() TO service_role;

REVOKE ALL ON FUNCTION public.get_profile_stats(p_user_id uuid, p_period text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.get_profile_stats(p_user_id uuid, p_period text) TO authenticated;
GRANT ALL ON FUNCTION public.get_profile_stats(p_user_id uuid, p_period text) TO service_role;

REVOKE ALL ON FUNCTION public.get_user_profile_for_viewer(p_target_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.get_user_profile_for_viewer(p_target_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_profile_for_viewer(p_target_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.onboarding_activation(p_since timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.onboarding_activation(p_since timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.protect_device_provider_id() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.protect_device_provider_id() TO service_role;

REVOKE ALL ON FUNCTION public.view_safety_share(p_token text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.view_safety_share(p_token text) TO service_role;

REVOKE ALL ON FUNCTION public.zone_near_private_place(p_owner uuid, p_geom public.geometry) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.zone_near_private_place(p_owner uuid, p_geom public.geometry) TO service_role;

REVOKE ALL ON TABLE public.device_connections FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE ON TABLE public.device_connections TO authenticated;
GRANT ALL ON TABLE public.device_connections TO service_role;

GRANT SELECT(id) ON TABLE public.device_connections TO authenticated;

GRANT SELECT(user_id),INSERT(user_id) ON TABLE public.device_connections TO authenticated;

GRANT SELECT(device_type),INSERT(device_type) ON TABLE public.device_connections TO authenticated;

GRANT SELECT(status),INSERT(status),UPDATE(status) ON TABLE public.device_connections TO authenticated;

GRANT SELECT(last_sync_at),INSERT(last_sync_at),UPDATE(last_sync_at) ON TABLE public.device_connections TO authenticated;

GRANT SELECT(error_message),INSERT(error_message),UPDATE(error_message) ON TABLE public.device_connections TO authenticated;

GRANT SELECT(metadata),INSERT(metadata),UPDATE(metadata) ON TABLE public.device_connections TO authenticated;

GRANT SELECT(created_at) ON TABLE public.device_connections TO authenticated;

GRANT SELECT(updated_at) ON TABLE public.device_connections TO authenticated;


-- ── Storage buckets ────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ── Scheduled jobs (pg_cron) ────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('expire-lapsed-subscriptions', '17 3 * * *', $cmd$SELECT public.expire_lapsed_subscriptions()$cmd$);
  END IF;
END $$;

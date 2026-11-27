-- ========================================================================
-- Social
-- ========================================================================
-- Follows, feed posts, comments, likes, kudos and stories.
--
-- One file per feature: this file creates everything this feature owns
-- (tables, functions, triggers, row-level security, grants, scheduled jobs).
-- It needs only the files before it. Built from the 178 migrations up to
-- 20261117000012 (the 178 old files were removed after commit 9e5cf19; see git history); a fresh
-- database built from these files matches one built from those exactly.
--
-- Tables: feed_post_comments, feed_post_likes, feed_posts, followers, kudos, post_reports, stories

SET check_function_bodies = false;
SET client_min_messages = warning;
SET search_path = public, extensions;


-- ── Tables ────────────────────────────────────────────────────────────

CREATE TABLE public.feed_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    run_id uuid,
    content text,
    distance_km numeric(6,3),
    territories_claimed integer DEFAULT 0,
    likes integer DEFAULT 0 NOT NULL,
    comment_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    pace_earned integer DEFAULT 0 NOT NULL,
    territory_tier text,
    territory_area_m2 double precision,
    runner_rank text DEFAULT 'pacer'::text NOT NULL,
    post_type text DEFAULT 'run'::text NOT NULL,
    stolen_from_username text,
    stolen_area_m2 double precision,
    zone_tier text,
    stolen_from_user_id uuid,
    duration_sec integer DEFAULT 0 NOT NULL,
    avg_pace text DEFAULT ''::text NOT NULL,
    activity_type text DEFAULT 'run'::text NOT NULL,
    route_points jsonb,
    stolen_territory_id uuid,
    push_suppressed boolean DEFAULT false NOT NULL,
    map_hidden boolean DEFAULT false NOT NULL,
    title text,
    visibility text,
    photo_paths text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT feed_posts_visibility_check CHECK ((visibility = ANY (ARRAY['everyone'::text, 'followers'::text, 'only_me'::text])))
);

ALTER TABLE ONLY public.feed_posts REPLICA IDENTITY FULL;

CREATE TABLE public.feed_post_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    hidden_at timestamp with time zone,
    CONSTRAINT feed_post_comments_content_check CHECK (((char_length(content) >= 1) AND (char_length(content) <= 500)))
);

ALTER TABLE ONLY public.feed_post_comments REPLICA IDENTITY FULL;

CREATE TABLE public.feed_post_likes (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.followers (
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT followers_check CHECK ((follower_id <> following_id))
);

CREATE TABLE public.kudos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_id uuid NOT NULL,
    to_id uuid NOT NULL,
    run_id uuid,
    emoji text DEFAULT '👏'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT kudos_emoji_check CHECK ((emoji = ANY (ARRAY['👏'::text, '🔥'::text, '💪'::text, '⚡'::text, '🏆'::text])))
);

CREATE TABLE public.post_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    reporter_id uuid NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    CONSTRAINT post_reports_reason_check CHECK (((char_length(reason) >= 1) AND (char_length(reason) <= 300))),
    CONSTRAINT post_reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'actioned'::text, 'dismissed'::text])))
);

CREATE TABLE public.stories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    run_id text,
    image_url text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL
);


-- ── Keys and checks ───────────────────────────────────────────────────

ALTER TABLE ONLY public.feed_post_comments
    ADD CONSTRAINT feed_post_comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.feed_post_likes
    ADD CONSTRAINT feed_post_likes_pkey PRIMARY KEY (post_id, user_id);

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.followers
    ADD CONSTRAINT followers_pkey PRIMARY KEY (follower_id, following_id);

ALTER TABLE ONLY public.kudos
    ADD CONSTRAINT kudos_from_id_run_id_key UNIQUE (from_id, run_id);

ALTER TABLE ONLY public.kudos
    ADD CONSTRAINT kudos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.post_reports
    ADD CONSTRAINT post_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.post_reports
    ADD CONSTRAINT post_reports_post_id_reporter_id_key UNIQUE (post_id, reporter_id);

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_pkey PRIMARY KEY (id);


-- ── Functions ─────────────────────────────────────────────────────────

CREATE FUNCTION public.add_comment(p_post_id uuid, p_content text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.feed_post_comments (post_id, user_id, content)
  VALUES (p_post_id, auth.uid(), trim(p_content))
  RETURNING id INTO v_id;
  UPDATE public.feed_posts SET comment_count = comment_count + 1 WHERE id = p_post_id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.blur_feed_post_route() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.route_points IS NOT NULL AND jsonb_typeof(NEW.route_points) = 'array' THEN
    NEW.route_points := public.public_route_for(NEW.user_id, NEW.route_points, NEW.map_hidden);
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.blur_route(points jsonb, trim_m numeric DEFAULT 200, decimals integer DEFAULT 4) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  -- jsonb_array_elements raises on a non-array, and the WHERE clause would not run
  -- in time to prevent it — so normalise the input to an array first.
  WITH src AS (
    SELECT CASE WHEN jsonb_typeof(points) = 'array' THEN points ELSE '[]'::jsonb END AS arr
  ),
  pts AS (
    SELECT
      ord,
      (elem->>'lat')::float8 AS lat,
      (elem->>'lng')::float8 AS lng
    FROM src, jsonb_array_elements(src.arr) WITH ORDINALITY AS t(elem, ord)
    WHERE (elem->>'lat') IS NOT NULL
      AND (elem->>'lng') IS NOT NULL
  ),
  bounds AS (
    SELECT
      (SELECT ST_SetSRID(ST_MakePoint(lng, lat), 4326) FROM pts ORDER BY ord ASC  LIMIT 1) AS first_pt,
      (SELECT ST_SetSRID(ST_MakePoint(lng, lat), 4326) FROM pts ORDER BY ord DESC LIMIT 1) AS last_pt
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('lat', round(p.lat::numeric, decimals),
                         'lng', round(p.lng::numeric, decimals))
      ORDER BY p.ord
    ),
    '[]'::jsonb
  )
  FROM pts p, bounds b
  WHERE ST_DWithin(
          ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
          b.first_pt::geography, trim_m) IS FALSE
    AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
          b.last_pt::geography, trim_m) IS FALSE;
$$;

CREATE FUNCTION public.can_view_post(p_viewer uuid, p_author uuid, p_visibility text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p_viewer = p_author
      OR (
        p_viewer IS NOT NULL
        AND NOT public.is_blocked_between(p_viewer, p_author)
        AND (
          COALESCE(p_visibility, 'everyone') = 'everyone'
          OR (p_visibility = 'followers' AND EXISTS (
                SELECT 1 FROM public.followers WHERE follower_id = p_viewer AND following_id = p_author))
        )
      );
$$;

CREATE FUNCTION public.can_view_profile(p_viewer uuid, p_owner uuid, p_visibility text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p_viewer = p_owner
      OR (
        p_viewer IS NOT NULL
        AND NOT public.is_blocked_between(p_viewer, p_owner)
        AND (
          COALESCE(p_visibility, 'public') = 'public'
          OR (p_visibility = 'followers' AND EXISTS (
                SELECT 1 FROM public.followers WHERE follower_id = p_viewer AND following_id = p_owner))
        )
      );
$$;

CREATE FUNCTION public.delete_activity(p_run_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_uid uuid := auth.uid(); v_n integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.feed_posts WHERE run_id = p_run_id AND user_id = v_uid;
  DELETE FROM public.runs WHERE id = p_run_id AND user_id = v_uid;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;

CREATE FUNCTION public.feed_post_server_stats() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  RETURN public.feed_post_with_server_stats(NEW);
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE FUNCTION public.feed_post_with_server_stats(new public.feed_posts) RETURNS public.feed_posts
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_run    public.runs%ROWTYPE;
  v_result jsonb;
BEGIN

  IF COALESCE(NEW.post_type, 'run') NOT IN ('run', 'milestone') THEN
    RAISE EXCEPTION 'this kind of post is written by the server' USING ERRCODE = 'insufficient_privilege';
  END IF;

  NEW.likes := 0;
  NEW.comment_count := 0;
  NEW.stolen_from_username := NULL;
  NEW.stolen_from_user_id := NULL;
  NEW.stolen_area_m2 := NULL;
  NEW.stolen_territory_id := NULL;
  NEW.zone_tier := NULL;
  NEW.runner_rank := (SELECT runner_rank FROM public.profiles WHERE id = NEW.user_id);

  IF COALESCE(NEW.post_type, 'run') = 'run' THEN
    SELECT * INTO v_run FROM public.runs WHERE id = NEW.run_id;
    IF NOT FOUND OR v_run.user_id IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'a run post needs one of your own synced runs' USING ERRCODE = 'insufficient_privilege';
    END IF;
    SELECT result INTO v_result FROM public.run_processing WHERE run_id = NEW.run_id;
    NEW.distance_km   := round(v_run.distance_m / 1000.0, 3);
    NEW.duration_sec  := v_run.duration_sec;
    NEW.avg_pace      := v_run.avg_pace;
    NEW.activity_type := v_run.activity_type;
    NEW.pace_earned   := GREATEST(COALESCE((v_result ->> 'paceAdjustment')::numeric, 0), 0)::int;
    NEW.territories_claimed := COALESCE((v_result ->> 'newZonesClaimed')::int, 0);
    IF COALESCE((v_result ->> 'claimedAreaM2')::numeric, 0) > 0 THEN
      NEW.territory_area_m2 := (v_result ->> 'claimedAreaM2')::numeric;
    ELSE
      NEW.territory_area_m2 := NULL;
      NEW.territory_tier := NULL;
    END IF;
  ELSE
    -- Milestone: "my territory reached a new tier". Numbers from the zones held now.
    NEW.run_id := NULL;
    NEW.distance_km := 0;
    NEW.pace_earned := 0;
    NEW.territories_claimed := 0;
    SELECT COALESCE(sum(area_m2), 0) INTO NEW.territory_area_m2 FROM public.territory_polygons WHERE owner_id = NEW.user_id;
    IF NEW.territory_tier IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.territory_polygons WHERE owner_id = NEW.user_id AND tier = NEW.territory_tier) THEN
      RAISE EXCEPTION 'you do not hold a zone of that tier' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.fill_post_visibility() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.visibility IS NULL THEN
    SELECT COALESCE(default_activity_visibility, 'everyone') INTO NEW.visibility
      FROM public.profiles WHERE id = NEW.user_id;
    NEW.visibility := COALESCE(NEW.visibility, 'everyone');
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.get_club_feed(p_club uuid, lim integer DEFAULT 20, cursor_ts timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(id uuid, user_id uuid, run_id uuid, distance_km numeric, duration_sec integer, avg_pace text, activity_type text, route_points jsonb, territories_claimed integer, likes integer, comment_count integer, created_at timestamp with time zone, username text, avatar_url text, avatar_color text, pace_earned integer, territory_tier text, territory_area_m2 double precision, runner_rank text, post_type text, stolen_from_username text, stolen_area_m2 double precision, zone_tier text, stolen_from_user_id uuid, has_liked boolean, title text, content text, visibility text, photo_paths text[])
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    fp.id, fp.user_id, fp.run_id, fp.distance_km, fp.duration_sec, fp.avg_pace, fp.activity_type,
    CASE WHEN fp.map_hidden THEN NULL ELSE fp.route_points END,
    fp.territories_claimed, fp.likes, fp.comment_count, fp.created_at,
    p.username, p.avatar_url, p.avatar_color,
    fp.pace_earned, fp.territory_tier, fp.territory_area_m2, fp.runner_rank, fp.post_type,
    fp.stolen_from_username, fp.stolen_area_m2, fp.zone_tier, fp.stolen_from_user_id,
    EXISTS (SELECT 1 FROM feed_post_likes l WHERE l.post_id = fp.id AND l.user_id = auth.uid()),
    fp.title, fp.content, fp.visibility, fp.photo_paths
  FROM feed_posts fp
  JOIN profiles p ON p.id = fp.user_id
  WHERE EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = p_club AND m.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = p_club AND m.user_id = fp.user_id)
    AND fp.post_type IN ('run', 'conquest', 'milestone')
    AND (cursor_ts IS NULL OR fp.created_at < cursor_ts)
    AND fp.user_id NOT IN (SELECT hidden_user_ids(auth.uid()))
    AND can_view_post(auth.uid(), fp.user_id, fp.visibility)
  ORDER BY fp.created_at DESC
  LIMIT LEAST(lim, 50);
$$;

CREATE FUNCTION public.get_feed(lim integer DEFAULT 20, cursor_ts timestamp with time zone DEFAULT NULL::timestamp with time zone, discover boolean DEFAULT false) RETURNS TABLE(id uuid, user_id uuid, run_id uuid, distance_km numeric, duration_sec integer, avg_pace text, activity_type text, route_points jsonb, territories_claimed integer, likes integer, comment_count integer, created_at timestamp with time zone, username text, avatar_url text, avatar_color text, pace_earned integer, territory_tier text, territory_area_m2 double precision, runner_rank text, post_type text, stolen_from_username text, stolen_area_m2 double precision, zone_tier text, stolen_from_user_id uuid, has_liked boolean, title text, content text, visibility text, photo_paths text[])
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    fp.id, fp.user_id, fp.run_id,
    fp.distance_km, fp.duration_sec, fp.avg_pace, fp.activity_type, fp.route_points,
    fp.territories_claimed, fp.likes, fp.comment_count, fp.created_at,
    p.username, p.avatar_url, p.avatar_color,
    fp.pace_earned, fp.territory_tier, fp.territory_area_m2, fp.runner_rank,
    fp.post_type,
    fp.stolen_from_username, fp.stolen_area_m2, fp.zone_tier, fp.stolen_from_user_id,
    EXISTS(
      SELECT 1 FROM public.feed_post_likes l
      WHERE l.post_id = fp.id AND l.user_id = auth.uid()
    ) AS has_liked,
    fp.title, fp.content, fp.visibility, fp.photo_paths
  FROM public.feed_posts fp
  JOIN public.profiles p ON p.id = fp.user_id
  WHERE
    (cursor_ts IS NULL OR fp.created_at < cursor_ts)
    AND fp.user_id NOT IN (SELECT public.hidden_user_ids(auth.uid()))
    AND public.can_view_post(auth.uid(), fp.user_id, fp.visibility)
    AND (
      CASE WHEN discover THEN
        fp.user_id != auth.uid()
        AND fp.visibility = 'everyone'
        AND fp.user_id NOT IN (
          SELECT following_id FROM public.followers WHERE follower_id = auth.uid()
        )
        AND fp.post_type IN ('run', 'conquest')
      ELSE
        fp.user_id = auth.uid()
        OR (
          fp.user_id IN (
            SELECT following_id FROM public.followers WHERE follower_id = auth.uid()
          )
          AND fp.post_type IN ('run', 'conquest', 'milestone')
        )
      END
    )
  ORDER BY fp.created_at DESC
  LIMIT lim;
$$;

CREATE FUNCTION public.get_my_feed(lim integer DEFAULT 20, cursor_ts timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(id uuid, user_id uuid, run_id uuid, distance_km numeric, duration_sec integer, avg_pace text, activity_type text, route_points jsonb, territories_claimed integer, likes integer, comment_count integer, created_at timestamp with time zone, username text, avatar_url text, avatar_color text, pace_earned integer, territory_tier text, territory_area_m2 double precision, runner_rank text, post_type text, stolen_from_username text, stolen_area_m2 double precision, zone_tier text, stolen_from_user_id uuid, has_liked boolean, title text, content text, visibility text, photo_paths text[])
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    fp.id, fp.user_id, fp.run_id,
    fp.distance_km, fp.duration_sec, fp.avg_pace, fp.activity_type, fp.route_points,
    fp.territories_claimed, fp.likes, fp.comment_count, fp.created_at,
    p.username, p.avatar_url, p.avatar_color,
    fp.pace_earned, fp.territory_tier, fp.territory_area_m2, fp.runner_rank,
    fp.post_type,
    fp.stolen_from_username, fp.stolen_area_m2, fp.zone_tier, fp.stolen_from_user_id,
    EXISTS(
      SELECT 1 FROM public.feed_post_likes l
      WHERE l.post_id = fp.id AND l.user_id = auth.uid()
    ) AS has_liked,
    fp.title, fp.content, fp.visibility, fp.photo_paths
  FROM public.feed_posts fp
  JOIN public.profiles p ON p.id = fp.user_id
  WHERE
    fp.user_id = auth.uid()
    AND (cursor_ts IS NULL OR fp.created_at < cursor_ts)
  ORDER BY fp.created_at DESC
  LIMIT lim;
$$;

CREATE FUNCTION public.get_post_companions(p_post_ids uuid[]) RETURNS TABLE(post_id uuid, user_id uuid, username text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH mine AS (
    SELECT fp.id AS post_id, r.id AS run_id, r.user_id, r.started_at,
           ST_SetSRID(ST_MakePoint((r.gps_points->0->>'lng')::float8, (r.gps_points->0->>'lat')::float8), 4326)::geography AS start_pt
      FROM feed_posts fp JOIN runs r ON r.id = fp.run_id
     WHERE fp.id = ANY (p_post_ids) AND jsonb_array_length(COALESCE(r.gps_points, '[]'::jsonb)) > 0
       AND can_view_post(auth.uid(), fp.user_id, fp.visibility)
  )
  SELECT DISTINCT m.post_id, o.user_id, p.username
    FROM mine m
    JOIN runs o ON o.user_id <> m.user_id
               AND o.started_at BETWEEN m.started_at - interval '5 minutes' AND m.started_at + interval '5 minutes'
               AND jsonb_array_length(COALESCE(o.gps_points, '[]'::jsonb)) > 0
    JOIN feed_posts ofp ON ofp.run_id = o.id
    JOIN profiles p ON p.id = o.user_id
   WHERE ST_DWithin(m.start_pt,
           ST_SetSRID(ST_MakePoint((o.gps_points->0->>'lng')::float8, (o.gps_points->0->>'lat')::float8), 4326)::geography, 100)
     AND can_view_post(auth.uid(), o.user_id, ofp.visibility)
     AND o.user_id NOT IN (SELECT hidden_user_ids(auth.uid()));
$$;

CREATE FUNCTION public.notify_comment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  post_owner     uuid;
  commenter_name text;
begin
  select user_id into post_owner from public.feed_posts where id = new.post_id;

  if post_owner is null or post_owner = new.user_id then
    return new;
  end if;

  select username into commenter_name from public.profiles where id = new.user_id;

  insert into public.notifications (user_id, type, title, body, action_url)
  values (
    post_owner,
    'comment',
    coalesce(commenter_name, 'A runner') || ' commented on your run',
    left(new.content, 140),
    '/feed?post=' || new.post_id::text
  );

  return new;
end;
$$;

CREATE FUNCTION public.notify_follow() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  follower_name text;
begin
  -- Resolve the follower's display name
  select username into follower_name
  from public.profiles
  where id = new.follower_id;

  insert into public.notifications (user_id, type, title, body, action_url)
  values (
    new.following_id,
    'follow',
    follower_name || ' started following you',
    'Check out their profile and follow back!',
    '/profile/' || new.follower_id::text
  );

  return new;
end;
$$;

CREATE FUNCTION public.notify_kudos() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  post_owner uuid;
  liker_name text;
  v_url      text := '/feed?post=' || NEW.post_id::text;
  v_existing uuid;
  v_count    integer;
BEGIN
  SELECT user_id INTO post_owner FROM public.feed_posts WHERE id = NEW.post_id;
  IF post_owner IS NULL OR post_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT username INTO liker_name FROM public.profiles WHERE id = NEW.user_id;
  liker_name := COALESCE(liker_name, 'A runner');

  -- An unread kudos notification for this post from the last day: fold into it.
  SELECT id, group_count INTO v_existing, v_count
    FROM public.notifications
   WHERE user_id = post_owner AND type = 'kudos' AND action_url = v_url
     AND NOT read AND created_at > now() - interval '1 day'
   ORDER BY created_at DESC LIMIT 1
   FOR UPDATE;

  IF v_existing IS NOT NULL THEN
    UPDATE public.notifications
       SET group_count = v_count + 1,
           title = liker_name || ' and ' || v_count || CASE WHEN v_count = 1 THEN ' other' ELSE ' others' END || ' gave kudos',
           body = 'Tap to see the post.'
     WHERE id = v_existing;
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, action_url)
  VALUES (post_owner, 'kudos', liker_name || ' gave kudos on your run', 'Tap to see the post.', v_url);
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.refresh_post_routes(p_user uuid, p_run_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  n_raw    integer;
  n_stored integer;
BEGIN
  UPDATE public.feed_posts fp
     SET route_points = (
           SELECT jsonb_agg(jsonb_build_object('lat', e->'lat', 'lng', e->'lng') ORDER BY ord)
             FROM jsonb_array_elements(r.gps_points) WITH ORDINALITY AS t(e, ord)
            WHERE e ? 'lat' AND e ? 'lng')
    FROM public.runs r
   WHERE fp.user_id = p_user
     AND (p_run_id IS NULL OR fp.run_id = p_run_id)
     AND fp.route_points IS NOT NULL
     AND r.id = fp.run_id
     AND r.user_id = p_user
     AND jsonb_typeof(r.gps_points) = 'array'
     AND jsonb_array_length(r.gps_points) > 1;
  GET DIAGNOSTICS n_raw = ROW_COUNT;

  UPDATE public.feed_posts fp
     SET route_points = fp.route_points
   WHERE fp.user_id = p_user
     AND (p_run_id IS NULL OR fp.run_id = p_run_id)
     AND fp.route_points IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.runs r
        WHERE r.id = fp.run_id AND r.user_id = p_user
          AND jsonb_typeof(r.gps_points) = 'array'
          AND jsonb_array_length(r.gps_points) > 1);
  GET DIAGNOSTICS n_stored = ROW_COUNT;

  RETURN n_raw + n_stored;
END;
$$;

CREATE FUNCTION public.report_post(p_post_id uuid, p_reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.post_reports (post_id, reporter_id, reason)
  VALUES (p_post_id, auth.uid(), trim(p_reason))
  ON CONFLICT (post_id, reporter_id) DO NOTHING;
END;
$$;

CREATE FUNCTION public.run_kudos_count(run_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select count(*)::int from public.kudos where kudos.run_id = run_kudos_count.run_id;
$$;

CREATE FUNCTION public.set_activity_photos(p_run_id uuid, p_paths text[]) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_paths  text[] := COALESCE(p_paths, '{}');
  v_prefix text;
  v_p      text;
  v_n      integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF cardinality(v_paths) > 6 THEN RAISE EXCEPTION 'at most 6 photos' USING ERRCODE = '22023'; END IF;
  v_prefix := v_uid::text || '/' || p_run_id::text || '/';
  FOREACH v_p IN ARRAY v_paths LOOP
    IF left(v_p, length(v_prefix)) <> v_prefix OR v_p ~ '\.\.' OR length(v_p) > 200 THEN
      RAISE EXCEPTION 'photo path outside your folder' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  UPDATE public.runs SET photo_paths = v_paths WHERE id = p_run_id AND user_id = v_uid;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  UPDATE public.feed_posts SET photo_paths = v_paths WHERE run_id = p_run_id AND user_id = v_uid;
  RETURN v_n > 0;
END;
$$;

CREATE FUNCTION public.suggest_runners_nearby(lim integer DEFAULT 5) RETURNS TABLE(id uuid, username text, avatar_url text, avatar_color text, total_distance_km numeric, territory_score integer, distance_km double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH me AS (SELECT last_known_location AS loc FROM profiles WHERE id = auth.uid())
  SELECT p.id, p.username, p.avatar_url, p.avatar_color, p.total_distance_km::numeric, p.territory_score::int,
         CASE WHEN ST_DWithin(p.last_known_location::geography, me.loc::geography, 2000) THEN 2
              WHEN ST_DWithin(p.last_known_location::geography, me.loc::geography, 5000) THEN 5
              ELSE 15 END::float8
    FROM profiles p, me
   WHERE me.loc IS NOT NULL AND p.last_known_location IS NOT NULL
     AND p.id <> auth.uid()
     AND NOT p.hide_from_leaderboards
     AND COALESCE(p.profile_visibility, 'public') = 'public'
     AND p.id NOT IN (SELECT following_id FROM followers WHERE follower_id = auth.uid())
     AND p.id NOT IN (SELECT hidden_user_ids(auth.uid()))
     AND ST_DWithin(p.last_known_location::geography, me.loc::geography, 15000)
   ORDER BY p.territory_score DESC NULLS LAST, p.total_runs DESC
   LIMIT LEAST(lim, 10);
$$;

CREATE FUNCTION public.sync_comment_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if tg_op = 'INSERT' then
    update public.feed_posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.feed_posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
  end if;
  return null;
end;
$$;

CREATE FUNCTION public.sync_follow_counts() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set follower_count  = follower_count  + 1 where id = new.following_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set following_count = greatest(0, following_count - 1) where id = old.follower_id;
    update public.profiles set follower_count  = greatest(0, follower_count  - 1) where id = old.following_id;
  end if;
  return null;
end;
$$;

CREATE FUNCTION public.toggle_follow(target_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  already boolean;
begin
  select exists(
    select 1 from public.followers
    where follower_id = auth.uid() and following_id = target_id
  ) into already;

  if already then
    delete from public.followers
      where follower_id = auth.uid() and following_id = target_id;
    return false;
  else
    insert into public.followers (follower_id, following_id)
      values (auth.uid(), target_id);
    return true;
  end if;
end;
$$;

CREATE FUNCTION public.toggle_like(p_post_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_uid    UUID    := auth.uid();
  v_exists BOOLEAN;
  v_count  INT;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.feed_post_likes
    WHERE post_id = p_post_id AND user_id = v_uid
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.feed_post_likes
      WHERE post_id = p_post_id AND user_id = v_uid;
    UPDATE public.feed_posts
      SET likes = GREATEST(0, likes - 1) WHERE id = p_post_id;
  ELSE
    INSERT INTO public.feed_post_likes (post_id, user_id) VALUES (p_post_id, v_uid);
    UPDATE public.feed_posts
      SET likes = likes + 1 WHERE id = p_post_id;
  END IF;

  SELECT likes INTO v_count FROM public.feed_posts WHERE id = p_post_id;
  RETURN json_build_object('liked', NOT v_exists, 'count', v_count);
END;
$$;


-- ── Views ─────────────────────────────────────────────────────────────

CREATE VIEW public.profiles_public WITH (security_invoker=off) AS
 SELECT p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.avatar_color,
        CASE
            WHEN v.ok THEN p.bio
            ELSE NULL::text
        END AS bio,
        CASE
            WHEN v.ok THEN p.location
            ELSE NULL::text
        END AS location,
        CASE
            WHEN v.ok THEN p.instagram
            ELSE NULL::text
        END AS instagram,
        CASE
            WHEN v.ok THEN p.strava
            ELSE NULL::text
        END AS strava,
    p.level,
    p.runner_rank,
    p.territory_score,
    p.pace_total_earned,
    (
        CASE
            WHEN v.ok THEN p.total_distance_km
            ELSE NULL::numeric
        END)::numeric(10,3) AS total_distance_km,
        CASE
            WHEN v.ok THEN p.total_runs
            ELSE NULL::integer
        END AS total_runs,
        CASE
            WHEN v.ok THEN p.total_territories_claimed
            ELSE NULL::integer
        END AS total_territories_claimed,
        CASE
            WHEN v.ok THEN p.streak_days
            ELSE NULL::integer
        END AS streak_days,
        CASE
            WHEN v.ok THEN p.follower_count
            ELSE NULL::integer
        END AS follower_count,
        CASE
            WHEN v.ok THEN p.following_count
            ELSE NULL::integer
        END AS following_count,
    p.country,
        CASE
            WHEN v.ok THEN p.unlocked_achievements
            ELSE NULL::text[]
        END AS unlocked_achievements,
        CASE
            WHEN v.ok THEN p.pinned_run_id
            ELSE NULL::uuid
        END AS pinned_run_id,
    p.created_at
   FROM (public.profiles p
     CROSS JOIN LATERAL ( SELECT ((auth.role() = 'service_role'::text) OR public.can_view_profile(auth.uid(), p.id, p.profile_visibility)) AS ok) v);


-- ── Foreign keys ──────────────────────────────────────────────────────

ALTER TABLE ONLY public.feed_post_comments
    ADD CONSTRAINT feed_post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.feed_posts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.feed_post_comments
    ADD CONSTRAINT feed_post_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.feed_post_likes
    ADD CONSTRAINT feed_post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.feed_posts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.feed_post_likes
    ADD CONSTRAINT feed_post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_stolen_from_user_id_fkey FOREIGN KEY (stolen_from_user_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_stolen_territory_id_fkey FOREIGN KEY (stolen_territory_id) REFERENCES public.territory_polygons(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.followers
    ADD CONSTRAINT followers_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.followers
    ADD CONSTRAINT followers_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kudos
    ADD CONSTRAINT kudos_from_id_fkey FOREIGN KEY (from_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kudos
    ADD CONSTRAINT kudos_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kudos
    ADD CONSTRAINT kudos_to_id_fkey FOREIGN KEY (to_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.post_reports
    ADD CONSTRAINT post_reports_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.feed_posts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.post_reports
    ADD CONSTRAINT post_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- ── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX feed_post_comments_post_id_idx ON public.feed_post_comments USING btree (post_id, created_at);

CREATE INDEX feed_posts_created_at_idx ON public.feed_posts USING btree (created_at DESC);

CREATE INDEX feed_posts_user_id_idx ON public.feed_posts USING btree (user_id);

CREATE INDEX followers_follower_id_idx ON public.followers USING btree (follower_id);

CREATE INDEX followers_following_id_idx ON public.followers USING btree (following_id);

CREATE INDEX kudos_run_id_idx ON public.kudos USING btree (run_id);

CREATE INDEX kudos_to_id_idx ON public.kudos USING btree (to_id, created_at DESC);

CREATE INDEX post_reports_post_id_idx ON public.post_reports USING btree (post_id);

CREATE INDEX stories_expires_at_idx ON public.stories USING btree (expires_at);

CREATE INDEX stories_user_id_idx ON public.stories USING btree (user_id);


-- ── Triggers ──────────────────────────────────────────────────────────

CREATE TRIGGER comments_refuse_blocked BEFORE INSERT ON public.feed_post_comments FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_interaction();

CREATE TRIGGER feed_posts_a_server_stats BEFORE INSERT ON public.feed_posts FOR EACH ROW EXECUTE FUNCTION public.feed_post_server_stats();

CREATE TRIGGER feed_posts_blur_route BEFORE INSERT OR UPDATE OF route_points, map_hidden ON public.feed_posts FOR EACH ROW EXECUTE FUNCTION public.blur_feed_post_route();

CREATE TRIGGER feed_posts_fill_visibility BEFORE INSERT ON public.feed_posts FOR EACH ROW EXECUTE FUNCTION public.fill_post_visibility();

CREATE TRIGGER followers_refuse_blocked BEFORE INSERT ON public.followers FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_follow();

CREATE TRIGGER likes_refuse_blocked BEFORE INSERT ON public.feed_post_likes FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_interaction();

CREATE TRIGGER trg_banned_comments BEFORE INSERT ON public.feed_post_comments FOR EACH ROW EXECUTE FUNCTION public.reject_if_banned();

CREATE TRIGGER trg_banned_posts BEFORE INSERT ON public.feed_posts FOR EACH ROW EXECUTE FUNCTION public.reject_if_banned();

CREATE TRIGGER trg_filter_comments BEFORE INSERT ON public.feed_post_comments FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_text('content');

CREATE TRIGGER trg_notify_comment AFTER INSERT ON public.feed_post_comments FOR EACH ROW EXECUTE FUNCTION public.notify_comment();

CREATE TRIGGER trg_notify_follow AFTER INSERT ON public.followers FOR EACH ROW EXECUTE FUNCTION public.notify_follow();

CREATE TRIGGER trg_notify_kudos AFTER INSERT ON public.feed_post_likes FOR EACH ROW EXECUTE FUNCTION public.notify_kudos();

CREATE TRIGGER trg_notify_kudos AFTER INSERT ON public.kudos FOR EACH ROW EXECUTE FUNCTION public.notify_kudos();

CREATE TRIGGER trg_sync_comment_count AFTER INSERT OR DELETE ON public.feed_post_comments FOR EACH ROW EXECUTE FUNCTION public.sync_comment_count();

CREATE TRIGGER trg_sync_follow_counts AFTER INSERT OR DELETE ON public.followers FOR EACH ROW EXECUTE FUNCTION public.sync_follow_counts();


-- ── Row-level security ────────────────────────────────────────────────

ALTER TABLE public.feed_post_comments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.feed_post_likes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.kudos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;


-- ── Policies ──────────────────────────────────────────────────────────

CREATE POLICY comments_delete ON public.feed_post_comments FOR DELETE USING ((user_id = auth.uid()));

CREATE POLICY comments_read ON public.feed_post_comments FOR SELECT USING (true);

CREATE POLICY comments_write ON public.feed_post_comments FOR INSERT WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "feed_post_comments: anyone can read" ON public.feed_post_comments FOR SELECT USING (true);

CREATE POLICY "feed_post_comments: authenticated can post" ON public.feed_post_comments FOR INSERT WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "feed_post_comments: owner can delete" ON public.feed_post_comments FOR DELETE USING ((auth.uid() = user_id));

CREATE POLICY "feed_post_likes: anyone can read" ON public.feed_post_likes FOR SELECT USING (true);

CREATE POLICY "feed_post_likes: owner can delete" ON public.feed_post_likes FOR DELETE USING ((auth.uid() = user_id));

CREATE POLICY "feed_post_likes: owner can insert" ON public.feed_post_likes FOR INSERT WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "feed_posts: owner can delete" ON public.feed_posts FOR DELETE USING ((auth.uid() = user_id));

CREATE POLICY "feed_posts: owner can insert" ON public.feed_posts FOR INSERT WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "feed_posts: visible to viewer" ON public.feed_posts FOR SELECT TO authenticated USING (public.can_view_post(auth.uid(), user_id, visibility));

CREATE POLICY "followers: anyone can read" ON public.followers FOR SELECT USING (true);

CREATE POLICY "followers: self can follow" ON public.followers FOR INSERT WITH CHECK ((auth.uid() = follower_id));

CREATE POLICY "followers: self can unfollow" ON public.followers FOR DELETE USING ((auth.uid() = follower_id));

CREATE POLICY "kudos: anyone can read" ON public.kudos FOR SELECT USING (true);

CREATE POLICY "kudos: authenticated can send" ON public.kudos FOR INSERT WITH CHECK (((auth.uid() = from_id) AND (from_id <> to_id)));

CREATE POLICY "kudos: sender can delete" ON public.kudos FOR DELETE USING ((auth.uid() = from_id));

CREATE POLICY "live_run_positions: mutual connections can read while live" ON public.live_run_positions FOR SELECT TO authenticated USING (((updated_at > (now() - '00:00:30'::interval)) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = live_run_positions.user_id) AND (p.live_run_sharing_enabled = true)))) AND (EXISTS ( SELECT 1
   FROM public.followers
  WHERE ((followers.follower_id = auth.uid()) AND (followers.following_id = live_run_positions.user_id)))) AND (EXISTS ( SELECT 1
   FROM public.followers
  WHERE ((followers.follower_id = live_run_positions.user_id) AND (followers.following_id = auth.uid()))))));

CREATE POLICY "post_reports: self can file" ON public.post_reports FOR INSERT WITH CHECK ((auth.uid() = reporter_id));

CREATE POLICY stories_delete ON public.stories FOR DELETE TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY stories_insert ON public.stories FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY stories_select ON public.stories FOR SELECT TO authenticated USING ((expires_at > now()));

CREATE POLICY "feed: owner can list" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'feed'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

CREATE POLICY "feed: owner delete" ON storage.objects FOR DELETE USING (((bucket_id = 'feed'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

CREATE POLICY "feed: owner upload" ON storage.objects FOR INSERT WITH CHECK (((bucket_id = 'feed'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

CREATE POLICY "feed: readable with the post" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'feed'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM public.feed_posts fp
  WHERE (((fp.run_id)::text = (storage.foldername(objects.name))[2]) AND ((fp.user_id)::text = (storage.foldername(objects.name))[1]) AND public.can_view_post(auth.uid(), fp.user_id, fp.visibility)))))));

CREATE POLICY "stories: owner can list" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'stories'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

CREATE POLICY stories_storage_delete ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'stories'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

CREATE POLICY stories_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'stories'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

CREATE POLICY stories_storage_select ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'stories'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));


-- ── Comments ──────────────────────────────────────────────────────────

COMMENT ON FUNCTION public.blur_route(points jsonb, trim_m numeric, decimals integer) IS 'Removes the start/end anchor points and reduces precision of a [{lat,lng}] route before it is exposed to other users. See 20260723000004_blur_feed_routes.sql.';

COMMENT ON TABLE public.feed_posts IS 'Social feed posts — one created automatically after each run.';

COMMENT ON COLUMN public.feed_posts.pace_earned IS 'PACE tokens earned in this run';

COMMENT ON COLUMN public.feed_posts.territory_tier IS 'Highest tier territory claimed: patch|block|district|quarter|domain';

COMMENT ON COLUMN public.feed_posts.territory_area_m2 IS 'Area of territory polygon in m²';

COMMENT ON COLUMN public.feed_posts.runner_rank IS 'Runner rank at time of post';

COMMENT ON TABLE public.feed_post_comments IS 'Comments on feed posts.';

COMMENT ON TABLE public.feed_post_likes IS 'Per-user like records; counter on feed_posts kept in sync via toggle_like().';

COMMENT ON TABLE public.followers IS 'Social follow graph — directed edges between profiles.';

COMMENT ON TABLE public.kudos IS 'Emoji kudos sent between runners for specific runs.';

COMMENT ON TABLE public.post_reports IS 'User-filed reports on feed posts. Moderation input only — no client SELECT policy.';

COMMENT ON VIEW public.profiles_public IS 'Non-sensitive projection of profiles for leaderboards, feed, clubs and other-user profile screens. Never add PII (phone, biometrics, location) or private economy columns here — see 20260723000001_profiles_pii_lockdown.sql.';


-- ── Grants ────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.can_view_profile(p_viewer uuid, p_owner uuid, p_visibility text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.can_view_profile(p_viewer uuid, p_owner uuid, p_visibility text) TO authenticated;
GRANT ALL ON FUNCTION public.can_view_profile(p_viewer uuid, p_owner uuid, p_visibility text) TO service_role;

REVOKE ALL ON FUNCTION public.feed_post_with_server_stats(new public.feed_posts) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.feed_post_with_server_stats(new public.feed_posts) TO authenticated;
GRANT ALL ON FUNCTION public.feed_post_with_server_stats(new public.feed_posts) TO service_role;

REVOKE ALL ON FUNCTION public.get_club_feed(p_club uuid, lim integer, cursor_ts timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.get_club_feed(p_club uuid, lim integer, cursor_ts timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.get_club_feed(p_club uuid, lim integer, cursor_ts timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.get_post_companions(p_post_ids uuid[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.get_post_companions(p_post_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.get_post_companions(p_post_ids uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.refresh_post_routes(p_user uuid, p_run_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.refresh_post_routes(p_user uuid, p_run_id uuid) TO anon;
GRANT ALL ON FUNCTION public.refresh_post_routes(p_user uuid, p_run_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.suggest_runners_nearby(lim integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.suggest_runners_nearby(lim integer) TO authenticated;
GRANT ALL ON FUNCTION public.suggest_runners_nearby(lim integer) TO service_role;

REVOKE ALL ON TABLE public.profiles_public FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles_public TO authenticated;
GRANT ALL ON TABLE public.profiles_public TO service_role;


-- ── Storage buckets ────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('feed', 'feed', false, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('stories', 'stories', false, 5242880, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ── Realtime ───────────────────────────────────────────────────────────

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_post_comments; EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_posts; EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END;
END $$;

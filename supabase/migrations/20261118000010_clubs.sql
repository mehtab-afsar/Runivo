-- ========================================================================
-- Clubs and chat
-- ========================================================================
-- Clubs, members, join requests, club chat and lobbies.
--
-- One file per feature: this file creates everything this feature owns
-- (tables, functions, triggers, row-level security, grants, scheduled jobs).
-- It needs only the files before it. Built from the 178 migrations up to
-- 20261117000012 (the 178 old files were removed after commit 9e5cf19; see git history); a fresh
-- database built from these files matches one built from those exactly.
--
-- Tables: club_activity, club_bans, club_join_requests, club_locations, club_members, club_message_reports, club_messages, clubs, lobbies, lobby_messages

SET check_function_bodies = false;
SET client_min_messages = warning;
SET search_path = public, extensions;


-- ── Tables ────────────────────────────────────────────────────────────

CREATE TABLE public.club_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    user_id uuid NOT NULL,
    username text NOT NULL,
    action text NOT NULL,
    detail text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT club_activity_action_check CHECK ((action = ANY (ARRAY['captured'::text, 'lost'::text, 'defended'::text, 'joined'::text, 'leveled_up'::text])))
);

CREATE TABLE public.club_bans (
    club_id uuid NOT NULL,
    user_id uuid NOT NULL,
    banned_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.club_join_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT club_join_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])))
);

CREATE TABLE public.club_locations (
    club_id uuid NOT NULL,
    home_location public.geography(Point,4326) NOT NULL,
    city text,
    source text DEFAULT 'creator'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT club_locations_source_check CHECK ((source = ANY (ARRAY['creator'::text, 'owner_set'::text])))
);

CREATE TABLE public.club_members (
    club_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT club_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))
);

CREATE TABLE public.club_message_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    club_id uuid NOT NULL,
    reporter_id uuid NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    CONSTRAINT club_message_reports_reason_check CHECK ((reason = ANY (ARRAY['spam'::text, 'harassment'::text, 'inappropriate'::text, 'other'::text]))),
    CONSTRAINT club_message_reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'actioned'::text, 'dismissed'::text])))
);

CREATE TABLE public.club_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.club_messages REPLICA IDENTITY FULL;

CREATE TABLE public.clubs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    badge_emoji text DEFAULT '🏃'::text NOT NULL,
    owner_id uuid NOT NULL,
    join_policy text DEFAULT 'open'::text NOT NULL,
    member_count integer DEFAULT 0 NOT NULL,
    total_km numeric(12,3) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_url text,
    banner_url text,
    CONSTRAINT clubs_image_urls_https CHECK ((((avatar_url IS NULL) OR (avatar_url ~ '^https://'::text)) AND ((banner_url IS NULL) OR (banner_url ~ '^https://'::text)))),
    CONSTRAINT clubs_join_policy_check CHECK ((join_policy = ANY (ARRAY['open'::text, 'invite_only'::text])))
);

CREATE TABLE public.lobbies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid,
    name text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lobbies_status_check CHECK ((status = ANY (ARRAY['open'::text, 'active'::text, 'closed'::text])))
);

ALTER TABLE ONLY public.lobbies REPLICA IDENTITY FULL;

CREATE TABLE public.lobby_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lobby_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.lobby_messages REPLICA IDENTITY FULL;


-- ── Keys and checks ───────────────────────────────────────────────────

ALTER TABLE ONLY public.club_activity
    ADD CONSTRAINT club_activity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.club_bans
    ADD CONSTRAINT club_bans_pkey PRIMARY KEY (club_id, user_id);

ALTER TABLE ONLY public.club_join_requests
    ADD CONSTRAINT club_join_requests_club_id_user_id_key UNIQUE (club_id, user_id);

ALTER TABLE ONLY public.club_join_requests
    ADD CONSTRAINT club_join_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.club_locations
    ADD CONSTRAINT club_locations_pkey PRIMARY KEY (club_id);

ALTER TABLE ONLY public.club_members
    ADD CONSTRAINT club_members_pkey PRIMARY KEY (club_id, user_id);

ALTER TABLE ONLY public.club_message_reports
    ADD CONSTRAINT club_message_reports_message_id_reporter_id_key UNIQUE (message_id, reporter_id);

ALTER TABLE ONLY public.club_message_reports
    ADD CONSTRAINT club_message_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.club_messages
    ADD CONSTRAINT club_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_name_key UNIQUE (name);

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.lobbies
    ADD CONSTRAINT lobbies_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.lobby_messages
    ADD CONSTRAINT lobby_messages_pkey PRIMARY KEY (id);


-- ── Functions ─────────────────────────────────────────────────────────

CREATE FUNCTION public.accept_club_join_request(request_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_club_id uuid;
  v_user_id uuid;
BEGIN
  SELECT club_id, user_id INTO v_club_id, v_user_id
  FROM public.club_join_requests
  WHERE id = request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = v_club_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.club_join_requests SET status = 'accepted' WHERE id = request_id;

  INSERT INTO public.club_members (club_id, user_id, role)
    VALUES (v_club_id, v_user_id, 'member')
    ON CONFLICT DO NOTHING;
END;
$$;

CREATE FUNCTION public.can_edit_club_media(p_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
  SELECT CASE
    WHEN (storage.foldername(p_name))[1] !~ '^[0-9a-f-]{36}$' THEN false
    ELSE EXISTS (
      SELECT 1 FROM clubs c
       WHERE c.id = ((storage.foldername(p_name))[1])::uuid
         AND (c.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = c.id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')))
    )
  END;
$_$;

CREATE FUNCTION public.can_use_lobby(p_lobby uuid, p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM lobbies l
     WHERE l.id = p_lobby
       AND CASE
             WHEN l.club_id IS NOT NULL THEN EXISTS (SELECT 1 FROM club_members cm WHERE cm.club_id = l.club_id AND cm.user_id = p_user)
             ELSE l.created_by IS NULL OR l.created_by = p_user
           END
  );
$$;

CREATE FUNCTION public.club_default_location() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_loc geometry;
BEGIN
  SELECT last_known_location INTO v_loc FROM profiles WHERE id = NEW.owner_id;
  IF v_loc IS NOT NULL THEN
    INSERT INTO club_locations (club_id, home_location, source)
    VALUES (NEW.id, approx_point(ST_Y(v_loc), ST_X(v_loc)), 'creator')
    ON CONFLICT (club_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.club_war(p_club_id uuid) RETURNS TABLE(club_name text, rival_id uuid, rival_name text, club_area_m2 double precision, rival_area_m2 double precision, my_area_m2 double precision, my_rank integer, members_scoring integer, ends_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
#variable_conflict use_column
DECLARE
  v_me    uuid := auth.uid();
  v_start timestamptz := date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_rival uuid;
BEGIN
  IF v_me IS NULL OR NOT EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = p_club_id AND m.user_id = v_me) THEN
    RETURN;
  END IF;

  -- 1. The club we clash with most.
  SELECT om.club_id INTO v_rival
    FROM run_territory_contests k
    JOIN club_members mm ON mm.club_id = p_club_id
    JOIN club_members om ON om.club_id <> p_club_id
   WHERE k.created_at >= now() - interval '28 days'
     AND ((k.user_id = mm.user_id AND k.rival_owner_id = om.user_id)
       OR (k.rival_owner_id = mm.user_id AND k.user_id = om.user_id))
     AND NOT EXISTS (SELECT 1 FROM club_members x WHERE x.club_id = p_club_id AND x.user_id = om.user_id)
   GROUP BY om.club_id
   ORDER BY count(*) DESC, om.club_id
   LIMIT 1;

  -- 2. Otherwise the club next to us on this week's area.
  IF v_rival IS NULL THEN
    WITH wk AS (
      SELECT m.club_id, sum(t.area_m2) AS area
        FROM territory_polygons t JOIN club_members m ON m.user_id = t.owner_id
       WHERE t.claimed_at >= v_start
       GROUP BY m.club_id
    ), r AS (
      SELECT club_id, row_number() OVER (ORDER BY area DESC, club_id) AS n FROM wk
    )
    SELECT o.club_id INTO v_rival
      FROM r mine JOIN r o ON o.club_id <> mine.club_id
     WHERE mine.club_id = p_club_id
     ORDER BY CASE WHEN o.n = mine.n - 1 THEN 0 WHEN o.n = mine.n + 1 THEN 1 ELSE 2 END, abs(o.n - mine.n)
     LIMIT 1;
  END IF;

  IF v_rival IS NULL THEN RETURN; END IF; -- nobody to fight yet

  RETURN QUERY
  WITH mine AS (
    SELECT t.owner_id, sum(t.area_m2) AS area
      FROM territory_polygons t JOIN club_members m ON m.user_id = t.owner_id AND m.club_id = p_club_id
     WHERE t.claimed_at >= v_start
     GROUP BY t.owner_id
  ), ranked AS (
    SELECT owner_id, area, rank() OVER (ORDER BY area DESC)::int AS rk FROM mine
  )
  SELECT
    (SELECT c.name FROM clubs c WHERE c.id = p_club_id),
    v_rival,
    (SELECT c.name FROM clubs c WHERE c.id = v_rival),
    COALESCE((SELECT sum(area) FROM mine), 0)::double precision,
    COALESCE((SELECT sum(t.area_m2) FROM territory_polygons t JOIN club_members m ON m.user_id = t.owner_id AND m.club_id = v_rival
               WHERE t.claimed_at >= v_start), 0)::double precision,
    COALESCE((SELECT area FROM ranked WHERE owner_id = v_me), 0)::double precision,
    (SELECT rk FROM ranked WHERE owner_id = v_me),
    (SELECT count(*)::int FROM mine),
    v_start + interval '7 days';
END;
$$;

CREATE FUNCTION public.clubs_near(p_lat double precision, p_lng double precision, p_radius_km double precision DEFAULT 15, p_limit integer DEFAULT 20) RETURNS TABLE(id uuid, name text, description text, badge_emoji text, join_policy text, member_count integer, total_km numeric, city text, distance_km numeric, nearby boolean, joined boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_radius_m float8 := LEAST(GREATEST(COALESCE(p_radius_km, 15), 1), 50) * 1000;
  v_limit    int    := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_me       uuid   := auth.uid();
  v_point    geography;
BEGIN
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL
     AND p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180 THEN
    v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

    RETURN QUERY
      SELECT c.id, c.name, c.description, c.badge_emoji, c.join_policy, c.member_count, c.total_km,
             l.city,
             round((ST_Distance(l.home_location, v_point) / 1000.0)::numeric, 1),
             true,
             EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = c.id AND m.user_id = v_me)
        FROM clubs c
        JOIN club_locations l ON l.club_id = c.id
       WHERE ST_DWithin(l.home_location, v_point, v_radius_m)
       ORDER BY ST_Distance(l.home_location, v_point), c.member_count DESC
       LIMIT v_limit;
    IF FOUND THEN RETURN; END IF;
  END IF;

  RETURN QUERY
    SELECT c.id, c.name, c.description, c.badge_emoji, c.join_policy, c.member_count, c.total_km,
           l.city, NULL::numeric, false,
           EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = c.id AND m.user_id = v_me)
      FROM clubs c
      LEFT JOIN club_locations l ON l.club_id = c.id
     ORDER BY c.member_count DESC, c.created_at
     LIMIT v_limit;
END;
$$;

CREATE FUNCTION public.clubs_start_at_zero() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Clubs made from the app (a signed-in user) start empty; the creator's member
  -- row then counts them. Server-side writers (seed data, admin tools) are left alone.
  IF auth.uid() IS NOT NULL AND COALESCE(current_setting('runivo.trusted_writer', true), '') <> 'on' THEN
    NEW.member_count := 0;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.delete_club(p_club_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_me    uuid := auth.uid();
  v_owner uuid;
  v_name  text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT owner_id, name INTO v_owner, v_name FROM clubs WHERE id = p_club_id FOR UPDATE;
  IF v_owner IS NULL THEN RETURN 'not_found'; END IF;
  IF v_owner <> v_me THEN RETURN 'not_owner'; END IF;

  INSERT INTO notifications (user_id, type, title, body, action_url, dedupe_key)
  SELECT m.user_id, 'system', v_name || ' was closed', 'The club owner deleted the club.', '/clubs',
         'club_deleted:' || p_club_id::text || ':' || m.user_id::text
    FROM club_members m
   WHERE m.club_id = p_club_id AND m.user_id <> v_me
  ON CONFLICT DO NOTHING;

  -- Club runs that haven't happened, and the club chat, go with the club.
  DELETE FROM events  WHERE club_id = p_club_id AND starts_at > now()
    AND NOT EXISTS (SELECT 1 FROM event_finishers f WHERE f.event_id = events.id);
  DELETE FROM lobbies WHERE club_id = p_club_id;
  DELETE FROM clubs   WHERE id = p_club_id;   -- members, messages, requests, bans cascade
  RETURN 'deleted';
END;
$$;

CREATE FUNCTION public.delete_club_message(p_message_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_uid uuid := auth.uid(); v_club uuid; v_author uuid; v_n integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  SELECT l.club_id, m.user_id INTO v_club, v_author
    FROM public.lobby_messages m JOIN public.lobbies l ON l.id = m.lobby_id
   WHERE m.id = p_message_id;
  IF v_author IS NULL THEN RETURN false; END IF;
  IF v_author <> v_uid AND (v_club IS NULL OR NOT public.is_club_moderator(v_club, v_uid)) THEN
    RAISE EXCEPTION 'only the author or a club admin can delete this' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.lobby_messages WHERE id = p_message_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;

CREATE FUNCTION public.get_club_reports(p_club_id uuid) RETURNS TABLE(message_id uuid, content text, author_id uuid, author_username text, reports bigint, reasons text[], last_reported timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_club_moderator(p_club_id, auth.uid()) THEN
    RAISE EXCEPTION 'only club owners and admins can see reports' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT m.id, m.content, m.user_id, p.username, count(*), array_agg(DISTINCT r.reason), max(r.created_at)
      FROM public.club_message_reports r
      JOIN public.lobby_messages m ON m.id = r.message_id
      JOIN public.profiles p ON p.id = m.user_id
     WHERE r.club_id = p_club_id
     GROUP BY m.id, m.content, m.user_id, p.username
     ORDER BY max(r.created_at) DESC
     LIMIT 50;
END;
$$;

CREATE FUNCTION public.get_club_territory_board(p_limit integer DEFAULT 50) RETURNS TABLE(club_id uuid, name text, badge_emoji text, members integer, zones integer, area_m2 double precision, rank integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH c AS (
    SELECT cl.id, cl.name, cl.badge_emoji, cl.member_count,
           count(t.id)::int AS zones, COALESCE(sum(t.area_m2), 0) AS area
      FROM public.clubs cl
      JOIN public.club_members m ON m.club_id = cl.id
      LEFT JOIN public.territory_polygons t ON t.owner_id = m.user_id
     GROUP BY cl.id
  )
  SELECT id, name, badge_emoji, member_count, zones, area, (rank() OVER (ORDER BY area DESC))::int
    FROM c WHERE area > 0
   ORDER BY area DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$$;

CREATE FUNCTION public.is_club_moderator(p_club uuid, p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = p_club AND c.owner_id = p_user)
      OR EXISTS (SELECT 1 FROM public.club_members m
                  WHERE m.club_id = p_club AND m.user_id = p_user AND m.role IN ('owner', 'admin'));
$$;

CREATE FUNCTION public.leave_club(p_club_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF EXISTS (SELECT 1 FROM clubs WHERE id = p_club_id AND owner_id = v_me) THEN RETURN 'owner'; END IF;
  DELETE FROM club_members WHERE club_id = p_club_id AND user_id = v_me;
  RETURN CASE WHEN FOUND THEN 'left' ELSE 'not_member' END;
END;
$$;

CREATE FUNCTION public.log_club_activity_on_join() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_username text;
BEGIN
  SELECT username INTO v_username FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.club_activity (club_id, user_id, username, action)
  VALUES (NEW.club_id, NEW.user_id, COALESCE(v_username, 'Runner'), 'joined');

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.prevent_orphaned_club() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.role = 'owner' THEN
    -- Allow cascade delete: if the club itself has already been deleted, let it proceed
    IF NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = OLD.club_id) THEN
      RETURN OLD;
    END IF;
    -- Block if this would leave the club with no owner
    IF NOT EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = OLD.club_id
        AND user_id != OLD.user_id
        AND role = 'owner'
    ) THEN
      RAISE EXCEPTION 'Cannot remove the last owner of a club. Transfer ownership or delete the club first.';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

CREATE FUNCTION public.refuse_banned_member() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.club_bans b WHERE b.club_id = NEW.club_id AND b.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'you were removed from this club' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.remove_club_member(p_club_id uuid, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_owner    uuid;
  v_is_owner boolean;
  v_role     text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  SELECT owner_id INTO v_owner FROM public.clubs WHERE id = p_club_id;
  IF v_owner IS NULL OR NOT public.is_club_moderator(p_club_id, v_uid) THEN
    RAISE EXCEPTION 'only club owners and admins can remove members' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = v_uid THEN RAISE EXCEPTION 'leave the club instead' USING ERRCODE = '22023'; END IF;
  IF p_user_id = v_owner THEN RAISE EXCEPTION 'the owner cannot be removed' USING ERRCODE = '42501'; END IF;

  v_is_owner := v_uid = v_owner OR EXISTS (SELECT 1 FROM public.club_members WHERE club_id = p_club_id AND user_id = v_uid AND role = 'owner');
  SELECT role INTO v_role FROM public.club_members WHERE club_id = p_club_id AND user_id = p_user_id;
  IF v_role IN ('owner', 'admin') AND NOT v_is_owner THEN
    RAISE EXCEPTION 'only the owner can remove an admin' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.club_members WHERE club_id = p_club_id AND user_id = p_user_id;
  DELETE FROM public.club_join_requests WHERE club_id = p_club_id AND user_id = p_user_id;
  INSERT INTO public.club_bans (club_id, user_id, banned_by) VALUES (p_club_id, p_user_id, v_uid)
  ON CONFLICT (club_id, user_id) DO NOTHING;
END;
$$;

CREATE FUNCTION public.report_club_message(p_message_id uuid, p_reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_uid uuid := auth.uid(); v_club uuid; v_author uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  SELECT l.club_id, m.user_id INTO v_club, v_author
    FROM public.lobby_messages m JOIN public.lobbies l ON l.id = m.lobby_id
   WHERE m.id = p_message_id;
  IF v_club IS NULL OR NOT EXISTS (SELECT 1 FROM public.club_members WHERE club_id = v_club AND user_id = v_uid) THEN
    RAISE EXCEPTION 'message not found' USING ERRCODE = '42501';
  END IF;
  IF v_author = v_uid THEN RAISE EXCEPTION 'cannot report your own message' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(*) FROM public.club_message_reports WHERE reporter_id = v_uid AND created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'too many reports today' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.club_message_reports (message_id, club_id, reporter_id, reason)
  VALUES (p_message_id, v_club, v_uid, p_reason)
  ON CONFLICT (message_id, reporter_id) DO NOTHING;
END;
$$;

CREATE FUNCTION public.set_club_location(p_club_id uuid, p_lat double precision, p_lng double precision, p_city text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM clubs WHERE id = p_club_id AND owner_id = auth.uid()) THEN
    RETURN false;
  END IF;
  INSERT INTO club_locations (club_id, home_location, city, source, updated_at)
  VALUES (p_club_id, approx_point(p_lat, p_lng), left(NULLIF(trim(p_city), ''), 80), 'owner_set', now())
  ON CONFLICT (club_id) DO UPDATE
    SET home_location = EXCLUDED.home_location,
        city          = COALESCE(EXCLUDED.city, club_locations.city),
        source        = 'owner_set',
        updated_at    = now();
  RETURN true;
END;
$$;

CREATE FUNCTION public.sync_club_member_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.clubs SET member_count = member_count + 1 WHERE id = NEW.club_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.clubs SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.club_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION public.unban_club_member(p_club_id uuid, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_club_moderator(p_club_id, auth.uid()) THEN
    RAISE EXCEPTION 'only club owners and admins can do that' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.club_bans WHERE club_id = p_club_id AND user_id = p_user_id;
END;
$$;


-- ── Foreign keys ──────────────────────────────────────────────────────

ALTER TABLE ONLY public.club_activity
    ADD CONSTRAINT club_activity_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.club_activity
    ADD CONSTRAINT club_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.club_bans
    ADD CONSTRAINT club_bans_banned_by_fkey FOREIGN KEY (banned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.club_bans
    ADD CONSTRAINT club_bans_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.club_bans
    ADD CONSTRAINT club_bans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.club_join_requests
    ADD CONSTRAINT club_join_requests_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.club_join_requests
    ADD CONSTRAINT club_join_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.club_locations
    ADD CONSTRAINT club_locations_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.club_members
    ADD CONSTRAINT club_members_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.club_members
    ADD CONSTRAINT club_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.club_message_reports
    ADD CONSTRAINT club_message_reports_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.club_message_reports
    ADD CONSTRAINT club_message_reports_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.lobby_messages(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.club_message_reports
    ADD CONSTRAINT club_message_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.club_messages
    ADD CONSTRAINT club_messages_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.club_messages
    ADD CONSTRAINT club_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.lobbies
    ADD CONSTRAINT lobbies_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.lobbies
    ADD CONSTRAINT lobbies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.lobby_messages
    ADD CONSTRAINT lobby_messages_lobby_id_fkey FOREIGN KEY (lobby_id) REFERENCES public.lobbies(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.lobby_messages
    ADD CONSTRAINT lobby_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- ── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX club_activity_club_id_idx ON public.club_activity USING btree (club_id, created_at DESC);

CREATE INDEX club_join_requests_club_id_idx ON public.club_join_requests USING btree (club_id, status);

CREATE INDEX club_join_requests_user_id_idx ON public.club_join_requests USING btree (user_id);

CREATE INDEX club_locations_geo_idx ON public.club_locations USING gist (home_location);

CREATE INDEX club_members_user_id_idx ON public.club_members USING btree (user_id);

CREATE INDEX club_message_reports_club_idx ON public.club_message_reports USING btree (club_id, created_at DESC);

CREATE INDEX club_messages_club_created_idx ON public.club_messages USING btree (club_id, created_at DESC);

CREATE INDEX clubs_owner_id_idx ON public.clubs USING btree (owner_id);

CREATE INDEX lobbies_club_id_idx ON public.lobbies USING btree (club_id);

CREATE UNIQUE INDEX lobbies_one_per_club ON public.lobbies USING btree (club_id) WHERE (club_id IS NOT NULL);

CREATE INDEX lobbies_status_idx ON public.lobbies USING btree (status) WHERE (status = 'open'::text);

CREATE INDEX lobby_messages_lobby_created_idx ON public.lobby_messages USING btree (lobby_id, created_at DESC);


-- ── Triggers ──────────────────────────────────────────────────────────

CREATE TRIGGER club_members_sync_count AFTER INSERT OR DELETE ON public.club_members FOR EACH ROW EXECUTE FUNCTION public.sync_club_member_count();

CREATE TRIGGER clubs_start_at_zero BEFORE INSERT ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.clubs_start_at_zero();

CREATE TRIGGER trg_banned_chat BEFORE INSERT ON public.lobby_messages FOR EACH ROW EXECUTE FUNCTION public.reject_if_banned();

CREATE TRIGGER trg_club_default_location AFTER INSERT ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.club_default_location();

CREATE TRIGGER trg_filter_chat BEFORE INSERT ON public.lobby_messages FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_text('content');

CREATE TRIGGER trg_filter_clubs BEFORE INSERT OR UPDATE OF name, description ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_text('name', 'description');

CREATE TRIGGER trg_log_club_activity_on_join AFTER INSERT ON public.club_members FOR EACH ROW EXECUTE FUNCTION public.log_club_activity_on_join();

CREATE TRIGGER trg_prevent_orphaned_club BEFORE DELETE ON public.club_members FOR EACH ROW EXECUTE FUNCTION public.prevent_orphaned_club();

CREATE TRIGGER trg_refuse_banned_member BEFORE INSERT ON public.club_members FOR EACH ROW EXECUTE FUNCTION public.refuse_banned_member();

CREATE TRIGGER trg_refuse_banned_request BEFORE INSERT ON public.club_join_requests FOR EACH ROW EXECUTE FUNCTION public.refuse_banned_member();


-- ── Row-level security ────────────────────────────────────────────────

ALTER TABLE public.club_activity ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.club_bans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.club_join_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.club_locations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.club_message_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.club_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lobbies ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lobby_messages ENABLE ROW LEVEL SECURITY;


-- ── Policies ──────────────────────────────────────────────────────────

CREATE POLICY "Club owners and admins can delete any message" ON public.club_messages FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.club_members
  WHERE ((club_members.club_id = club_messages.club_id) AND (club_members.user_id = auth.uid()) AND (club_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "Members can delete own messages" ON public.club_messages FOR DELETE USING (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.club_members
  WHERE ((club_members.club_id = club_messages.club_id) AND (club_members.user_id = auth.uid()))))));

CREATE POLICY "club members can read messages" ON public.club_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.club_members cm
  WHERE ((cm.club_id = club_messages.club_id) AND (cm.user_id = auth.uid())))));

CREATE POLICY "club members can send messages" ON public.club_messages FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.club_members cm
  WHERE ((cm.club_id = club_messages.club_id) AND (cm.user_id = auth.uid()))))));

CREATE POLICY "club_activity: members can read" ON public.club_activity FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.club_members cm
  WHERE ((cm.club_id = club_activity.club_id) AND (cm.user_id = auth.uid())))));

CREATE POLICY "club_bans: moderators read" ON public.club_bans FOR SELECT TO authenticated USING (public.is_club_moderator(club_id, auth.uid()));

CREATE POLICY "club_join_requests: anyone can read" ON public.club_join_requests FOR SELECT USING (true);

CREATE POLICY "club_join_requests: club owner can update" ON public.club_join_requests FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.club_members cm
  WHERE ((cm.club_id = club_join_requests.club_id) AND (cm.user_id = auth.uid()) AND (cm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "club_join_requests: self can request" ON public.club_join_requests FOR INSERT WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "club_join_requests: self can retract" ON public.club_join_requests FOR DELETE USING ((auth.uid() = user_id));

CREATE POLICY "club_members: anyone can read" ON public.club_members FOR SELECT USING (true);

CREATE POLICY "club_members: owner can join own club" ON public.club_members FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.clubs
  WHERE ((clubs.id = club_members.club_id) AND (clubs.owner_id = auth.uid()))))));

CREATE POLICY "club_members: self can join open clubs" ON public.club_members FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.clubs
  WHERE ((clubs.id = club_members.club_id) AND (clubs.join_policy = 'open'::text))))));

CREATE POLICY "club_members: self can leave" ON public.club_members FOR DELETE USING ((auth.uid() = user_id));

CREATE POLICY "club_message_reports: moderators read" ON public.club_message_reports FOR SELECT TO authenticated USING (public.is_club_moderator(club_id, auth.uid()));

CREATE POLICY "clubs: anyone can read" ON public.clubs FOR SELECT USING (true);

CREATE POLICY "clubs: owner can delete" ON public.clubs FOR DELETE USING ((auth.uid() = owner_id));

CREATE POLICY "clubs: owner can insert" ON public.clubs FOR INSERT WITH CHECK ((auth.uid() = owner_id));

CREATE POLICY "clubs: owner can update" ON public.clubs FOR UPDATE USING ((auth.uid() = owner_id));

CREATE POLICY "lobbies: anyone can read" ON public.lobbies FOR SELECT USING (true);

CREATE POLICY "lobbies: authenticated can create" ON public.lobbies FOR INSERT WITH CHECK (((auth.uid() = created_by) AND ((club_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.club_members cm
  WHERE ((cm.club_id = lobbies.club_id) AND (cm.user_id = auth.uid())))))));

CREATE POLICY "lobby_messages: participants can read" ON public.lobby_messages FOR SELECT USING (((NOT public.is_blocked_between(auth.uid(), user_id)) AND public.can_use_lobby(lobby_id, auth.uid())));

CREATE POLICY "lobby_messages: participants can send" ON public.lobby_messages FOR INSERT WITH CHECK (((auth.uid() = user_id) AND public.can_use_lobby(lobby_id, auth.uid())));

CREATE POLICY "club-media: admins delete" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'club-media'::text) AND public.can_edit_club_media(name)));

CREATE POLICY "club-media: admins read own" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'club-media'::text) AND public.can_edit_club_media(name)));

CREATE POLICY "club-media: admins update" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'club-media'::text) AND public.can_edit_club_media(name))) WITH CHECK (((bucket_id = 'club-media'::text) AND public.can_edit_club_media(name)));

CREATE POLICY "club-media: admins write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'club-media'::text) AND public.can_edit_club_media(name)));


-- ── Comments ──────────────────────────────────────────────────────────

COMMENT ON FUNCTION public.prevent_orphaned_club() IS 'Prevents the last owner of a club from leaving without transferring ownership.
   To leave: first promote another member to owner, then delete your own membership.';

COMMENT ON TABLE public.club_activity IS 'Per-club activity feed, e.g. member joins. Read is scoped to members of that club.';

COMMENT ON TABLE public.club_join_requests IS 'Pending/accepted/rejected requests to join an invite-only club.';

COMMENT ON TABLE public.club_members IS 'Club membership with role.';

COMMENT ON TABLE public.clubs IS 'Running clubs — groups of players competing together.';

COMMENT ON TABLE public.lobbies IS 'Pre-run lobbies for coordinating group runs.';

COMMENT ON TABLE public.lobby_messages IS 'Realtime lobby chat messages.';


-- ── Grants ────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.can_edit_club_media(p_name text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.can_edit_club_media(p_name text) TO authenticated;
GRANT ALL ON FUNCTION public.can_edit_club_media(p_name text) TO service_role;

REVOKE ALL ON FUNCTION public.can_use_lobby(p_lobby uuid, p_user uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.can_use_lobby(p_lobby uuid, p_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_use_lobby(p_lobby uuid, p_user uuid) TO service_role;

REVOKE ALL ON FUNCTION public.club_default_location() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.club_default_location() TO service_role;

REVOKE ALL ON FUNCTION public.club_war(p_club_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.club_war(p_club_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.club_war(p_club_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.clubs_near(p_lat double precision, p_lng double precision, p_radius_km double precision, p_limit integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.clubs_near(p_lat double precision, p_lng double precision, p_radius_km double precision, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.clubs_near(p_lat double precision, p_lng double precision, p_radius_km double precision, p_limit integer) TO service_role;

REVOKE ALL ON FUNCTION public.delete_club(p_club_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.delete_club(p_club_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_club(p_club_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.leave_club(p_club_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.leave_club(p_club_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.leave_club(p_club_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.set_club_location(p_club_id uuid, p_lat double precision, p_lng double precision, p_city text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.set_club_location(p_club_id uuid, p_lat double precision, p_lng double precision, p_city text) TO authenticated;
GRANT ALL ON FUNCTION public.set_club_location(p_club_id uuid, p_lat double precision, p_lng double precision, p_city text) TO service_role;

REVOKE ALL ON TABLE public.club_locations FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.club_locations TO service_role;


-- ── Storage buckets ────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('club-media', 'club-media', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ── Realtime ───────────────────────────────────────────────────────────

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.club_messages; EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.lobbies; EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_messages; EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END;
END $$;


-- ── Starting data ──────────────────────────────────────────────────────

INSERT INTO public.lobbies (id, club_id, name, status, created_by, created_at) VALUES ('00000000-0000-0000-0000-000000000001', NULL, 'Global Runners', 'open', NULL, '2026-11-17 16:17:45.272353+00');
INSERT INTO public.lobbies (id, club_id, name, status, created_by, created_at) VALUES ('00000000-0000-0000-0000-000000000002', NULL, 'Training Talk', 'open', NULL, '2026-11-17 16:17:45.272353+00');
INSERT INTO public.lobbies (id, club_id, name, status, created_by, created_at) VALUES ('00000000-0000-0000-0000-000000000003', NULL, 'Race Reports', 'open', NULL, '2026-11-17 16:17:45.272353+00');
INSERT INTO public.lobbies (id, club_id, name, status, created_by, created_at) VALUES ('00000000-0000-0000-0000-000000000004', NULL, 'Speed & Intervals', 'open', NULL, '2026-11-17 16:17:45.272353+00');
INSERT INTO public.lobbies (id, club_id, name, status, created_by, created_at) VALUES ('00000000-0000-0000-0000-000000000005', NULL, 'Night Runners', 'open', NULL, '2026-11-17 16:17:45.272353+00');

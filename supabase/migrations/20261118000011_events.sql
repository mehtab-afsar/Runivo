-- ========================================================================
-- Events and challenges
-- ========================================================================
-- Events, participants, finishers and group challenges.
--
-- One file per feature: this file creates everything this feature owns
-- (tables, functions, triggers, row-level security, grants, scheduled jobs).
-- It needs only the files before it. Built from the 178 migrations up to
-- 20261117000012 (the 178 old files were removed after commit 9e5cf19; see git history); a fresh
-- database built from these files matches one built from those exactly.
--
-- Tables: event_bookmarks, event_finishers, event_participants, events, group_challenge_members, group_challenges

SET check_function_bodies = false;
SET client_min_messages = warning;
SET search_path = public, extensions;


-- ── Tables ────────────────────────────────────────────────────────────

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    event_type text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    location public.geometry(Point,4326),
    location_name text,
    distance_m integer,
    participant_count integer DEFAULT 0 NOT NULL,
    xp_multiplier numeric(3,1) DEFAULT 1.0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organizer text,
    image_url text,
    pace_bonus integer DEFAULT 0 NOT NULL,
    source text DEFAULT 'hosted'::text NOT NULL,
    registration_url text,
    source_name text,
    club_id uuid,
    discipline text,
    lat numeric(9,6),
    lng numeric(9,6),
    route_points jsonb,
    pace_groups text[],
    radius_m integer,
    created_by uuid DEFAULT auth.uid(),
    CONSTRAINT events_curated_requires_registration_url CHECK (((source <> 'curated'::text) OR (registration_url IS NOT NULL))),
    CONSTRAINT events_discipline_check CHECK ((discipline = ANY (ARRAY['marathon'::text, 'half_marathon'::text, '10k'::text, '5k'::text, 'cyclothon'::text, 'triathlon'::text, 'trail_run'::text, 'community_run'::text, 'other'::text]))),
    CONSTRAINT events_event_type_check CHECK ((event_type = ANY (ARRAY['territory-war'::text, 'king-of-hill'::text, 'survival'::text, 'brand-challenge'::text, 'community'::text, 'race'::text, 'community-run'::text, 'challenge'::text]))),
    CONSTRAINT events_radius_m_check CHECK (((radius_m IS NULL) OR ((radius_m >= 200) AND (radius_m <= 5000)))),
    CONSTRAINT events_route_points_size CHECK (((route_points IS NULL) OR ((jsonb_typeof(route_points) = 'array'::text) AND (jsonb_array_length(route_points) <= 1500)))),
    CONSTRAINT events_source_check CHECK ((source = ANY (ARRAY['hosted'::text, 'curated'::text])))
);

CREATE TABLE public.event_bookmarks (
    user_id uuid NOT NULL,
    event_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.event_finishers (
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.event_participants (
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    pace_group text,
    arrived_at timestamp with time zone
);

CREATE TABLE public.group_challenge_members (
    challenge_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'invited'::text NOT NULL,
    joined_at timestamp with time zone,
    CONSTRAINT group_challenge_members_status_check CHECK ((status = ANY (ARRAY['invited'::text, 'joined'::text, 'declined'::text])))
);

CREATE TABLE public.group_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_id uuid NOT NULL,
    title text NOT NULL,
    metric text NOT NULL,
    target numeric NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_challenges_check CHECK (((ends_at > starts_at) AND (ends_at <= (starts_at + '92 days'::interval)))),
    CONSTRAINT group_challenges_metric_check CHECK ((metric = ANY (ARRAY['distance_km'::text, 'zones'::text, 'active_days'::text]))),
    CONSTRAINT group_challenges_target_check CHECK (((target > (0)::numeric) AND (target <= (10000)::numeric))),
    CONSTRAINT group_challenges_title_check CHECK (((length(title) >= 1) AND (length(title) <= 60)))
);


-- ── Keys and checks ───────────────────────────────────────────────────

ALTER TABLE ONLY public.event_bookmarks
    ADD CONSTRAINT event_bookmarks_pkey PRIMARY KEY (user_id, event_id);

ALTER TABLE ONLY public.event_finishers
    ADD CONSTRAINT event_finishers_pkey PRIMARY KEY (event_id, user_id);

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT event_participants_pkey PRIMARY KEY (event_id, user_id);

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);

ALTER TABLE public.events
    ADD CONSTRAINT events_registration_url_https CHECK (((registration_url IS NULL) OR (registration_url ~* '^https?://[^[:space:]]+$'::text))) NOT VALID;

ALTER TABLE ONLY public.group_challenge_members
    ADD CONSTRAINT group_challenge_members_pkey PRIMARY KEY (challenge_id, user_id);

ALTER TABLE ONLY public.group_challenges
    ADD CONSTRAINT group_challenges_pkey PRIMARY KEY (id);


-- ── Functions ─────────────────────────────────────────────────────────

CREATE FUNCTION public.can_manage_event(p_event uuid, p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM events e
     WHERE e.id = p_event
       AND (e.created_by = p_user
         OR (e.club_id IS NOT NULL AND (
               EXISTS (SELECT 1 FROM clubs c WHERE c.id = e.club_id AND c.owner_id = p_user)
            OR EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = e.club_id AND m.user_id = p_user AND m.role IN ('owner', 'admin')))))
  );
$$;

CREATE FUNCTION public.cancel_event(p_event uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_me uuid := auth.uid();
  ev   events%ROWTYPE;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT * INTO ev FROM events WHERE id = p_event FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF NOT public.can_manage_event(p_event, v_me) THEN RETURN 'not_allowed'; END IF;
  IF ev.starts_at <= now() THEN RETURN 'started'; END IF;

  INSERT INTO notifications (user_id, type, title, body, action_url, dedupe_key)
  SELECT p.user_id, 'event_reminder', ev.title || ' is cancelled',
         'The organiser cancelled it.',
         '/events', 'event_cancelled:' || ev.id::text || ':' || p.user_id::text
    FROM event_participants p
   WHERE p.event_id = ev.id AND p.user_id <> v_me
  ON CONFLICT DO NOTHING;

  DELETE FROM events WHERE id = ev.id;   -- participants and bookmarks cascade
  RETURN 'cancelled';
END;
$$;

CREATE FUNCTION public.check_in_event(p_event uuid, p_lat double precision, p_lng double precision) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE e events%ROWTYPE;
BEGIN
  SELECT * INTO e FROM events WHERE id = p_event;
  IF NOT FOUND OR e.lat IS NULL THEN RETURN false; END IF;
  IF now() < e.starts_at - interval '1 hour' OR now() > COALESCE(e.ends_at, e.starts_at + interval '4 hours') THEN RETURN false; END IF;
  IF ST_Distance(ST_MakePoint(p_lng, p_lat)::geography, ST_MakePoint(e.lng::float8, e.lat::float8)::geography) > 300 THEN RETURN false; END IF;
  UPDATE event_participants SET arrived_at = COALESCE(arrived_at, now()) WHERE event_id = p_event AND user_id = auth.uid();
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.create_club_event(p_club_id uuid, p_title text, p_starts_at timestamp with time zone, p_location text, p_distance_m integer DEFAULT NULL::integer, p_description text DEFAULT NULL::text, p_weeks integer DEFAULT 1, p_lat numeric DEFAULT NULL::numeric, p_lng numeric DEFAULT NULL::numeric, p_route jsonb DEFAULT NULL::jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_n integer := LEAST(GREATEST(COALESCE(p_weeks, 1), 1), 12); i integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_club_moderator(p_club_id, auth.uid()) THEN
    RAISE EXCEPTION 'only club owners and admins can schedule club runs' USING ERRCODE = '42501';
  END IF;
  IF length(trim(COALESCE(p_title, ''))) < 3 THEN RAISE EXCEPTION 'add a title' USING ERRCODE = '22023'; END IF;
  IF p_starts_at < now() THEN RAISE EXCEPTION 'pick a time in the future' USING ERRCODE = '22023'; END IF;
  IF p_route IS NOT NULL AND (jsonb_typeof(p_route) <> 'array' OR jsonb_array_length(p_route) < 2) THEN
    RAISE EXCEPTION 'a route needs at least two points' USING ERRCODE = '22023';
  END IF;
  FOR i IN 0 .. v_n - 1 LOOP
    INSERT INTO public.events (title, description, event_type, starts_at, ends_at, location_name, distance_m,
                               is_active, participant_count, source, club_id, discipline, lat, lng, route_points)
    VALUES (trim(p_title), NULLIF(trim(COALESCE(p_description, '')), ''), 'community-run',
            p_starts_at + (i * interval '7 days'), p_starts_at + (i * interval '7 days') + interval '2 hours',
            NULLIF(trim(COALESCE(p_location, '')), ''), p_distance_m, true, 0, 'hosted', p_club_id, 'community_run', p_lat, p_lng, p_route);
  END LOOP;
  RETURN v_n;
END;
$$;

CREATE FUNCTION public.create_group_challenge(p_title text, p_metric text, p_target numeric, p_ends_at timestamp with time zone, p_invitees uuid[]) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id uuid;
  v_me text;
  u uuid;
  n int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF COALESCE(array_length(p_invitees, 1), 0) < 1 OR array_length(p_invitees, 1) > 19 THEN
    RAISE EXCEPTION 'a challenge has 2 to 20 people';
  END IF;
  INSERT INTO group_challenges (creator_id, title, metric, target, ends_at)
  VALUES (auth.uid(), trim(p_title), p_metric, p_target, p_ends_at) RETURNING id INTO v_id;
  INSERT INTO group_challenge_members (challenge_id, user_id, status, joined_at) VALUES (v_id, auth.uid(), 'joined', now());
  SELECT username INTO v_me FROM profiles WHERE id = auth.uid();
  FOREACH u IN ARRAY p_invitees LOOP
    -- Only people you follow, and who aren't blocked either way.
    CONTINUE WHEN u = auth.uid()
      OR NOT EXISTS (SELECT 1 FROM followers WHERE follower_id = auth.uid() AND following_id = u)
      OR is_blocked_between(auth.uid(), u);
    INSERT INTO group_challenge_members (challenge_id, user_id) VALUES (v_id, u) ON CONFLICT DO NOTHING;
    PERFORM queue_notification(u, 'challenge', v_me || ' challenged you: ' || trim(p_title),
      'Join before ' || to_char(p_ends_at, 'DD Mon'), '/challenges/' || v_id, 'challenge_invite:' || v_id, true);
    n := n + 1;
  END LOOP;
  IF n = 0 THEN RAISE EXCEPTION 'invite at least one runner you follow'; END IF;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.create_territory_event(p_club uuid, p_title text, p_starts_at timestamp with time zone, p_minutes integer, p_lat double precision, p_lng double precision, p_radius_m integer, p_place text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT is_club_moderator(p_club, auth.uid()) THEN RAISE EXCEPTION 'only club owners and admins can do this'; END IF;
  IF p_minutes NOT BETWEEN 30 AND 180 THEN RAISE EXCEPTION 'between 30 minutes and 3 hours'; END IF;
  IF p_starts_at < now() - interval '5 minutes' THEN RAISE EXCEPTION 'pick a time in the future'; END IF;
  INSERT INTO events (title, description, event_type, starts_at, ends_at, lat, lng, location, location_name, radius_m, club_id, source, is_active, organizer)
  VALUES (trim(p_title), 'Zones claimed inside the area during the event earn double PACE for club members.', 'territory-war',
          p_starts_at, p_starts_at + make_interval(mins => p_minutes), p_lat, p_lng,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326), p_place, p_radius_m, p_club, 'hosted', true,
          (SELECT name FROM clubs WHERE id = p_club))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.derive_event_location() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.lat is not null and new.lng is not null then
    new.location := st_setsrid(st_makepoint(new.lng, new.lat), 4326);
  end if;
  return new;
end;
$$;

CREATE FUNCTION public.event_attendees(p_event uuid) RETURNS TABLE(user_id uuid, username text, avatar_color text, pace_group text, arrived boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT ep.user_id, p.username, p.avatar_color, ep.pace_group, ep.arrived_at IS NOT NULL
    FROM event_participants ep JOIN profiles p ON p.id = ep.user_id
   WHERE ep.event_id = p_event
     AND auth.uid() IS NOT NULL
     AND ep.user_id NOT IN (SELECT hidden_user_ids(auth.uid()))
   ORDER BY ep.arrived_at NULLS LAST, p.username
   LIMIT 200;
$$;

CREATE FUNCTION public.event_result(p_event uuid) RETURNS TABLE(user_id uuid, username text, avatar_color text, distance_km numeric, duration_sec integer, is_me boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH e AS (
    SELECT * FROM events WHERE id = p_event AND lat IS NOT NULL AND starts_at < now()
  )
  SELECT DISTINCT ON (r.user_id) r.user_id, p.username, p.avatar_color,
         round(r.distance_m / 1000.0, 2), r.duration_sec, r.user_id = auth.uid()
    FROM e
    JOIN runs r ON r.started_at BETWEEN e.starts_at - interval '45 minutes' AND COALESCE(e.ends_at, e.starts_at + interval '4 hours')
               AND jsonb_array_length(COALESCE(r.gps_points, '[]'::jsonb)) > 0
               AND NOT COALESCE(r.excluded, false)
    JOIN profiles p ON p.id = r.user_id
   WHERE ST_DWithin(
           ST_MakePoint((r.gps_points->0->>'lng')::float8, (r.gps_points->0->>'lat')::float8)::geography,
           ST_MakePoint(e.lng::float8, e.lat::float8)::geography, 1000)
     AND r.user_id NOT IN (SELECT hidden_user_ids(auth.uid()))
     AND (
       r.user_id = auth.uid()
       OR (NOT p.hide_from_leaderboards AND EXISTS (
             SELECT 1 FROM feed_posts fp WHERE fp.run_id = r.id AND can_view_post(auth.uid(), fp.user_id, fp.visibility)))
     )
   ORDER BY r.user_id, r.distance_m DESC;
$$;

CREATE FUNCTION public.events_set_creator() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.get_club_events(p_club_id uuid) RETURNS TABLE(id uuid, title text, description text, starts_at timestamp with time zone, location_name text, distance_m integer, participant_count integer, going boolean, route_points jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT e.id, e.title, e.description, e.starts_at, e.location_name, e.distance_m, e.participant_count,
         EXISTS (SELECT 1 FROM public.event_participants ep WHERE ep.event_id = e.id AND ep.user_id = auth.uid()),
         e.route_points
    FROM public.events e
   WHERE e.club_id = p_club_id AND e.is_active AND e.ends_at > now()
   ORDER BY e.starts_at
   LIMIT 30;
$$;

CREATE FUNCTION public.group_challenge_progress(p_challenge uuid) RETURNS TABLE(user_id uuid, username text, avatar_color text, status text, progress numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT m.user_id, p.username, p.avatar_color, m.status,
    CASE c.metric
      WHEN 'distance_km' THEN COALESCE((SELECT round(sum(r.verified_distance_m) / 1000.0, 1) FROM runs r
             WHERE r.user_id = m.user_id AND NOT COALESCE(r.excluded, false)
               AND r.started_at BETWEEN c.starts_at AND c.ends_at), 0)
      WHEN 'active_days' THEN COALESCE((SELECT count(DISTINCT (r.started_at AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date) FROM runs r
             WHERE r.user_id = m.user_id AND NOT COALESCE(r.excluded, false) AND r.verified_distance_m > 0
               AND r.started_at BETWEEN c.starts_at AND c.ends_at), 0)
      ELSE COALESCE((SELECT count(*) FROM zone_events e
             WHERE e.user_id = m.user_id AND e.kind IN ('claimed', 'stolen')
               AND e.at BETWEEN c.starts_at AND c.ends_at), 0)
    END
  FROM group_challenges c
  JOIN group_challenge_members m ON m.challenge_id = c.id
  JOIN profiles p ON p.id = m.user_id
  WHERE c.id = p_challenge
    AND EXISTS (SELECT 1 FROM group_challenge_members me WHERE me.challenge_id = c.id AND me.user_id = auth.uid())
    AND m.status <> 'declined'
  ORDER BY 5 DESC, p.username;
$$;

CREATE FUNCTION public.my_group_challenges() RETURNS TABLE(id uuid, title text, metric text, target numeric, starts_at timestamp with time zone, ends_at timestamp with time zone, creator_name text, my_status text, people integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT c.id, c.title, c.metric, c.target, c.starts_at, c.ends_at, p.username, me.status,
         (SELECT count(*)::int FROM group_challenge_members x WHERE x.challenge_id = c.id AND x.status = 'joined')
    FROM group_challenges c
    JOIN group_challenge_members me ON me.challenge_id = c.id AND me.user_id = auth.uid() AND me.status <> 'declined'
    JOIN profiles p ON p.id = c.creator_id
   ORDER BY (c.ends_at < now()), c.ends_at;
$$;

CREATE FUNCTION public.nearby_events(p_lat numeric, p_lng numeric, p_radius_km numeric DEFAULT 50, p_discipline text DEFAULT NULL::text) RETURNS SETOF public.events
    LANGUAGE sql STABLE
    AS $$
  select *
  from public.events
  where is_active = true
    and location is not null
    and (p_discipline is null or discipline = p_discipline)
    and st_dwithin(
      location::geography,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      p_radius_km * 1000
    )
  order by starts_at asc;
$$;

CREATE FUNCTION public.respond_group_challenge(p_challenge uuid, p_join boolean) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE group_challenge_members
     SET status = CASE WHEN p_join THEN 'joined' ELSE 'declined' END,
         joined_at = CASE WHEN p_join THEN now() ELSE NULL END
   WHERE challenge_id = p_challenge AND user_id = auth.uid() AND status <> 'joined';
$$;

CREATE FUNCTION public.set_event_pace_group(p_event uuid, p_group text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE event_participants SET pace_group = NULLIF(trim(p_group), '')
   WHERE event_id = p_event AND user_id = auth.uid()
     AND (p_group IS NULL OR p_group = ANY (COALESCE((SELECT pace_groups FROM events WHERE id = p_event), ARRAY[]::text[])));
$$;

CREATE FUNCTION public.sync_event_participant_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if TG_OP = 'INSERT' then
    update public.events
    set participant_count = participant_count + 1
    where id = NEW.event_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.events
    set participant_count = greatest(participant_count - 1, 0)
    where id = OLD.event_id;
    return OLD;
  end if;
  return null;
end;
$$;

CREATE FUNCTION public.territory_event_multiplier(p_user uuid, p_at timestamp with time zone, p_lat double precision, p_lng double precision) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM events e
     WHERE e.event_type = 'territory-war' AND e.is_active
       AND p_at BETWEEN e.starts_at AND COALESCE(e.ends_at, e.starts_at + interval '1 hour')
       AND e.lat IS NOT NULL
       AND ST_DWithin(ST_MakePoint(p_lng, p_lat)::geography, ST_MakePoint(e.lng::float8, e.lat::float8)::geography, COALESCE(e.radius_m, 1000))
       AND (e.club_id IS NULL OR EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = e.club_id AND m.user_id = p_user))
  ) THEN 2 ELSE 1 END;
$$;


-- ── Foreign keys ──────────────────────────────────────────────────────

ALTER TABLE ONLY public.event_bookmarks
    ADD CONSTRAINT event_bookmarks_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_bookmarks
    ADD CONSTRAINT event_bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_finishers
    ADD CONSTRAINT event_finishers_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_finishers
    ADD CONSTRAINT event_finishers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT event_participants_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT event_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.group_challenge_members
    ADD CONSTRAINT group_challenge_members_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.group_challenges(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_challenge_members
    ADD CONSTRAINT group_challenge_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_challenges
    ADD CONSTRAINT group_challenges_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- ── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX events_club_id_idx ON public.events USING btree (club_id) WHERE (club_id IS NOT NULL);

CREATE INDEX events_is_active_idx ON public.events USING btree (is_active) WHERE (is_active = true);

CREATE INDEX events_location_idx ON public.events USING gist (location);

CREATE INDEX events_source_idx ON public.events USING btree (source);

CREATE INDEX events_starts_at_idx ON public.events USING btree (starts_at);


-- ── Triggers ──────────────────────────────────────────────────────────

CREATE TRIGGER events_set_creator BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION public.events_set_creator();

CREATE TRIGGER trg_derive_event_location BEFORE INSERT OR UPDATE OF lat, lng ON public.events FOR EACH ROW EXECUTE FUNCTION public.derive_event_location();

CREATE TRIGGER trg_filter_events BEFORE INSERT OR UPDATE OF title, description ON public.events FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_text('title', 'description');

CREATE TRIGGER trg_sync_event_participant_count AFTER INSERT OR DELETE ON public.event_participants FOR EACH ROW EXECUTE FUNCTION public.sync_event_participant_count();


-- ── Row-level security ────────────────────────────────────────────────

ALTER TABLE public.event_bookmarks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event_finishers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_challenge_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_challenges ENABLE ROW LEVEL SECURITY;


-- ── Policies ──────────────────────────────────────────────────────────

CREATE POLICY eb_own ON public.event_bookmarks TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY ef_read ON public.event_finishers FOR SELECT TO authenticated USING (true);

CREATE POLICY "event_participants: anyone can read" ON public.event_participants FOR SELECT USING (true);

CREATE POLICY "event_participants: self can join" ON public.event_participants FOR INSERT WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "event_participants: self can leave" ON public.event_participants FOR DELETE USING ((auth.uid() = user_id));

CREATE POLICY "events: admin delete" ON public.events FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.subscription_tier = 'admin'::text)))));

CREATE POLICY "events: admin update" ON public.events FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.subscription_tier = 'admin'::text)))));

CREATE POLICY "events: anyone can read" ON public.events FOR SELECT USING (true);

CREATE POLICY "events: premium can create" ON public.events FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (public.effective_tier(profiles.subscription_tier) = ANY (ARRAY['premium'::text, 'admin'::text]))))) AND ((source = 'hosted'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.subscription_tier = 'admin'::text)))))));


-- ── Comments ──────────────────────────────────────────────────────────

COMMENT ON TABLE public.events IS 'Community and competitive running events.';

COMMENT ON COLUMN public.events.source IS 'hosted = in-app RSVP via event_participants; curated = outbound registration_url, admin-added listing.';

COMMENT ON COLUMN public.events.registration_url IS 'External signup link. Required when source = curated; null for hosted events (RSVP happens in-app).';

COMMENT ON COLUMN public.events.source_name IS 'Attribution shown on curated cards, e.g. "via World Marathon Majors" — distinct from the human-readable `organizer` field.';

COMMENT ON TABLE public.event_participants IS 'RSVP / join records for events.';


-- ── Grants ────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.can_manage_event(p_event uuid, p_user uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.can_manage_event(p_event uuid, p_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_manage_event(p_event uuid, p_user uuid) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_event(p_event uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.cancel_event(p_event uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_event(p_event uuid) TO service_role;

REVOKE ALL ON FUNCTION public.check_in_event(p_event uuid, p_lat double precision, p_lng double precision) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.check_in_event(p_event uuid, p_lat double precision, p_lng double precision) TO authenticated;
GRANT ALL ON FUNCTION public.check_in_event(p_event uuid, p_lat double precision, p_lng double precision) TO service_role;

REVOKE ALL ON FUNCTION public.create_group_challenge(p_title text, p_metric text, p_target numeric, p_ends_at timestamp with time zone, p_invitees uuid[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.create_group_challenge(p_title text, p_metric text, p_target numeric, p_ends_at timestamp with time zone, p_invitees uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.create_group_challenge(p_title text, p_metric text, p_target numeric, p_ends_at timestamp with time zone, p_invitees uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.create_territory_event(p_club uuid, p_title text, p_starts_at timestamp with time zone, p_minutes integer, p_lat double precision, p_lng double precision, p_radius_m integer, p_place text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.create_territory_event(p_club uuid, p_title text, p_starts_at timestamp with time zone, p_minutes integer, p_lat double precision, p_lng double precision, p_radius_m integer, p_place text) TO authenticated;
GRANT ALL ON FUNCTION public.create_territory_event(p_club uuid, p_title text, p_starts_at timestamp with time zone, p_minutes integer, p_lat double precision, p_lng double precision, p_radius_m integer, p_place text) TO service_role;

REVOKE ALL ON FUNCTION public.event_attendees(p_event uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.event_attendees(p_event uuid) TO authenticated;
GRANT ALL ON FUNCTION public.event_attendees(p_event uuid) TO service_role;

REVOKE ALL ON FUNCTION public.event_result(p_event uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.event_result(p_event uuid) TO authenticated;
GRANT ALL ON FUNCTION public.event_result(p_event uuid) TO service_role;

REVOKE ALL ON FUNCTION public.group_challenge_progress(p_challenge uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.group_challenge_progress(p_challenge uuid) TO authenticated;
GRANT ALL ON FUNCTION public.group_challenge_progress(p_challenge uuid) TO service_role;

REVOKE ALL ON FUNCTION public.my_group_challenges() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.my_group_challenges() TO authenticated;
GRANT ALL ON FUNCTION public.my_group_challenges() TO service_role;

REVOKE ALL ON FUNCTION public.respond_group_challenge(p_challenge uuid, p_join boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.respond_group_challenge(p_challenge uuid, p_join boolean) TO authenticated;
GRANT ALL ON FUNCTION public.respond_group_challenge(p_challenge uuid, p_join boolean) TO service_role;

REVOKE ALL ON FUNCTION public.set_event_pace_group(p_event uuid, p_group text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.set_event_pace_group(p_event uuid, p_group text) TO authenticated;
GRANT ALL ON FUNCTION public.set_event_pace_group(p_event uuid, p_group text) TO service_role;

REVOKE ALL ON FUNCTION public.territory_event_multiplier(p_user uuid, p_at timestamp with time zone, p_lat double precision, p_lng double precision) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.territory_event_multiplier(p_user uuid, p_at timestamp with time zone, p_lat double precision, p_lng double precision) TO service_role;

-- ============================================================
-- Activity photos, "Don't count this", and club moderation
-- ============================================================
-- 1. Photos: up to 6 per activity, stored in the public 'feed' bucket under
--    <uid>/<run id>/…; the run and its post keep the storage paths.
-- 2. "Don't count this": a run with a GPS glitch stays in your history but
--    leaves your stats, leaderboards and records. Zones and PACE stay.
-- 3. Clubs: report a message in the club chat (lobby_messages in the club's
--    lobby); owners and admins delete messages and remove (and bar) a
--    member; barred runners cannot rejoin until unbarred.
-- ============================================================

ALTER TABLE public.runs       ADD COLUMN IF NOT EXISTS excluded    boolean NOT NULL DEFAULT false;
ALTER TABLE public.runs       ADD COLUMN IF NOT EXISTS photo_paths text[]  NOT NULL DEFAULT '{}';
ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS photo_paths text[]  NOT NULL DEFAULT '{}';

-- ── Photos ──────────────────────────────────────────────────
-- Every path must sit in your own folder for this run, so nobody can point
-- their post at someone else's picture.
CREATE OR REPLACE FUNCTION public.set_activity_photos(p_run_id uuid, p_paths text[])
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

-- ── Don't count this ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_activity_excluded(p_run_id uuid, p_excluded boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

-- Leaderboards and the old distance RPC leave excluded runs out.
CREATE OR REPLACE FUNCTION public.leaderboard_values(p_metric text, p_period text)
RETURNS TABLE(user_id uuid, value numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH b AS (SELECT public.leaderboard_period_start(p_period) AS since)
  SELECT r.user_id, SUM(r.distance_m) / 1000.0
    FROM public.runs r, b
   WHERE p_metric = 'distance'
     AND r.started_at >= b.since
     AND COALESCE(r.activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike'])
     AND NOT r.excluded
   GROUP BY r.user_id
  HAVING SUM(r.distance_m) > 0
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

REVOKE ALL ON FUNCTION public.leaderboard_values(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leaderboard_values(text, text) FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_run_km_by_user(p_cutoff timestamptz, p_limit int DEFAULT 100)
RETURNS TABLE(user_id uuid, total_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.user_id, COALESCE(SUM(r.distance_m) / 1000.0, 0)::numeric AS total_km
  FROM public.runs r
  WHERE r.started_at >= p_cutoff
    AND COALESCE(r.activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike'])
    AND NOT r.excluded
  GROUP BY r.user_id
  ORDER BY total_km DESC
  LIMIT p_limit;
$$;

-- Feed: adds photo_paths.
DROP FUNCTION IF EXISTS public.get_feed(integer, timestamp with time zone, boolean);
CREATE FUNCTION public.get_feed(lim integer DEFAULT 20, cursor_ts timestamp with time zone DEFAULT NULL::timestamp with time zone, discover boolean DEFAULT false)
 RETURNS TABLE(id uuid, user_id uuid, run_id uuid, distance_km numeric, duration_sec integer, avg_pace text, activity_type text, route_points jsonb, territories_claimed integer, likes integer, comment_count integer, created_at timestamp with time zone, username text, avatar_url text, avatar_color text, pace_earned integer, territory_tier text, territory_area_m2 double precision, runner_rank text, post_type text, stolen_from_username text, stolen_area_m2 double precision, zone_tier text, stolen_from_user_id uuid, has_liked boolean, title text, content text, visibility text, photo_paths text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;
GRANT EXECUTE ON FUNCTION public.get_feed(integer, timestamp with time zone, boolean) TO authenticated;

-- ── Clubs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_message_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid NOT NULL REFERENCES public.lobby_messages(id) ON DELETE CASCADE,
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason      text NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'other')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS club_message_reports_club_idx ON public.club_message_reports (club_id, created_at DESC);
ALTER TABLE public.club_message_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.club_bans (
  club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  banned_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id)
);
ALTER TABLE public.club_bans ENABLE ROW LEVEL SECURITY;

-- Owner (clubs.owner_id) or a member with role owner/admin.
CREATE OR REPLACE FUNCTION public.is_club_moderator(p_club uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = p_club AND c.owner_id = p_user)
      OR EXISTS (SELECT 1 FROM public.club_members m
                  WHERE m.club_id = p_club AND m.user_id = p_user AND m.role IN ('owner', 'admin'));
$$;
GRANT EXECUTE ON FUNCTION public.is_club_moderator(uuid, uuid) TO authenticated;

-- Moderators read their club's reports.
DROP POLICY IF EXISTS "club_message_reports: moderators read" ON public.club_message_reports;
CREATE POLICY "club_message_reports: moderators read" ON public.club_message_reports
  FOR SELECT TO authenticated USING (public.is_club_moderator(club_id, auth.uid()));
DROP POLICY IF EXISTS "club_bans: moderators read" ON public.club_bans;
CREATE POLICY "club_bans: moderators read" ON public.club_bans
  FOR SELECT TO authenticated USING (public.is_club_moderator(club_id, auth.uid()));

-- A barred runner can't join by any route (open join, approval, RPC).
CREATE OR REPLACE FUNCTION public.refuse_banned_member()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.club_bans b WHERE b.club_id = NEW.club_id AND b.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'you were removed from this club' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_refuse_banned_member ON public.club_members;
CREATE TRIGGER trg_refuse_banned_member BEFORE INSERT ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION public.refuse_banned_member();
DROP TRIGGER IF EXISTS trg_refuse_banned_request ON public.club_join_requests;
CREATE TRIGGER trg_refuse_banned_request BEFORE INSERT ON public.club_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.refuse_banned_member();

-- Report a message in a club you belong to. At most 10 a day; once per message.
CREATE OR REPLACE FUNCTION public.report_club_message(p_message_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

-- Remove a member (and bar them). The owner can remove anyone but
-- themselves; an admin can remove only plain members.
CREATE OR REPLACE FUNCTION public.remove_club_member(p_club_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

-- Delete a club chat message: its author, or a club owner/admin.
CREATE OR REPLACE FUNCTION public.delete_club_message(p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

CREATE OR REPLACE FUNCTION public.unban_club_member(p_club_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_club_moderator(p_club_id, auth.uid()) THEN
    RAISE EXCEPTION 'only club owners and admins can do that' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.club_bans WHERE club_id = p_club_id AND user_id = p_user_id;
END;
$$;

-- Reports for moderators, newest first, with the message and its author.
CREATE OR REPLACE FUNCTION public.get_club_reports(p_club_id uuid)
RETURNS TABLE(message_id uuid, content text, author_id uuid, author_username text, reports bigint, reasons text[], last_reported timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.set_activity_photos(uuid, text[]), public.set_activity_excluded(uuid, boolean),
  public.report_club_message(uuid, text), public.remove_club_member(uuid, uuid), public.delete_club_message(uuid),
  public.unban_club_member(uuid, uuid), public.get_club_reports(uuid) TO authenticated;

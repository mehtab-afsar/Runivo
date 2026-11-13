-- ============================================================
-- Block, mute and report a runner
-- ============================================================
-- Block (two-way): neither of you sees the other's posts or comments, you
--   cannot follow, kudos or comment on each other, existing follows both ways
--   are removed, and the blocked runner sees no profile. The blocker still
--   sees a minimal profile, so they can unblock.
-- Mute (one-way, silent): their posts leave your feed. They are not told.
-- Report: a profile goes to a review queue (posts already have report_post).
--
-- Also: device_activities.raw_payload used to hold the whole Garmin push body,
-- which carries every user's access token. Clear those copies.

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON public.user_blocks (blocked_id);

CREATE TABLE IF NOT EXISTS public.user_mutes (
  muter_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (muter_id, muted_id),
  CHECK (muter_id <> muted_id)
);

CREATE TABLE IF NOT EXISTS public.user_reports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason         text NOT NULL CHECK (reason IN ('spam', 'harassment', 'impersonation', 'cheating', 'inappropriate', 'other')),
  details        text CHECK (details IS NULL OR length(details) <= 1000),
  status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_reports_target_idx ON public.user_reports (target_user_id, created_at DESC);

ALTER TABLE public.user_blocks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mutes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- You can read your own lists; writes go through the functions below.
DROP POLICY IF EXISTS "user_blocks: own" ON public.user_blocks;
CREATE POLICY "user_blocks: own" ON public.user_blocks FOR SELECT TO authenticated USING (blocker_id = auth.uid());
DROP POLICY IF EXISTS "user_mutes: own" ON public.user_mutes;
CREATE POLICY "user_mutes: own" ON public.user_mutes FOR SELECT TO authenticated USING (muter_id = auth.uid());
-- Reports are read by admins with the service role only.

-- ── Helpers ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_blocked_between(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a IS NOT NULL AND b IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_blocks
     WHERE (blocker_id = a AND blocked_id = b) OR (blocker_id = b AND blocked_id = a));
$$;

-- Everyone whose posts a viewer should not see: blocked either way, or muted by the viewer.
CREATE OR REPLACE FUNCTION public.hidden_user_ids(p_viewer uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT blocked_id FROM public.user_blocks WHERE blocker_id = p_viewer
  UNION SELECT blocker_id FROM public.user_blocks WHERE blocked_id = p_viewer
  UNION SELECT muted_id FROM public.user_mutes WHERE muter_id = p_viewer;
$$;

-- ── Actions ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.block_user(p_target uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF p_target IS NULL OR p_target = v_uid THEN RAISE EXCEPTION 'cannot block yourself' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES (v_uid, p_target) ON CONFLICT DO NOTHING;
  -- Unfollow both ways (sync_follow_counts keeps the counters right).
  DELETE FROM public.followers
   WHERE (follower_id = v_uid AND following_id = p_target)
      OR (follower_id = p_target AND following_id = v_uid);
  -- A block replaces a mute.
  DELETE FROM public.user_mutes WHERE muter_id = v_uid AND muted_id = p_target;
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_user(p_target uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.user_blocks WHERE blocker_id = auth.uid() AND blocked_id = p_target;
$$;

CREATE OR REPLACE FUNCTION public.mute_user(p_target uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF p_target IS NULL OR p_target = v_uid THEN RAISE EXCEPTION 'cannot mute yourself' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.user_mutes (muter_id, muted_id) VALUES (v_uid, p_target) ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.unmute_user(p_target uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.user_mutes WHERE muter_id = auth.uid() AND muted_id = p_target;
$$;

-- At most 5 open reports from one runner a day, and one open report per target.
CREATE OR REPLACE FUNCTION public.report_user(p_target uuid, p_reason text, p_details text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF p_target IS NULL OR p_target = v_uid THEN RAISE EXCEPTION 'cannot report yourself' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_reports WHERE reporter_id = v_uid AND target_user_id = p_target AND status = 'open') THEN
    RETURN;
  END IF;
  IF (SELECT count(*) FROM public.user_reports WHERE reporter_id = v_uid AND created_at > now() - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'too many reports today' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.user_reports (reporter_id, target_user_id, reason, details)
  VALUES (v_uid, p_target, p_reason, NULLIF(trim(COALESCE(p_details, '')), ''));
END;
$$;

-- Your blocked and muted runners, for Settings.
CREATE OR REPLACE FUNCTION public.get_my_blocks_and_mutes()
RETURNS TABLE(user_id uuid, username text, avatar_color text, kind text, since timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.block_user(uuid), public.unblock_user(uuid),
  public.mute_user(uuid), public.unmute_user(uuid),
  public.report_user(uuid, text, text), public.get_my_blocks_and_mutes() TO authenticated;
REVOKE ALL ON FUNCTION public.hidden_user_ids(uuid) FROM PUBLIC, authenticated;

-- ── Enforcement ─────────────────────────────────────────────────────────────
-- No follows across a block (covers toggle_follow and direct inserts).
CREATE OR REPLACE FUNCTION public.refuse_blocked_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.is_blocked_between(NEW.follower_id, NEW.following_id) THEN
    RAISE EXCEPTION 'blocked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS followers_refuse_blocked ON public.followers;
CREATE TRIGGER followers_refuse_blocked BEFORE INSERT ON public.followers
  FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_follow();

-- No kudos or comments across a block.
CREATE OR REPLACE FUNCTION public.refuse_blocked_interaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.feed_posts WHERE id = NEW.post_id;
  IF public.is_blocked_between(NEW.user_id, v_owner) THEN
    RAISE EXCEPTION 'blocked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS likes_refuse_blocked ON public.feed_post_likes;
CREATE TRIGGER likes_refuse_blocked BEFORE INSERT ON public.feed_post_likes
  FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_interaction();
DROP TRIGGER IF EXISTS comments_refuse_blocked ON public.feed_post_comments;
CREATE TRIGGER comments_refuse_blocked BEFORE INSERT ON public.feed_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_interaction();

-- Feed: same as 20260809000002, minus anyone hidden from the viewer.
CREATE OR REPLACE FUNCTION public.get_feed(lim integer DEFAULT 20, cursor_ts timestamp with time zone DEFAULT NULL::timestamp with time zone, discover boolean DEFAULT false)
 RETURNS TABLE(id uuid, user_id uuid, run_id uuid, distance_km numeric, duration_sec integer, avg_pace text, activity_type text, route_points jsonb, territories_claimed integer, likes integer, comment_count integer, created_at timestamp with time zone, username text, avatar_url text, avatar_color text, pace_earned integer, territory_tier text, territory_area_m2 double precision, runner_rank text, post_type text, stolen_from_username text, stolen_area_m2 double precision, zone_tier text, stolen_from_user_id uuid, has_liked boolean)
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
    ) AS has_liked
  FROM public.feed_posts fp
  JOIN public.profiles p ON p.id = fp.user_id
  WHERE
    (cursor_ts IS NULL OR fp.created_at < cursor_ts)
    AND fp.user_id NOT IN (SELECT public.hidden_user_ids(auth.uid()))
    AND (
      CASE WHEN discover THEN
        fp.user_id != auth.uid()
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

-- Comments: nothing from anyone blocked either way.
CREATE OR REPLACE FUNCTION public.get_comments(p_post_id uuid, lim integer DEFAULT 50)
 RETURNS TABLE(id uuid, user_id uuid, username text, avatar_color text, content text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT c.id, c.user_id, p.username, p.avatar_color,
         c.content, c.created_at
  FROM public.feed_post_comments c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.post_id = p_post_id
    AND NOT public.is_blocked_between(auth.uid(), c.user_id)
  ORDER BY c.created_at ASC
  LIMIT lim;
$function$;

-- Profile: the blocked runner sees nothing; the blocker sees the minimal header (to unblock).
CREATE OR REPLACE FUNCTION public.get_user_profile_for_viewer(p_target_id uuid)
 RETURNS TABLE(username text, display_name text, bio text, location text, avatar_url text, avatar_color text, runner_rank text, total_runs integer, total_distance_km double precision, total_territories_claimed integer, follower_count integer, following_count integer, restricted boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

-- ── Old Garmin payload copies ───────────────────────────────────────────────
UPDATE public.device_activities
   SET raw_payload = NULL
 WHERE raw_payload IS NOT NULL
   AND (raw_payload ? 'activities' OR raw_payload ? 'activityFiles');

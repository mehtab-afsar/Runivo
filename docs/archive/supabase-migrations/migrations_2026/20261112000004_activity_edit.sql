-- ============================================================
-- Edit an activity, choose who sees it, delete it
-- ============================================================
-- Strava's activity edit: title, description, perceived effort, private notes,
-- and who can see it (everyone / followers / only you), with a default for new
-- activities. Plus delete.
--
-- Who-can-see is enforced on the table itself (feed_posts' read policy used to
-- be `true` for every signed-in user), in get_feed, and for kudos and comments.
-- Deleting an activity removes the run and its post; zones it claimed and PACE
-- it earned stay (they are ledger and map state, not the post).

ALTER TABLE public.runs
  ADD COLUMN IF NOT EXISTS title            text,
  ADD COLUMN IF NOT EXISTS description      text,
  ADD COLUMN IF NOT EXISTS private_notes    text,
  ADD COLUMN IF NOT EXISTS perceived_effort smallint;
ALTER TABLE public.runs DROP CONSTRAINT IF EXISTS runs_edit_lengths_check;
ALTER TABLE public.runs ADD CONSTRAINT runs_edit_lengths_check CHECK (
  (title IS NULL OR length(title) <= 80)
  AND (description IS NULL OR length(description) <= 2000)
  AND (private_notes IS NULL OR length(private_notes) <= 2000)
  AND (perceived_effort IS NULL OR perceived_effort BETWEEN 1 AND 10));

-- The distance check re-ran on every update, so editing a title re-validated
-- the whole run (and failed for runs without a stored trace). Only re-check
-- when something it measures changes.
DROP TRIGGER IF EXISTS runs_validate_distance ON public.runs;
CREATE TRIGGER runs_validate_distance
  BEFORE INSERT OR UPDATE OF distance_m, duration_sec, gps_points, activity_type, started_at, finished_at
  ON public.runs FOR EACH ROW EXECUTE FUNCTION public.validate_run_distance();

ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS title      text,
  ADD COLUMN IF NOT EXISTS visibility text;
UPDATE public.feed_posts SET visibility = 'everyone' WHERE visibility IS NULL;
ALTER TABLE public.feed_posts DROP CONSTRAINT IF EXISTS feed_posts_visibility_check;
ALTER TABLE public.feed_posts ADD CONSTRAINT feed_posts_visibility_check
  CHECK (visibility IN ('everyone', 'followers', 'only_me'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_activity_visibility text NOT NULL DEFAULT 'everyone';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_default_activity_visibility_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_default_activity_visibility_check
  CHECK (default_activity_visibility IN ('everyone', 'followers', 'only_me'));

-- New posts take the author's default unless the insert says otherwise.
CREATE OR REPLACE FUNCTION public.fill_post_visibility()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
DROP TRIGGER IF EXISTS feed_posts_fill_visibility ON public.feed_posts;
CREATE TRIGGER feed_posts_fill_visibility BEFORE INSERT ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.fill_post_visibility();

-- One rule for who may see a post.
CREATE OR REPLACE FUNCTION public.can_view_post(p_viewer uuid, p_author uuid, p_visibility text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
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

DROP POLICY IF EXISTS "feed_posts: authenticated can read" ON public.feed_posts;
DROP POLICY IF EXISTS "feed_posts: visible to viewer" ON public.feed_posts;
CREATE POLICY "feed_posts: visible to viewer" ON public.feed_posts
  FOR SELECT TO authenticated
  USING (public.can_view_post(auth.uid(), user_id, visibility));

-- Kudos and comments only on posts you can see (also covers blocks).
CREATE OR REPLACE FUNCTION public.refuse_blocked_interaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_owner uuid; v_vis text;
BEGIN
  SELECT user_id, visibility INTO v_owner, v_vis FROM public.feed_posts WHERE id = NEW.post_id;
  IF v_owner IS NULL OR NOT public.can_view_post(NEW.user_id, v_owner, v_vis) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Feed: adds title, description and visibility; only posts you may see;
-- Discover shows only posts meant for everyone.
DROP FUNCTION IF EXISTS public.get_feed(integer, timestamp with time zone, boolean);
CREATE FUNCTION public.get_feed(lim integer DEFAULT 20, cursor_ts timestamp with time zone DEFAULT NULL::timestamp with time zone, discover boolean DEFAULT false)
 RETURNS TABLE(id uuid, user_id uuid, run_id uuid, distance_km numeric, duration_sec integer, avg_pace text, activity_type text, route_points jsonb, territories_claimed integer, likes integer, comment_count integer, created_at timestamp with time zone, username text, avatar_url text, avatar_color text, pace_earned integer, territory_tier text, territory_area_m2 double precision, runner_rank text, post_type text, stolen_from_username text, stolen_area_m2 double precision, zone_tier text, stolen_from_user_id uuid, has_liked boolean, title text, content text, visibility text)
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
    fp.title, fp.content, fp.visibility
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

-- Save the edit sheet. Title and description go on the run and its post;
-- private notes and effort stay on the run, which only its owner can read.
CREATE OR REPLACE FUNCTION public.update_activity(
  p_run_id           uuid,
  p_title            text,
  p_description      text,
  p_visibility       text,
  p_perceived_effort smallint DEFAULT NULL,
  p_private_notes    text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

-- Delete an activity and its post. Returns false when it was not yours or not found.
CREATE OR REPLACE FUNCTION public.delete_activity(p_run_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

CREATE OR REPLACE FUNCTION public.set_default_activity_visibility(p_visibility text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF p_visibility NOT IN ('everyone', 'followers', 'only_me') THEN
    RAISE EXCEPTION 'visibility must be everyone, followers or only_me' USING ERRCODE = '22023';
  END IF;
  UPDATE public.profiles SET default_activity_visibility = p_visibility WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_activity(uuid, text, text, text, smallint, text),
  public.delete_activity(uuid), public.set_default_activity_visibility(text) TO authenticated;

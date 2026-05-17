-- ============================================================
-- Migration 066: Feed redesign
--   • New columns on feed_posts: duration_sec, avg_pace, activity_type, route_points
--   • toggle_like RPC: atomic, single-param (auth.uid() only)
--   • get_comments RPC
--   • add_comment RPC
--   • feed_post_comments RLS policies
--   • get_feed RPC: cursor pagination + discover mode + has_liked column
-- ============================================================

-- 1. New columns on feed_posts
ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS duration_sec   INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_pace       TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS activity_type  TEXT NOT NULL DEFAULT 'run',
  ADD COLUMN IF NOT EXISTS route_points   JSONB;

-- 2. toggle_like RPC (atomic, auth.uid()-only, returns liked + new count)
DROP FUNCTION IF EXISTS public.toggle_like(UUID, UUID);
CREATE OR REPLACE FUNCTION public.toggle_like(p_post_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- 3. feed_post_comments RLS (idempotent)
ALTER TABLE public.feed_post_comments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'feed_post_comments' AND policyname = 'comments_read'
  ) THEN
    CREATE POLICY "comments_read" ON public.feed_post_comments
      FOR SELECT USING (true);
    CREATE POLICY "comments_write" ON public.feed_post_comments
      FOR INSERT WITH CHECK (user_id = auth.uid());
    CREATE POLICY "comments_delete" ON public.feed_post_comments
      FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- 4. get_comments RPC
CREATE OR REPLACE FUNCTION public.get_comments(p_post_id UUID, lim INT DEFAULT 50)
RETURNS TABLE(
  id           UUID,
  user_id      UUID,
  username     TEXT,
  avatar_color TEXT,
  content      TEXT,
  created_at   TIMESTAMPTZ
) LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT c.id, c.user_id, p.username, p.avatar_color,
         c.content, c.created_at
  FROM public.feed_post_comments c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.post_id = p_post_id
  ORDER BY c.created_at ASC
  LIMIT lim;
$$;

-- 5. add_comment RPC
CREATE OR REPLACE FUNCTION public.add_comment(p_post_id UUID, p_content TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.feed_post_comments (post_id, user_id, content)
  VALUES (p_post_id, auth.uid(), trim(p_content))
  RETURNING id INTO v_id;
  UPDATE public.feed_posts SET comment_count = comment_count + 1 WHERE id = p_post_id;
  RETURN v_id;
END;
$$;

-- 6. Replace get_feed: cursor pagination + discover mode + has_liked
DROP FUNCTION IF EXISTS public.get_feed(INT, INT);
CREATE OR REPLACE FUNCTION public.get_feed(
  lim        INT DEFAULT 20,
  cursor_ts  TIMESTAMPTZ DEFAULT NULL,
  discover   BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id                   UUID,
  user_id              UUID,
  run_id               UUID,
  distance_km          NUMERIC,
  duration_sec         INT,
  avg_pace             TEXT,
  activity_type        TEXT,
  route_points         JSONB,
  territories_claimed  INT,
  likes                INT,
  comment_count        INT,
  created_at           TIMESTAMPTZ,
  username             TEXT,
  avatar_url           TEXT,
  avatar_color         TEXT,
  pace_earned          INT,
  territory_tier       TEXT,
  territory_area_m2    FLOAT8,
  runner_rank          TEXT,
  post_type            TEXT,
  has_liked            BOOLEAN
) LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT
    fp.id, fp.user_id, fp.run_id,
    fp.distance_km, fp.duration_sec, fp.avg_pace, fp.activity_type, fp.route_points,
    fp.territories_claimed, fp.likes, fp.comment_count, fp.created_at,
    p.username, p.avatar_url, p.avatar_color,
    fp.pace_earned, fp.territory_tier, fp.territory_area_m2, fp.runner_rank,
    fp.post_type,
    EXISTS(
      SELECT 1 FROM public.feed_post_likes l
      WHERE l.post_id = fp.id AND l.user_id = auth.uid()
    ) AS has_liked
  FROM public.feed_posts fp
  JOIN public.profiles p ON p.id = fp.user_id
  WHERE
    (cursor_ts IS NULL OR fp.created_at < cursor_ts)
    AND fp.post_type = 'run'
    AND (
      CASE WHEN discover THEN
        fp.user_id != auth.uid()
        AND fp.user_id NOT IN (
          SELECT following_id FROM public.followers WHERE follower_id = auth.uid()
        )
      ELSE
        fp.user_id = auth.uid()
        OR fp.user_id IN (
          SELECT following_id FROM public.followers WHERE follower_id = auth.uid()
        )
      END
    )
  ORDER BY fp.created_at DESC
  LIMIT lim;
$$;

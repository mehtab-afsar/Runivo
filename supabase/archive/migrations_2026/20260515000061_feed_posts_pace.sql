-- ============================================================
-- Migration 061: Feed posts — add PACE + territory fields
-- ============================================================
-- feed_posts previously stored only distance_km, territories_claimed,
-- xp_earned (not present), leveled_up (not present). Posts showed
-- "142 XP" / "Level Up!" which were never populated — dead UI.
--
-- Adds: pace_earned, territory_tier, territory_area_m2, runner_rank
-- Updates: get_feed() RPC to return the new columns
-- ============================================================

ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS pace_earned       INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS territory_tier    TEXT,
  ADD COLUMN IF NOT EXISTS territory_area_m2 FLOAT8,
  ADD COLUMN IF NOT EXISTS runner_rank       TEXT    NOT NULL DEFAULT 'pacer';

COMMENT ON COLUMN public.feed_posts.pace_earned       IS 'PACE tokens earned in this run';
COMMENT ON COLUMN public.feed_posts.territory_tier    IS 'Highest tier territory claimed: patch|block|district|quarter|domain';
COMMENT ON COLUMN public.feed_posts.territory_area_m2 IS 'Area of territory polygon in m²';
COMMENT ON COLUMN public.feed_posts.runner_rank       IS 'Runner rank at time of post';

-- ----------------------------------------------------------------
-- Update get_feed() to return new columns
-- Only the SELECT clause changes — joins, WHERE, ORDER BY unchanged.
-- DROP required because CREATE OR REPLACE cannot change return type columns
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_feed(int, int);

CREATE OR REPLACE FUNCTION public.get_feed(lim int DEFAULT 40, off_set int DEFAULT 0)
RETURNS TABLE (
  id                  uuid,
  user_id             uuid,
  run_id              uuid,
  content             text,
  distance_km         numeric,
  territories_claimed int,
  likes               int,
  comment_count       int,
  created_at          timestamptz,
  username            text,
  avatar_url          text,
  level               int,
  pace_earned         int,
  territory_tier      text,
  territory_area_m2   float8,
  runner_rank         text
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    fp.id, fp.user_id, fp.run_id, fp.content,
    fp.distance_km, fp.territories_claimed, fp.likes, fp.comment_count,
    fp.created_at, p.username, p.avatar_url, p.level,
    fp.pace_earned, fp.territory_tier, fp.territory_area_m2, fp.runner_rank
  FROM public.feed_posts fp
  JOIN public.profiles p ON p.id = fp.user_id
  WHERE fp.user_id = auth.uid()
     OR fp.user_id IN (
          SELECT following_id FROM public.followers WHERE follower_id = auth.uid()
        )
  ORDER BY fp.created_at DESC
  LIMIT lim OFFSET off_set;
$$;

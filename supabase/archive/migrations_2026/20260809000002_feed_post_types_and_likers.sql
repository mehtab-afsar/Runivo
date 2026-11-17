-- ============================================================
-- Surface conquest / attack / milestone posts + kudos-avatar preview
-- ============================================================
-- process-run-territory writes three post_types beyond 'run':
--   'conquest'  — attacker's own trophy post ("you captured X's territory")
--   'attack'    — victim's own post ("your territory was attacked")
--   'milestone' — the runner's own tier-PR post (largest zone improved)
-- 20260518000066_feed_redesign.sql rewrote get_feed and hard-filtered to
-- post_type = 'run', which regressed a privacy rule the prior version
-- (20260515000063) had already established deliberately: attack posts are
-- victim-only, never shown to the attacker's or victim's followers. That
-- rule is restored here, and conquest/milestone — public, non-sensitive
-- content — are surfaced:
--   • Following: your own posts of any type, plus followed users' run /
--     conquest / milestone posts. Their attack posts (i.e. them being
--     victimized) are not shown to you — only to them, via the self branch.
--   • Discover: strangers' run / conquest posts only (public boasts), never
--     their milestones or attacks.
-- Also restores the stolen_* columns (stolen_from_username, stolen_area_m2,
-- zone_tier, stolen_from_user_id) that 20260515000063 added and the 066
-- rewrite dropped from the return type.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_feed(INT, TIMESTAMPTZ, BOOLEAN);
CREATE OR REPLACE FUNCTION public.get_feed(
  lim        INT DEFAULT 20,
  cursor_ts  TIMESTAMPTZ DEFAULT NULL,
  discover   BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id                    UUID,
  user_id               UUID,
  run_id                UUID,
  distance_km           NUMERIC,
  duration_sec          INT,
  avg_pace              TEXT,
  activity_type         TEXT,
  route_points          JSONB,
  territories_claimed   INT,
  likes                 INT,
  comment_count         INT,
  created_at            TIMESTAMPTZ,
  username              TEXT,
  avatar_url            TEXT,
  avatar_color          TEXT,
  pace_earned           INT,
  territory_tier        TEXT,
  territory_area_m2     FLOAT8,
  runner_rank           TEXT,
  post_type             TEXT,
  stolen_from_username  TEXT,
  stolen_area_m2        FLOAT8,
  zone_tier             TEXT,
  stolen_from_user_id   UUID,
  has_liked             BOOLEAN
) LANGUAGE SQL STABLE SECURITY DEFINER AS $$
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
$$;

-- ----------------------------------------------------------------
-- Kudos preview: small list of who liked a post, for a "liked by X, Y +N"
-- row on the card instead of a bare count.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_post_likers(p_post_id UUID, lim INT DEFAULT 3)
RETURNS TABLE(
  id           UUID,
  username     TEXT,
  avatar_url   TEXT,
  avatar_color TEXT
) LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT p.id, p.username, p.avatar_url, p.avatar_color
  FROM public.feed_post_likes l
  JOIN public.profiles p ON p.id = l.user_id
  WHERE l.post_id = p_post_id
  ORDER BY l.created_at DESC
  LIMIT lim;
$$;

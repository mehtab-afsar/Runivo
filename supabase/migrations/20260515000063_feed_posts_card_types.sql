-- Battle card columns
ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS post_type            TEXT    NOT NULL DEFAULT 'run',
  ADD COLUMN IF NOT EXISTS stolen_from_username TEXT,
  ADD COLUMN IF NOT EXISTS stolen_area_m2       FLOAT8,
  ADD COLUMN IF NOT EXISTS zone_tier            TEXT,
  ADD COLUMN IF NOT EXISTS stolen_from_user_id  UUID    REFERENCES public.profiles(id);

-- Replace get_feed: add new columns + attack-card privacy filter (attack posts only visible to victim)
-- DROP required because return type changes (removes level, adds post_type/stolen_* columns)
DROP FUNCTION IF EXISTS public.get_feed(int, int);

CREATE OR REPLACE FUNCTION public.get_feed(lim int DEFAULT 40, off_set int DEFAULT 0)
RETURNS TABLE (
  id                   uuid,
  user_id              uuid,
  run_id               uuid,
  content              text,
  distance_km          numeric,
  territories_claimed  int,
  likes                int,
  comment_count        int,
  created_at           timestamptz,
  username             text,
  avatar_url           text,
  pace_earned          int,
  territory_tier       text,
  territory_area_m2    float8,
  runner_rank          text,
  post_type            text,
  stolen_from_username text,
  stolen_area_m2       float8,
  zone_tier            text,
  stolen_from_user_id  uuid
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    fp.id, fp.user_id, fp.run_id, fp.content,
    fp.distance_km, fp.territories_claimed, fp.likes, fp.comment_count,
    fp.created_at, p.username, p.avatar_url,
    fp.pace_earned, fp.territory_tier, fp.territory_area_m2, fp.runner_rank,
    fp.post_type, fp.stolen_from_username, fp.stolen_area_m2,
    fp.zone_tier, fp.stolen_from_user_id
  FROM public.feed_posts fp
  JOIN public.profiles p ON p.id = fp.user_id
  WHERE (
    fp.user_id = auth.uid()
    OR (
      fp.user_id IN (
        SELECT following_id FROM public.followers WHERE follower_id = auth.uid()
      )
      AND fp.post_type != 'attack'
    )
  )
  ORDER BY fp.created_at DESC
  LIMIT lim OFFSET off_set;
$$;

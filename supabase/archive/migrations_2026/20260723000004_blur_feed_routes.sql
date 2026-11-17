-- ============================================================
-- H-7: Stop the feed leaking precise start/end coordinates
-- ============================================================
-- 20260701000076_runs_owner_scope.sql locked runs.gps_points to the owner because
-- "any authenticated user could read anyone's exact routes (home, work, daily
-- schedule)". Its own header notes at line 16 that the social feed reads
-- feed_posts.route_points instead — and that column kept a full-precision copy of
-- the same trace, readable by every authenticated user via `feed_posts: anyone can
-- read` (20260301000004_rls.sql:211) and served to everyone by the SECURITY DEFINER
-- get_feed() RPC. The fix was bypassed through the other door.
--
-- Scoping the read policy is not the answer here: get_feed() is SECURITY DEFINER so
-- it bypasses RLS anyway, and the feed has a `discover` mode that is *meant* to show
-- strangers' posts. What is not meant to be public is where the runner lives.
--
-- So the stored copy is degraded at write time. The feed only renders a small route
-- thumbnail (RouteMapHero, shown at >= 5 points), which needs shape, not survey
-- precision:
--   • drop every point within 200 m of the start or the end — removes the home /
--     finish anchor, which is the actual privacy leak
--   • round what remains to 4 decimal places (~11 m) — plenty for a thumbnail
-- A run whose whole trace falls inside those radii ends up with an empty array and
-- simply renders without a map.

CREATE OR REPLACE FUNCTION public.blur_route(
  points   jsonb,
  trim_m   numeric DEFAULT 200,
  decimals int     DEFAULT 4
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
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

COMMENT ON FUNCTION public.blur_route IS
  'Removes the start/end anchor points and reduces precision of a [{lat,lng}] route '
  'before it is exposed to other users. See 20260723000004_blur_feed_routes.sql.';

-- ── Apply on write ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.blur_feed_post_route()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.route_points IS NOT NULL AND jsonb_typeof(NEW.route_points) = 'array' THEN
    NEW.route_points := public.blur_route(NEW.route_points);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feed_posts_blur_route ON public.feed_posts;

CREATE TRIGGER feed_posts_blur_route
  BEFORE INSERT OR UPDATE OF route_points ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.blur_feed_post_route();

-- ── Backfill rows written before this migration ─────────────────────────────
UPDATE public.feed_posts
   SET route_points = public.blur_route(route_points)
 WHERE route_points IS NOT NULL
   AND jsonb_typeof(route_points) = 'array'
   AND jsonb_array_length(route_points) > 0;

-- ── The feed is not public data; anon has no business reading it ────────────
DROP POLICY IF EXISTS "feed_posts: anyone can read" ON public.feed_posts;

CREATE POLICY "feed_posts: authenticated can read"
  ON public.feed_posts FOR SELECT TO authenticated
  USING (true);

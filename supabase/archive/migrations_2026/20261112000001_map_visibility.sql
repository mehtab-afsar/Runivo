-- ============================================================
-- Map visibility: the runner decides how much of their route others see
-- ============================================================
-- 20260723000004_blur_feed_routes.sql already trims a fixed 200 m from both
-- ends of every feed route and rounds it to ~11 m. This adds Strava's "Edit
-- Map Visibility" controls on top of that floor:
--   • hide 200 / 400 / 800 / 1,600 m from the start and end of every activity
--     (200 m stays the minimum for everyone);
--   • hide all maps: activities post without a route;
--   • hide the map on one activity.
-- Settings reach past posts too. Feed posts hold only the degraded copy, so
-- loosening a setting rebuilds each post's route from the owner's own run
-- (runs.gps_points, readable only by its owner) inside a SECURITY DEFINER
-- function. Nobody but the owner can trigger that rebuild.
--
-- Rides, walks and every other sport follow the same rules.
-- Zones are not trimmed here: a zone is ground claimed, not a trace.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS map_hide_radius_m integer NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS map_hide_all      boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_map_hide_radius_m_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_map_hide_radius_m_check
  CHECK (map_hide_radius_m IN (200, 400, 800, 1600));

ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS map_hidden boolean NOT NULL DEFAULT false;

-- The route others may see, for one author, under their current settings.
CREATE OR REPLACE FUNCTION public.public_route_for(p_user uuid, p_points jsonb, p_post_hidden boolean)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_post_hidden OR COALESCE(pr.map_hide_all, false) THEN '[]'::jsonb
    ELSE public.blur_route(p_points, GREATEST(200, COALESCE(pr.map_hide_radius_m, 200)))
  END
  FROM (SELECT 1) one
  LEFT JOIN public.profiles pr ON pr.id = p_user;
$$;

-- Every write to a post's route goes through the author's settings.
CREATE OR REPLACE FUNCTION public.blur_feed_post_route()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.route_points IS NOT NULL AND jsonb_typeof(NEW.route_points) = 'array' THEN
    NEW.route_points := public.public_route_for(NEW.user_id, NEW.route_points, NEW.map_hidden);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feed_posts_blur_route ON public.feed_posts;
CREATE TRIGGER feed_posts_blur_route
  BEFORE INSERT OR UPDATE OF route_points, map_hidden ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.blur_feed_post_route();

-- Re-derive the caller's post routes under their current settings. From the
-- private run where it still exists (so a looser setting can show more again);
-- otherwise from the stored copy, which can only lose more points.
CREATE OR REPLACE FUNCTION public.refresh_post_routes(p_user uuid, p_run_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_raw    integer;
  n_stored integer;
BEGIN
  UPDATE public.feed_posts fp
     SET route_points = (
           SELECT jsonb_agg(jsonb_build_object('lat', e->'lat', 'lng', e->'lng') ORDER BY ord)
             FROM jsonb_array_elements(r.gps_points) WITH ORDINALITY AS t(e, ord)
            WHERE e ? 'lat' AND e ? 'lng')
    FROM public.runs r
   WHERE fp.user_id = p_user
     AND (p_run_id IS NULL OR fp.run_id = p_run_id)
     AND fp.route_points IS NOT NULL
     AND r.id = fp.run_id
     AND r.user_id = p_user
     AND jsonb_typeof(r.gps_points) = 'array'
     AND jsonb_array_length(r.gps_points) > 1;
  GET DIAGNOSTICS n_raw = ROW_COUNT;

  UPDATE public.feed_posts fp
     SET route_points = fp.route_points
   WHERE fp.user_id = p_user
     AND (p_run_id IS NULL OR fp.run_id = p_run_id)
     AND fp.route_points IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.runs r
        WHERE r.id = fp.run_id AND r.user_id = p_user
          AND jsonb_typeof(r.gps_points) = 'array'
          AND jsonb_array_length(r.gps_points) > 1);
  GET DIAGNOSTICS n_stored = ROW_COUNT;

  RETURN n_raw + n_stored;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_post_routes(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_post_routes(uuid, uuid) FROM authenticated;

-- Settings screen: save both choices and apply them to every post.
CREATE OR REPLACE FUNCTION public.set_map_visibility(p_radius_m integer, p_hide_all boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n   integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF p_radius_m NOT IN (200, 400, 800, 1600) THEN
    RAISE EXCEPTION 'radius must be 200, 400, 800 or 1600 m' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
     SET map_hide_radius_m = p_radius_m,
         map_hide_all      = COALESCE(p_hide_all, false)
   WHERE id = v_uid;

  v_n := public.refresh_post_routes(v_uid, NULL);
  RETURN jsonb_build_object('radius_m', p_radius_m, 'hide_all', COALESCE(p_hide_all, false), 'posts_updated', v_n);
END;
$$;

-- Activity screen: hide or show the map on one activity's post.
CREATE OR REPLACE FUNCTION public.set_activity_map_hidden(p_run_id uuid, p_hidden boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n   integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;

  UPDATE public.feed_posts
     SET map_hidden = COALESCE(p_hidden, false)
   WHERE user_id = v_uid AND run_id = p_run_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- Showing it again needs the route back from the private run.
  IF v_n > 0 AND NOT COALESCE(p_hidden, false) THEN
    PERFORM public.refresh_post_routes(v_uid, p_run_id);
  END IF;
  RETURN v_n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_map_visibility(integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_activity_map_hidden(uuid, boolean) TO authenticated;

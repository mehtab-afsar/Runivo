-- ============================================================
-- Private places (PRD M6, F1) and privacy controls (PRD X1)
-- ============================================================
-- Private places: up to 5 addresses (home, work…) with a radius. Others
-- never see a zone of yours that comes within one, and every route point
-- inside one is removed from what others see (on top of the start/end trim).
-- The zones still count for you; only their visibility changes.
--
-- Controls: hide yourself from leaderboards (you still see your own rank)
-- and hide your zones from the zone map. Both apply to everything at once,
-- past and future, because they are checked when data is read.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.privacy_places (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label      text NOT NULL DEFAULT 'Home' CHECK (length(label) BETWEEN 1 AND 40),
  center     geography(Point, 4326) NOT NULL,
  radius_m   integer NOT NULL DEFAULT 400 CHECK (radius_m IN (200, 400, 800, 1600)),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS privacy_places_user_idx ON public.privacy_places (user_id);
ALTER TABLE public.privacy_places ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "privacy_places: own" ON public.privacy_places;
CREATE POLICY "privacy_places: own" ON public.privacy_places FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hide_from_leaderboards boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hide_zones_from_map   boolean NOT NULL DEFAULT false;
ALTER TABLE public.territory_polygons ADD COLUMN IF NOT EXISTS near_private_place boolean NOT NULL DEFAULT false;

-- ── Zones ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.zone_near_private_place(p_owner uuid, p_geom geometry)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.privacy_places pp
     WHERE pp.user_id = p_owner AND ST_DWithin(p_geom::geography, pp.center, pp.radius_m)
  );
$$;
REVOKE ALL ON FUNCTION public.zone_near_private_place(uuid, geometry) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_private_zone()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.near_private_place := NEW.owner_id IS NOT NULL AND public.zone_near_private_place(NEW.owner_id, NEW.geom);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_mark_private_zone ON public.territory_polygons;
CREATE TRIGGER trg_mark_private_zone BEFORE INSERT OR UPDATE OF geom, owner_id ON public.territory_polygons
  FOR EACH ROW EXECUTE FUNCTION public.mark_private_zone();

-- Others see a zone only when it's away from the owner's private places and
-- the owner shows zones on the map. Owners always see their own.
DROP POLICY IF EXISTS "tp_read" ON public.territory_polygons;
CREATE POLICY "tp_read" ON public.territory_polygons FOR SELECT USING (
  owner_id = auth.uid()
  OR (
    NOT near_private_place
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = territory_polygons.owner_id AND p.hide_zones_from_map)
  )
);

-- Definer functions that return zone shapes apply the same rule.
CREATE OR REPLACE FUNCTION public.zone_visible_to(p_viewer uuid, p_owner uuid, p_near_private boolean)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_owner = p_viewer
      OR (NOT p_near_private AND NOT COALESCE((SELECT hide_zones_from_map FROM public.profiles WHERE id = p_owner), false));
$$;
GRANT EXECUTE ON FUNCTION public.zone_visible_to(uuid, uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_club_territory(p_club_id uuid)
RETURNS TABLE(id uuid, owner_id uuid, owner_name text, polygon_coords jsonb, area_m2 double precision, freshness smallint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.owner_id, p.username,
         CASE WHEN public.zone_visible_to(auth.uid(), t.owner_id, t.near_private_place) THEN t.polygon_coords END,
         t.area_m2, t.freshness
    FROM public.territory_polygons t
    JOIN public.club_members m ON m.user_id = t.owner_id AND m.club_id = p_club_id
    JOIN public.profiles p ON p.id = t.owner_id
   LIMIT 2000;
$$;

-- ── Routes ──────────────────────────────────────────────────
-- Drop every point inside one of the user's private places.
CREATE OR REPLACE FUNCTION public.drop_private_points(p_user uuid, p_points jsonb)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN p_points IS NULL OR jsonb_typeof(p_points) <> 'array' THEN p_points
    WHEN NOT EXISTS (SELECT 1 FROM public.privacy_places WHERE user_id = p_user) THEN p_points
    ELSE COALESCE((
      SELECT jsonb_agg(e ORDER BY ord)
        FROM jsonb_array_elements(p_points) WITH ORDINALITY AS t(e, ord)
       WHERE NOT EXISTS (
         SELECT 1 FROM public.privacy_places pp
          WHERE pp.user_id = p_user
            AND (e->>'lat') IS NOT NULL AND (e->>'lng') IS NOT NULL
            AND ST_DWithin(ST_SetSRID(ST_MakePoint((e->>'lng')::float8, (e->>'lat')::float8), 4326)::geography, pp.center, pp.radius_m)
       )), '[]'::jsonb)
  END;
$$;
REVOKE ALL ON FUNCTION public.drop_private_points(uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_route_for(p_user uuid, p_points jsonb, p_post_hidden boolean)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN p_post_hidden OR COALESCE(pr.map_hide_all, false) THEN '[]'::jsonb
    ELSE public.drop_private_points(p_user, public.blur_route(p_points, GREATEST(200, COALESCE(pr.map_hide_radius_m, 200))))
  END
  FROM (SELECT 1) one
  LEFT JOIN public.profiles pr ON pr.id = p_user;
$$;

-- ── Managing places (re-marks zones and re-trims past posts) ─
CREATE OR REPLACE FUNCTION public.refresh_private_zones(p_user uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.territory_polygons t
     SET near_private_place = public.zone_near_private_place(p_user, t.geom)
   WHERE t.owner_id = p_user;
$$;
REVOKE ALL ON FUNCTION public.refresh_private_zones(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.add_privacy_place(p_label text, p_lat float8, p_lng float8, p_radius_m integer DEFAULT 400)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'bad position' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(*) FROM public.privacy_places WHERE user_id = v_uid) >= 5 THEN
    RAISE EXCEPTION 'at most 5 private places' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.privacy_places (user_id, label, center, radius_m)
  VALUES (v_uid, COALESCE(NULLIF(trim(p_label), ''), 'Home'), ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, COALESCE(p_radius_m, 400))
  RETURNING id INTO v_id;
  PERFORM public.refresh_private_zones(v_uid);
  PERFORM public.refresh_post_routes(v_uid);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_privacy_place(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  DELETE FROM public.privacy_places WHERE id = p_id AND user_id = v_uid;
  PERFORM public.refresh_private_zones(v_uid);
  PERFORM public.refresh_post_routes(v_uid);
END;
$$;

-- Places for the settings page: label, radius and position (yours only).
CREATE OR REPLACE FUNCTION public.get_my_privacy_places()
RETURNS TABLE(id uuid, label text, radius_m integer, lat float8, lng float8)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, label, radius_m, ST_Y(center::geometry), ST_X(center::geometry)
    FROM public.privacy_places WHERE user_id = auth.uid() ORDER BY created_at;
$$;

-- ── Leaderboards: hidden runners leave every board (you still see your own rank) ─
ALTER FUNCTION public.leaderboard_values(text, text) RENAME TO leaderboard_values_all;
CREATE FUNCTION public.leaderboard_values(p_metric text, p_period text)
RETURNS TABLE(user_id uuid, value numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.user_id, v.value
    FROM public.leaderboard_values_all(p_metric, p_period) v
   WHERE v.user_id = auth.uid()
      OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v.user_id AND p.hide_from_leaderboards);
$$;
REVOKE ALL ON FUNCTION public.leaderboard_values(text, text), public.leaderboard_values_all(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_privacy_controls(p_hide_from_leaderboards boolean, p_hide_zones_from_map boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  UPDATE public.profiles
     SET hide_from_leaderboards = COALESCE(p_hide_from_leaderboards, hide_from_leaderboards),
         hide_zones_from_map    = COALESCE(p_hide_zones_from_map, hide_zones_from_map)
   WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_privacy_place(text, float8, float8, integer), public.remove_privacy_place(uuid),
  public.get_my_privacy_places(), public.set_privacy_controls(boolean, boolean) TO authenticated;

-- Mark existing zones against places (none exist yet, so this is a no-op on first push).
UPDATE public.territory_polygons t SET near_private_place = public.zone_near_private_place(t.owner_id, t.geom)
 WHERE t.owner_id IN (SELECT DISTINCT user_id FROM public.privacy_places);

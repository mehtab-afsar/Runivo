-- M4 + B5: zone history and zone legends (our Local Legend).
-- Every claim, steal and defence is logged with where it happened. A zone's
-- history is the events at that place (zones split and change id when stolen,
-- so history follows the ground, not the row). The legend is whoever defended
-- that ground most in the last 90 days.

CREATE TABLE IF NOT EXISTS public.zone_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  zone_id       uuid,
  kind          text NOT NULL CHECK (kind IN ('claimed', 'stolen', 'defended')),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prev_owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  at            timestamptz NOT NULL DEFAULT now(),
  geom          geometry(Geometry, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS zone_events_geom_idx ON public.zone_events USING gist (geom);
CREATE INDEX IF NOT EXISTS zone_events_at_idx ON public.zone_events (at DESC);
ALTER TABLE public.zone_events ENABLE ROW LEVEL SECURITY;
-- Read only through get_zone_history (it hides blocked runners and private places).

CREATE OR REPLACE FUNCTION public.log_zone_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prev uuid;
BEGIN
  IF NEW.geom IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    -- A steal inserts the thief's piece while the rival's zone is still there.
    SELECT t.owner_id INTO v_prev
      FROM territory_polygons t
     WHERE t.id <> NEW.id AND t.owner_id <> NEW.owner_id
       AND t.geom && NEW.geom AND ST_Intersects(t.geom, ST_PointOnSurface(NEW.geom))
     LIMIT 1;
    INSERT INTO zone_events (zone_id, kind, user_id, prev_owner_id, at, geom)
    VALUES (NEW.id, CASE WHEN v_prev IS NULL THEN 'claimed' ELSE 'stolen' END, NEW.owner_id, v_prev,
            COALESCE(NEW.claimed_at, now()), ST_PointOnSurface(NEW.geom));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      INSERT INTO zone_events (zone_id, kind, user_id, prev_owner_id, geom)
      VALUES (NEW.id, 'stolen', NEW.owner_id, OLD.owner_id, ST_PointOnSurface(NEW.geom));
    ELSIF NEW.last_defended_at IS DISTINCT FROM OLD.last_defended_at AND NEW.last_defended_at > COALESCE(OLD.last_defended_at, '-infinity') THEN
      INSERT INTO zone_events (zone_id, kind, user_id, at, geom)
      VALUES (NEW.id, 'defended', NEW.owner_id, NEW.last_defended_at, ST_PointOnSurface(NEW.geom));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_zone_event ON public.territory_polygons;
CREATE TRIGGER trg_log_zone_event
  AFTER INSERT OR UPDATE OF owner_id, last_defended_at ON public.territory_polygons
  FOR EACH ROW EXECUTE FUNCTION public.log_zone_event();

-- The last 20 events on this zone's ground, newest first, plus the legend.
CREATE OR REPLACE FUNCTION public.get_zone_history(p_zone uuid)
RETURNS TABLE (kind text, user_id uuid, username text, prev_username text, at timestamptz, is_legend boolean, legend_defences int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH z AS (
    SELECT geom, owner_id, near_private_place FROM territory_polygons WHERE id = p_zone
  ), visible AS (
    SELECT * FROM z WHERE zone_visible_to(auth.uid(), z.owner_id, z.near_private_place)
  ), ev AS (
    SELECT e.* FROM zone_events e, visible v
     WHERE e.geom && v.geom AND ST_Intersects(e.geom, v.geom)
       AND e.user_id NOT IN (SELECT hidden_user_ids(auth.uid()))
  ), legend AS (
    SELECT user_id, count(*)::int AS n FROM ev
     WHERE kind = 'defended' AND at > now() - interval '90 days'
     GROUP BY user_id ORDER BY count(*) DESC, max(at) DESC LIMIT 1
  )
  SELECT ev.kind, ev.user_id, p.username, pp.username, ev.at,
         ev.user_id = (SELECT user_id FROM legend), COALESCE((SELECT n FROM legend), 0)
    FROM ev
    JOIN profiles p ON p.id = ev.user_id
    LEFT JOIN profiles pp ON pp.id = ev.prev_owner_id
   ORDER BY ev.at DESC
   LIMIT 20;
$$;

-- B5: how many zones a runner is currently the legend of (shown on profiles).
CREATE OR REPLACE FUNCTION public.legend_zone_count(p_user uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM territory_polygons t
   WHERE (
     SELECT e.user_id FROM zone_events e
      WHERE e.kind = 'defended' AND e.at > now() - interval '90 days'
        AND e.geom && t.geom AND ST_Intersects(e.geom, t.geom)
      GROUP BY e.user_id ORDER BY count(*) DESC, max(e.at) DESC LIMIT 1
   ) = p_user;
$$;

REVOKE ALL ON FUNCTION public.get_zone_history(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.legend_zone_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_zone_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.legend_zone_count(uuid) TO authenticated;

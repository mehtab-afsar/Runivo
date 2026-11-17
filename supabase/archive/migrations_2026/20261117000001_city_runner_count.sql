-- Welcome screen chip (mock): "2,418 running in Bengaluru".
--
-- Runners who logged a scored run starting in the city in the last 7 days.
-- Public (the welcome screen is shown before sign-in), so it only ever returns
-- an aggregate, rounded down to the nearest 10, and nothing under 50 runners.
-- Counts are cached per city for 30 minutes so the welcome screen never scans
-- runs on every app open.

CREATE TABLE IF NOT EXISTS public.city_runner_counts (
  city        text PRIMARY KEY,
  runners     integer NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.city_runner_counts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.city_runner_counts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.city_runner_count(p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL)
RETURNS TABLE (city text, runners integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_city   text;
  v_center geometry;
  v_radius double precision;
  v_n      integer;
  v_cached public.city_runner_counts%ROWTYPE;
BEGIN
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL
     AND p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180 THEN
    v_city := public.city_for_point(ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326));
  END IF;
  -- No location (or not in a launch city): show the busiest launch city.
  IF v_city IS NULL THEN
    SELECT c.city INTO v_city FROM public.city_runner_counts c ORDER BY c.runners DESC LIMIT 1;
    IF v_city IS NULL THEN
      SELECT s.name INTO v_city FROM public.store_cities s ORDER BY s.name LIMIT 1;
    END IF;
  END IF;
  IF v_city IS NULL THEN RETURN; END IF;

  SELECT * INTO v_cached FROM public.city_runner_counts c WHERE c.city = v_city;
  IF FOUND AND v_cached.computed_at > now() - interval '30 minutes' THEN
    v_n := v_cached.runners;
  ELSE
    SELECT s.center, s.radius_km INTO v_center, v_radius FROM public.store_cities s WHERE s.name = v_city;
    IF v_center IS NULL THEN RETURN; END IF;
    SELECT count(DISTINCT r.user_id)::int INTO v_n
      FROM public.runs r
     WHERE r.started_at > now() - interval '7 days'
       AND r.route IS NOT NULL
       AND NOT COALESCE(r.excluded, false)
       AND r.integrity_status IN ('ok', 'cleared')
       AND ST_DWithin(ST_StartPoint(r.route)::geography, v_center::geography, v_radius * 1000);
    INSERT INTO public.city_runner_counts AS t (city, runners, computed_at) VALUES (v_city, v_n, now())
      ON CONFLICT ON CONSTRAINT city_runner_counts_pkey DO UPDATE SET runners = EXCLUDED.runners, computed_at = EXCLUDED.computed_at;
  END IF;

  IF v_n < 50 THEN RETURN; END IF;
  city := v_city;
  runners := (v_n / 10) * 10;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.city_runner_count(double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.city_runner_count(double precision, double precision) TO anon, authenticated;

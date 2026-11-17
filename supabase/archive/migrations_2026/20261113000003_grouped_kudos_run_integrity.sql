-- ============================================================
-- Grouped kudos notifications, and run integrity flags
-- ============================================================
-- 1. Kudos: a burst of kudos on one post becomes one notification ("Ana and
--    4 others gave kudos") that is updated in place, so it pushes once.
-- 2. Integrity: runs whose GPS shows a teleport or a vehicle-speed stretch are
--    saved but kept off leaderboards. The runner can appeal; staff clear it.
-- ============================================================

-- ── 1. Grouped kudos ────────────────────────────────────────
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS group_count integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.notify_kudos()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  post_owner uuid;
  liker_name text;
  v_url      text := '/feed?post=' || NEW.post_id::text;
  v_existing uuid;
  v_count    integer;
BEGIN
  SELECT user_id INTO post_owner FROM public.feed_posts WHERE id = NEW.post_id;
  IF post_owner IS NULL OR post_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT username INTO liker_name FROM public.profiles WHERE id = NEW.user_id;
  liker_name := COALESCE(liker_name, 'A runner');

  -- An unread kudos notification for this post from the last day: fold into it.
  SELECT id, group_count INTO v_existing, v_count
    FROM public.notifications
   WHERE user_id = post_owner AND type = 'kudos' AND action_url = v_url
     AND NOT read AND created_at > now() - interval '1 day'
   ORDER BY created_at DESC LIMIT 1
   FOR UPDATE;

  IF v_existing IS NOT NULL THEN
    UPDATE public.notifications
       SET group_count = v_count + 1,
           title = liker_name || ' and ' || v_count || CASE WHEN v_count = 1 THEN ' other' ELSE ' others' END || ' gave kudos',
           body = 'Tap to see the post.'
     WHERE id = v_existing;
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, action_url)
  VALUES (post_owner, 'kudos', liker_name || ' gave kudos on your run', 'Tap to see the post.', v_url);
  RETURN NEW;
END;
$$;

-- ── 2. Integrity flags ──────────────────────────────────────
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS integrity_status text NOT NULL DEFAULT 'ok'
  CHECK (integrity_status IN ('ok', 'flagged', 'appealed', 'cleared'));
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS integrity_reason text;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS integrity_appeal text CHECK (integrity_appeal IS NULL OR length(integrity_appeal) <= 500);

-- 'teleport': one jump of 250 m+ at 15 m/s+ (or 1 km+ with no timestamps).
-- 'vehicle':  1 km+ of an on-foot activity covered at over 8 m/s.
CREATE OR REPLACE FUNCTION public.run_integrity_reason(points jsonb, activity text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  pt jsonb; plat float8; plng float8; pts float8; lat float8; lng float8; ts float8;
  a float8; d float8; dt float8; fast_m float8 := 0;
  on_foot boolean := COALESCE(activity, 'run') IN ('run', 'trail_run', 'trail', 'walk', 'hike');
BEGIN
  IF jsonb_typeof(points) IS DISTINCT FROM 'array' THEN RETURN NULL; END IF;
  FOR pt IN SELECT * FROM jsonb_array_elements(points) LOOP
    lat := (pt->>'lat')::float8; lng := (pt->>'lng')::float8; ts := (pt->>'timestamp')::float8;
    IF lat IS NULL OR lng IS NULL THEN CONTINUE; END IF;
    IF plat IS NOT NULL THEN
      a := sin(radians(lat - plat) / 2) ^ 2 + cos(radians(plat)) * cos(radians(lat)) * sin(radians(lng - plng) / 2) ^ 2;
      d := 6371000 * 2 * atan2(sqrt(a), sqrt(1 - a));
      dt := CASE WHEN ts IS NOT NULL AND pts IS NOT NULL AND ts > pts THEN (ts - pts) / 1000.0 ELSE NULL END;
      IF (dt IS NULL AND d >= 1000) OR (dt IS NOT NULL AND d >= 250 AND d / dt >= 15) THEN
        RETURN 'teleport';
      END IF;
      IF on_foot AND dt IS NOT NULL AND d / dt > 8 THEN
        fast_m := fast_m + d;
        IF fast_m >= 1000 THEN RETURN 'vehicle'; END IF;
      END IF;
    END IF;
    plat := lat; plng := lng; pts := ts;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.flag_run_integrity()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_reason text;
BEGIN
  -- Staff decisions stand; a fresh route is checked again.
  IF TG_OP = 'UPDATE' AND NEW.integrity_status IN ('cleared', 'appealed')
     AND NEW.gps_points IS NOT DISTINCT FROM OLD.gps_points THEN
    RETURN NEW;
  END IF;
  v_reason := public.run_integrity_reason(NEW.gps_points, NEW.activity_type);
  IF v_reason IS NULL THEN
    IF NEW.integrity_status = 'flagged' THEN NEW.integrity_status := 'ok'; NEW.integrity_reason := NULL; END IF;
  ELSE
    NEW.integrity_status := 'flagged';
    NEW.integrity_reason := v_reason;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS runs_flag_integrity ON public.runs;
CREATE TRIGGER runs_flag_integrity
  BEFORE INSERT OR UPDATE OF gps_points, activity_type ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.flag_run_integrity();

-- Runners can't set these columns themselves: only the trigger, appeal_run_flag
-- and staff (service role) change them.
CREATE OR REPLACE FUNCTION public.protect_run_integrity()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND current_setting('runivo.integrity_writer', true) IS DISTINCT FROM 'on' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.integrity_status := 'ok'; NEW.integrity_reason := NULL; NEW.integrity_appeal := NULL;
    ELSE
      NEW.integrity_status := OLD.integrity_status; NEW.integrity_reason := OLD.integrity_reason; NEW.integrity_appeal := OLD.integrity_appeal;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
-- Runs first (alphabetical: "runs_a_protect…" < "runs_flag…"), so the check below re-applies the flag.
DROP TRIGGER IF EXISTS runs_a_protect_integrity ON public.runs;
CREATE TRIGGER runs_a_protect_integrity
  BEFORE INSERT OR UPDATE ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.protect_run_integrity();

CREATE OR REPLACE FUNCTION public.appeal_run_flag(p_run_id uuid, p_note text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  PERFORM set_config('runivo.integrity_writer', 'on', true);
  UPDATE public.runs
     SET integrity_status = 'appealed', integrity_appeal = left(NULLIF(trim(COALESCE(p_note, '')), ''), 500)
   WHERE id = p_run_id AND user_id = auth.uid() AND integrity_status = 'flagged';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('runivo.integrity_writer', 'off', true);
  RETURN v_n > 0;
END;
$$;
GRANT EXECUTE ON FUNCTION public.appeal_run_flag(uuid, text) TO authenticated;

-- Leaderboards leave out flagged and appealed runs until cleared.
CREATE OR REPLACE FUNCTION public.leaderboard_values(p_metric text, p_period text)
RETURNS TABLE(user_id uuid, value numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH b AS (SELECT public.leaderboard_period_start(p_period) AS since)
  SELECT r.user_id, SUM(r.distance_m) / 1000.0
    FROM public.runs r, b
   WHERE p_metric = 'distance'
     AND r.started_at >= b.since
     AND COALESCE(r.activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike'])
     AND NOT r.excluded
     AND r.integrity_status IN ('ok', 'cleared')
   GROUP BY r.user_id
  HAVING SUM(r.distance_m) > 0
  UNION ALL
  SELECT a.user_id, SUM(a.credited)::numeric
    FROM public.pace_awards a, b
   WHERE p_metric = 'pace' AND p_period <> 'all' AND a.created_at >= b.since
   GROUP BY a.user_id
  HAVING SUM(a.credited) > 0
  UNION ALL
  SELECT p.id, p.pace_total_earned::numeric
    FROM public.profiles p
   WHERE p_metric = 'pace' AND p_period = 'all' AND COALESCE(p.pace_total_earned, 0) > 0
  UNION ALL
  SELECT t.owner_id, SUM(t.area_m2)::numeric
    FROM public.territory_polygons t, b
   WHERE p_metric = 'territory' AND p_period <> 'all' AND t.claimed_at >= b.since
   GROUP BY t.owner_id
  HAVING SUM(t.area_m2) > 0
  UNION ALL
  SELECT p.id, p.territory_score::numeric
    FROM public.profiles p
   WHERE p_metric = 'territory' AND p_period = 'all' AND COALESCE(p.territory_score, 0) > 0;
$$;

REVOKE ALL ON FUNCTION public.leaderboard_values(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leaderboard_values(text, text) FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_run_km_by_user(p_cutoff timestamptz, p_limit int DEFAULT 100)
RETURNS TABLE(user_id uuid, total_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.user_id, COALESCE(SUM(r.distance_m) / 1000.0, 0)::numeric AS total_km
  FROM public.runs r
  WHERE r.started_at >= p_cutoff
    AND COALESCE(r.activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike'])
    AND NOT r.excluded
    AND r.integrity_status IN ('ok', 'cleared')
  GROUP BY r.user_id
  ORDER BY total_km DESC
  LIMIT p_limit;
$$;

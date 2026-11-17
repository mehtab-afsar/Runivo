-- A runner whose zone was taken only ever got a push (sent straight from
-- process-run-territory), never a row in notifications, so the Notifications
-- screen never said "someone took your ground". The function now inserts a
-- zone_attacked row for every steal, and the push goes out through the usual
-- trigger, which already applies the runner's Territory alerts setting.
--
-- The steal-push pilot withholds the push for half of steals. silent = true
-- keeps the in-app row but skips the push for those.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS silent boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.notify_push_on_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  edge_url text;
BEGIN
  IF NEW.silent THEN RETURN NEW; END IF;
  edge_url := current_setting('app.edge_function_url', true);
  IF edge_url IS NULL OR edge_url = '' THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url     := edge_url || '/send-push-notification',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
               ),
    body    := jsonb_build_object(
                 'user_id',    NEW.user_id,
                 'title',      NEW.title,
                 'body',       COALESCE(NEW.body, ''),
                 'action_url', COALESCE(NEW.action_url, '/'),
                 'type',       NEW.type
               )::text
  );
  RETURN NEW;
END $$;

-- An attack card points at the zone that was hit. When that zone is later
-- taken whole (steal_territory_portion deletes it) or its owner's account is
-- deleted, the link has to clear, not block the delete. It never mattered
-- before because attack cards were never saved (their insert sent columns
-- feed_posts doesn't have).
ALTER TABLE public.feed_posts DROP CONSTRAINT IF EXISTS feed_posts_stolen_territory_id_fkey;
ALTER TABLE public.feed_posts ADD CONSTRAINT feed_posts_stolen_territory_id_fkey
  FOREIGN KEY (stolen_territory_id) REFERENCES public.territory_polygons(id) ON DELETE SET NULL;


-- The distance boards counted run, trail, walk and hike only. Wheelchair and
-- stroller activities claim ground and count everywhere else on foot
-- (ENGINE.TERRITORY_ACTIVITIES), so they count here too.
CREATE OR REPLACE FUNCTION public.leaderboard_values_all(p_metric text, p_period text)
 RETURNS TABLE(user_id uuid, value numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH b AS (SELECT public.leaderboard_period_start(p_period) AS since)
  SELECT r.user_id, SUM(r.distance_m) / 1000.0
    FROM public.runs r, b
   WHERE p_metric = 'distance'
     AND r.started_at >= b.since
     AND COALESCE(r.activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike', 'wheelchair', 'stroller'])
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
$function$;

-- Same for the Year in Runivo totals.
CREATE OR REPLACE FUNCTION public.get_year_in_runivo(p_year integer)
 RETURNS TABLE(activities integer, km numeric, hours numeric, longest_km numeric, active_days integer, zones_claimed integer, pace_earned integer, biggest_steal_m2 numeric, biggest_steal_from text, times_stolen_from integer, biggest_zone_m2 numeric, best_month integer, best_month_km numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_from timestamptz := make_timestamptz(p_year, 1, 1, 0, 0, 0, 'UTC');
  v_to   timestamptz := make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'UTC');
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH r AS (
    SELECT distance_m, duration_sec, started_at FROM public.runs
     WHERE user_id = v_uid AND started_at >= v_from AND started_at < v_to
       AND COALESCE(activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike', 'wheelchair', 'stroller'])
       AND NOT excluded
  ), m AS (
    SELECT extract(month FROM started_at)::int AS mo, sum(distance_m) / 1000.0 AS mkm FROM r GROUP BY 1 ORDER BY 2 DESC LIMIT 1
  ), steal AS (
    SELECT stolen_area_m2, stolen_from_username FROM public.feed_posts
     WHERE user_id = v_uid AND post_type = 'conquest' AND created_at >= v_from AND created_at < v_to
     ORDER BY stolen_area_m2 DESC NULLS LAST LIMIT 1
  )
  SELECT
    (SELECT count(*)::int FROM r),
    round(COALESCE((SELECT sum(distance_m) FROM r), 0) / 1000.0, 1),
    round(COALESCE((SELECT sum(duration_sec) FROM r), 0) / 3600.0, 1),
    round(COALESCE((SELECT max(distance_m) FROM r), 0) / 1000.0, 2),
    (SELECT count(DISTINCT started_at::date)::int FROM r),
    COALESCE((SELECT sum(territories_claimed)::int FROM public.feed_posts
               WHERE user_id = v_uid AND post_type = 'run' AND created_at >= v_from AND created_at < v_to), 0),
    COALESCE((SELECT sum(credited)::int FROM public.pace_awards
               WHERE user_id = v_uid AND created_at >= v_from AND created_at < v_to), 0),
    (SELECT round(stolen_area_m2::numeric) FROM steal),
    (SELECT stolen_from_username FROM steal),
    (SELECT count(*)::int FROM public.feed_posts
      WHERE user_id = v_uid AND post_type = 'attack' AND created_at >= v_from AND created_at < v_to),
    (SELECT round(max(area_m2)::numeric) FROM public.territory_polygons WHERE owner_id = v_uid),
    (SELECT mo FROM m),
    (SELECT round(mkm::numeric, 1) FROM m);
END;
$function$;

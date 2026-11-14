-- Privacy fixes from reviewing the 13 Nov batches.
--
-- 1. suggest_runners_nearby returned distance to 0.1 km. Anyone who can move
--    their own last_known_location could triangulate where another runner was.
--    Now: a coarse "within N km" bucket only.
-- 2. event_result listed every run that started near an event, including runs
--    whose post the viewer may not see (followers-only, only me). Now: only
--    runs the viewer could see in the feed, plus their own.
-- 3. get_zone_history could show someone's claims and defences next to one of
--    their private places (through another runner's zone on the same ground).
--    Now: events within a runner's private place are left out for others.

CREATE OR REPLACE FUNCTION public.suggest_runners_nearby(lim int DEFAULT 5)
RETURNS TABLE (id uuid, username text, avatar_url text, avatar_color text, total_distance_km numeric, territory_score int, distance_km double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT last_known_location AS loc FROM profiles WHERE id = auth.uid())
  SELECT p.id, p.username, p.avatar_url, p.avatar_color, p.total_distance_km::numeric, p.territory_score::int,
         CASE WHEN ST_DWithin(p.last_known_location::geography, me.loc::geography, 2000) THEN 2
              WHEN ST_DWithin(p.last_known_location::geography, me.loc::geography, 5000) THEN 5
              ELSE 15 END::float8
    FROM profiles p, me
   WHERE me.loc IS NOT NULL AND p.last_known_location IS NOT NULL
     AND p.id <> auth.uid()
     AND NOT p.hide_from_leaderboards
     AND COALESCE(p.profile_visibility, 'public') = 'public'
     AND p.id NOT IN (SELECT following_id FROM followers WHERE follower_id = auth.uid())
     AND p.id NOT IN (SELECT hidden_user_ids(auth.uid()))
     AND ST_DWithin(p.last_known_location::geography, me.loc::geography, 15000)
   ORDER BY p.territory_score DESC NULLS LAST, p.total_runs DESC
   LIMIT LEAST(lim, 10);
$$;

CREATE OR REPLACE FUNCTION public.event_result(p_event uuid)
RETURNS TABLE (user_id uuid, username text, avatar_color text, distance_km numeric, duration_sec int, is_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH e AS (
    SELECT * FROM events WHERE id = p_event AND lat IS NOT NULL AND starts_at < now()
  )
  SELECT DISTINCT ON (r.user_id) r.user_id, p.username, p.avatar_color,
         round(r.distance_m / 1000.0, 2), r.duration_sec, r.user_id = auth.uid()
    FROM e
    JOIN runs r ON r.started_at BETWEEN e.starts_at - interval '45 minutes' AND COALESCE(e.ends_at, e.starts_at + interval '4 hours')
               AND jsonb_array_length(COALESCE(r.gps_points, '[]'::jsonb)) > 0
               AND NOT COALESCE(r.excluded, false)
    JOIN profiles p ON p.id = r.user_id
   WHERE ST_DWithin(
           ST_MakePoint((r.gps_points->0->>'lng')::float8, (r.gps_points->0->>'lat')::float8)::geography,
           ST_MakePoint(e.lng::float8, e.lat::float8)::geography, 1000)
     AND r.user_id NOT IN (SELECT hidden_user_ids(auth.uid()))
     AND (
       r.user_id = auth.uid()
       OR (NOT p.hide_from_leaderboards AND EXISTS (
             SELECT 1 FROM feed_posts fp WHERE fp.run_id = r.id AND can_view_post(auth.uid(), fp.user_id, fp.visibility)))
     )
   ORDER BY r.user_id, r.distance_m DESC;
$$;

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
       AND (e.user_id = auth.uid() OR NOT EXISTS (
             SELECT 1 FROM privacy_places pp
              WHERE pp.user_id = e.user_id AND ST_DWithin(pp.center, e.geom::geography, pp.radius_m)))
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

-- "Your feed": every post of your own (runs, battle cards, milestones), newest
-- first, in the same shape as get_feed so the app renders it with the same cards.
CREATE OR REPLACE FUNCTION public.get_my_feed(lim integer DEFAULT 20, cursor_ts timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(id uuid, user_id uuid, run_id uuid, distance_km numeric, duration_sec integer, avg_pace text, activity_type text, route_points jsonb, territories_claimed integer, likes integer, comment_count integer, created_at timestamp with time zone, username text, avatar_url text, avatar_color text, pace_earned integer, territory_tier text, territory_area_m2 double precision, runner_rank text, post_type text, stolen_from_username text, stolen_area_m2 double precision, zone_tier text, stolen_from_user_id uuid, has_liked boolean, title text, content text, visibility text, photo_paths text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    ) AS has_liked,
    fp.title, fp.content, fp.visibility, fp.photo_paths
  FROM public.feed_posts fp
  JOIN public.profiles p ON p.id = fp.user_id
  WHERE
    fp.user_id = auth.uid()
    AND (cursor_ts IS NULL OR fp.created_at < cursor_ts)
  ORDER BY fp.created_at DESC
  LIMIT lim;
$function$;
GRANT EXECUTE ON FUNCTION public.get_my_feed(integer, timestamp with time zone) TO authenticated;

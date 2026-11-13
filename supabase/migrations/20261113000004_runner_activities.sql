-- ============================================================
-- Another runner's activities, for their profile (PRD P1)
-- ============================================================
-- What a viewer may see: the profile's own visibility (as in
-- get_user_profile_for_viewer), then each activity's audience (can_view_post),
-- minus blocks either way. Built from the runner's posts so private notes,
-- GPS and excluded-or-not stay on the owner's side; "Don't count this" runs
-- are left out of what others see.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_runner_activities(p_user_id uuid, p_limit integer DEFAULT 200)
RETURNS TABLE(id uuid, activity_type text, title text, started_at timestamptz, distance_m numeric, duration_sec integer, avg_pace text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_vis text;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT profile_visibility INTO v_vis FROM public.profiles WHERE profiles.id = p_user_id;
  IF v_vis IS NULL OR public.is_blocked_between(v_uid, p_user_id) THEN RETURN; END IF;
  IF v_uid <> p_user_id AND NOT (
       v_vis = 'public'
       OR (v_vis = 'followers' AND EXISTS (SELECT 1 FROM public.followers f WHERE f.follower_id = v_uid AND f.following_id = p_user_id))
     ) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT r.id, COALESCE(r.activity_type, 'run'), COALESCE(fp.title, r.title), r.started_at,
           r.distance_m::numeric, r.duration_sec, r.avg_pace
      FROM public.feed_posts fp
      JOIN public.runs r ON r.id = fp.run_id
     WHERE fp.user_id = p_user_id
       AND fp.post_type = 'run'
       AND NOT r.excluded
       AND public.can_view_post(v_uid, fp.user_id, fp.visibility)
     ORDER BY r.started_at DESC
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_runner_activities(uuid, integer) TO authenticated;

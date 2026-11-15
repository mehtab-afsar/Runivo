-- Profile privacy and honest post numbers (security audit M7).
--
-- 1. profiles_public returned every runner's bio, location, Instagram, Strava,
--    totals and pinned run, whatever their profile visibility. A "Private" or
--    "Followers" runner now shows other people only what the profile screen
--    already shows them (get_user_profile_for_viewer): name, avatar, rank and
--    the game numbers leaderboards rank by. The rest is NULL unless you may see
--    the profile (yourself, public, or a follower of a followers-only profile).
--
-- 2. feed_posts rows written by the app carried their own PACE, distance, zone
--    size, rank, kudos and comment counts, so a post could show anything. For
--    posts the app writes directly, those now come from the server's own
--    records: the run, its scoring result, the runner's profile and zones.
--    Steal posts (with a victim's name) can only be written by the server.

CREATE OR REPLACE FUNCTION public.can_view_profile(p_viewer uuid, p_owner uuid, p_visibility text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_viewer = p_owner
      OR (
        p_viewer IS NOT NULL
        AND NOT public.is_blocked_between(p_viewer, p_owner)
        AND (
          COALESCE(p_visibility, 'public') = 'public'
          OR (p_visibility = 'followers' AND EXISTS (
                SELECT 1 FROM public.followers WHERE follower_id = p_viewer AND following_id = p_owner))
        )
      );
$$;
REVOKE ALL ON FUNCTION public.can_view_profile(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.profiles_public WITH (security_invoker = off) AS
SELECT p.id,
       p.username,
       p.display_name,
       p.avatar_url,
       p.avatar_color,
       CASE WHEN v.ok THEN p.bio END                       AS bio,
       CASE WHEN v.ok THEN p.location END                  AS location,
       CASE WHEN v.ok THEN p.instagram END                 AS instagram,
       CASE WHEN v.ok THEN p.strava END                    AS strava,
       p.level,
       p.runner_rank,
       p.territory_score,
       p.pace_total_earned,
       (CASE WHEN v.ok THEN p.total_distance_km END)::numeric(10,3) AS total_distance_km,
       CASE WHEN v.ok THEN p.total_runs END                AS total_runs,
       CASE WHEN v.ok THEN p.total_territories_claimed END AS total_territories_claimed,
       CASE WHEN v.ok THEN p.streak_days END               AS streak_days,
       CASE WHEN v.ok THEN p.follower_count END            AS follower_count,
       CASE WHEN v.ok THEN p.following_count END           AS following_count,
       p.country,
       CASE WHEN v.ok THEN p.unlocked_achievements END     AS unlocked_achievements,
       CASE WHEN v.ok THEN p.pinned_run_id END             AS pinned_run_id,
       p.created_at
  FROM public.profiles p
  CROSS JOIN LATERAL (
    SELECT auth.role() = 'service_role'
        OR public.can_view_profile(auth.uid(), p.id, p.profile_visibility) AS ok
  ) v;

REVOKE ALL ON public.profiles_public FROM PUBLIC;
REVOKE ALL ON public.profiles_public FROM anon;
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_public TO service_role;

-- ── Post numbers come from the server ────────────────────────────────────────
-- Fills a post the app wrote with the server's numbers (SECURITY DEFINER: it
-- reads run_processing, which runners can't).
CREATE OR REPLACE FUNCTION public.feed_post_with_server_stats(NEW public.feed_posts)
RETURNS public.feed_posts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run    public.runs%ROWTYPE;
  v_result jsonb;
BEGIN

  IF COALESCE(NEW.post_type, 'run') NOT IN ('run', 'milestone') THEN
    RAISE EXCEPTION 'this kind of post is written by the server' USING ERRCODE = 'insufficient_privilege';
  END IF;

  NEW.likes := 0;
  NEW.comment_count := 0;
  NEW.stolen_from_username := NULL;
  NEW.stolen_from_user_id := NULL;
  NEW.stolen_area_m2 := NULL;
  NEW.stolen_territory_id := NULL;
  NEW.zone_tier := NULL;
  NEW.runner_rank := (SELECT runner_rank FROM public.profiles WHERE id = NEW.user_id);

  IF COALESCE(NEW.post_type, 'run') = 'run' THEN
    SELECT * INTO v_run FROM public.runs WHERE id = NEW.run_id;
    IF NOT FOUND OR v_run.user_id IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'a run post needs one of your own synced runs' USING ERRCODE = 'insufficient_privilege';
    END IF;
    SELECT result INTO v_result FROM public.run_processing WHERE run_id = NEW.run_id;
    NEW.distance_km   := round(v_run.distance_m / 1000.0, 3);
    NEW.duration_sec  := v_run.duration_sec;
    NEW.avg_pace      := v_run.avg_pace;
    NEW.activity_type := v_run.activity_type;
    NEW.pace_earned   := GREATEST(COALESCE((v_result ->> 'paceAdjustment')::numeric, 0), 0)::int;
    NEW.territories_claimed := COALESCE((v_result ->> 'newZonesClaimed')::int, 0);
    IF COALESCE((v_result ->> 'claimedAreaM2')::numeric, 0) > 0 THEN
      NEW.territory_area_m2 := (v_result ->> 'claimedAreaM2')::numeric;
    ELSE
      NEW.territory_area_m2 := NULL;
      NEW.territory_tier := NULL;
    END IF;
  ELSE
    -- Milestone: "my territory reached a new tier". Numbers from the zones held now.
    NEW.run_id := NULL;
    NEW.distance_km := 0;
    NEW.pace_earned := 0;
    NEW.territories_claimed := 0;
    SELECT COALESCE(sum(area_m2), 0) INTO NEW.territory_area_m2 FROM public.territory_polygons WHERE owner_id = NEW.user_id;
    IF NEW.territory_tier IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.territory_polygons WHERE owner_id = NEW.user_id AND tier = NEW.territory_tier) THEN
      RAISE EXCEPTION 'you do not hold a zone of that tier' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.feed_post_with_server_stats(public.feed_posts) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_post_with_server_stats(public.feed_posts) TO authenticated;

-- The trigger runs as the writer (SECURITY INVOKER), so current_user tells a
-- direct app write ('authenticated') from the scoring function (service_role)
-- and from SECURITY DEFINER functions (their owner), which keep their numbers.
CREATE OR REPLACE FUNCTION public.feed_post_server_stats()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  RETURN public.feed_post_with_server_stats(NEW);
END $$;

DROP TRIGGER IF EXISTS feed_posts_a_server_stats ON public.feed_posts;
CREATE TRIGGER feed_posts_a_server_stats
  BEFORE INSERT ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.feed_post_server_stats();

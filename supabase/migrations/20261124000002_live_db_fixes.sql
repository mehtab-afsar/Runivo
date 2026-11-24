-- Fixes from the live-database audit (24 Nov 2026): holes that only show in the
-- built database, each proven by an impersonated attempt (audit/blind_db.md).
--  B1  shoe_stats view bypassed RLS: anyone could read every runner's shoes.
--  B2  leaderboard_weekly view bypassed RLS: anyone saw every runner's weekly stats,
--      private profiles and minors included. No client uses it.
--  B3  Joining an open club never checked the role: anyone could join as owner.
--  B4  feed_post_with_server_stats returned another runner's private run stats.
--  B5  is_blocked_between / can_view_profile / can_view_post took any two ids:
--      signed-in runners could learn who blocked whom. Caller-bound wrappers now.
--  M1  Follow/comment/join/report spam fanned out to push calls: hourly limits.
--  M2  Exact last_known_location could be recovered: stored as a ~1 km cell.
--  M3  kudos were readable by anyone.
--  M4  New functions defaulted to EXECUTE for anon; 74 SECURITY DEFINER functions
--      were callable without signing in.
SET search_path = public, extensions;

-- B1 shoe_stats: run as the caller so shoes/runs RLS applies
ALTER VIEW public.shoe_stats SET (security_invoker = on);
REVOKE ALL ON public.shoe_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.shoe_stats TO authenticated, service_role;

-- B2 leaderboard_weekly: unused by clients; run as caller and close it
ALTER VIEW public.leaderboard_weekly SET (security_invoker = on);
REVOKE ALL ON public.leaderboard_weekly FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.leaderboard_weekly TO service_role;

-- B3 club_members: self-join of an open club is always role 'member'
DROP POLICY "club_members: self can join open clubs" ON public.club_members;
CREATE POLICY "club_members: self can join open clubs" ON public.club_members FOR INSERT
  WITH CHECK (auth.uid() = user_id AND role = 'member'
              AND EXISTS (SELECT 1 FROM public.clubs WHERE clubs.id = club_members.club_id AND clubs.join_policy = 'open'));

-- M1 feed_post_with_server_stats: only for your own row
CREATE OR REPLACE FUNCTION public.feed_post_with_server_stats(new feed_posts)
 RETURNS feed_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_run    public.runs%ROWTYPE;
  v_result jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not your post' USING ERRCODE = '42501';
  END IF;

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
END $function$;

-- M2 caller-bound wrappers; the 3-arg helpers become server-only
CREATE OR REPLACE FUNCTION public.blocked_with_me(p_other uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT auth.uid() IS NOT NULL AND public.is_blocked_between(auth.uid(), p_other) $$;
CREATE OR REPLACE FUNCTION public.i_can_view_profile(p_owner uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT public.can_view_profile(auth.uid(), p_owner, public.profile_visibility_of(p_owner)) $$;
CREATE OR REPLACE FUNCTION public.i_can_view_profile_vis(p_owner uuid, p_visibility text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT public.can_view_profile(auth.uid(), p_owner, p_visibility) $$;
CREATE OR REPLACE FUNCTION public.i_can_view_post(p_author uuid, p_visibility text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT public.can_view_post(auth.uid(), p_author, p_visibility) $$;
REVOKE ALL ON FUNCTION public.blocked_with_me(uuid), public.i_can_view_profile(uuid),
  public.i_can_view_profile_vis(uuid, text), public.i_can_view_post(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blocked_with_me(uuid), public.i_can_view_profile(uuid),
  public.i_can_view_profile_vis(uuid, text), public.i_can_view_post(uuid, text) TO authenticated, service_role;

ALTER POLICY "feed_posts: visible to viewer" ON public.feed_posts USING (public.i_can_view_post(user_id, visibility));
ALTER POLICY "feed_post_comments: viewers of the post read" ON public.feed_post_comments USING (
  ((user_id = auth.uid()) OR (hidden_at IS NULL)) AND NOT public.blocked_with_me(user_id)
  AND EXISTS (SELECT 1 FROM public.feed_posts p WHERE p.id = feed_post_comments.post_id AND public.i_can_view_post(p.user_id, p.visibility)));
ALTER POLICY "followers: visible edges" ON public.followers USING (
  follower_id = auth.uid() OR following_id = auth.uid()
  OR (public.i_can_view_profile(following_id) AND public.i_can_view_profile(follower_id)));
ALTER POLICY "user_awards: visible with the profile" ON public.user_awards USING (user_id = auth.uid() OR public.i_can_view_profile(user_id));
ALTER POLICY "personal_records: visible with the profile" ON public.personal_records USING (user_id = auth.uid() OR public.i_can_view_profile(user_id));
ALTER POLICY "live_run_positions: mutual connections can read while live" ON public.live_run_positions USING (
  updated_at > now() - interval '30 seconds' AND public.live_sharing_on(user_id)
  AND EXISTS (SELECT 1 FROM public.followers f WHERE f.follower_id = auth.uid() AND f.following_id = live_run_positions.user_id)
  AND EXISTS (SELECT 1 FROM public.followers f WHERE f.follower_id = live_run_positions.user_id AND f.following_id = auth.uid())
  AND NOT public.blocked_with_me(user_id));
ALTER POLICY "lobby_messages: participants can read" ON public.lobby_messages USING (
  NOT public.blocked_with_me(user_id) AND public.can_use_lobby(lobby_id, auth.uid()));
ALTER POLICY "feed: readable with the post" ON storage.objects USING (
  bucket_id = 'feed' AND ((storage.foldername(name))[1] = auth.uid()::text OR EXISTS (
    SELECT 1 FROM public.feed_posts fp
     WHERE fp.run_id::text = (storage.foldername(objects.name))[2]
       AND fp.user_id::text = (storage.foldername(objects.name))[1]
       AND public.i_can_view_post(fp.user_id, fp.visibility))));
-- profiles_public: same columns; uses the wrapper, hides the row from blocked pairs
CREATE OR REPLACE VIEW public.profiles_public WITH (security_invoker = off) AS
 SELECT p.id, p.username, p.display_name, p.avatar_url, p.avatar_color,
    CASE WHEN v.ok THEN p.bio END AS bio, CASE WHEN v.ok THEN p.location END AS location,
    CASE WHEN v.ok THEN p.instagram END AS instagram, CASE WHEN v.ok THEN p.strava END AS strava,
    p.level, p.runner_rank, p.territory_score, p.pace_total_earned,
    (CASE WHEN v.ok THEN p.total_distance_km END)::numeric(10,3) AS total_distance_km,
    CASE WHEN v.ok THEN p.total_runs END AS total_runs,
    CASE WHEN v.ok THEN p.total_territories_claimed END AS total_territories_claimed,
    CASE WHEN v.ok THEN p.streak_days END AS streak_days,
    CASE WHEN v.ok THEN p.follower_count END AS follower_count,
    CASE WHEN v.ok THEN p.following_count END AS following_count,
    p.country,
    CASE WHEN v.ok THEN p.unlocked_achievements END AS unlocked_achievements,
    CASE WHEN v.ok THEN p.pinned_run_id END AS pinned_run_id,
    p.created_at
   FROM public.profiles p
   CROSS JOIN LATERAL (SELECT auth.role() = 'service_role' OR public.i_can_view_profile_vis(p.id, p.profile_visibility) AS ok) v
  WHERE auth.role() = 'service_role' OR p.id = auth.uid() OR NOT public.blocked_with_me(p.id);

REVOKE EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_view_post(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid), public.can_view_profile(uuid, uuid, text),
  public.can_view_post(uuid, uuid, text) TO service_role;

-- M3 kudos: not read by any client; stop anon reading private users' interactions/run ids
DROP POLICY "kudos: anyone can read" ON public.kudos;
CREATE POLICY "kudos: either side reads" ON public.kudos FOR SELECT TO authenticated
  USING (from_id = auth.uid() OR to_id = auth.uid());
REVOKE SELECT ON public.kudos FROM anon;

-- M4 notification spam (follow / comment / join-request / self-insert -> pg_net push)
CREATE OR REPLACE FUNCTION public.notify_follow() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE follower_name text;
BEGIN
  SELECT username INTO follower_name FROM public.profiles WHERE id = NEW.follower_id;
  INSERT INTO public.notifications (user_id, type, title, body, action_url, dedupe_key)
  VALUES (NEW.following_id, 'follow', follower_name || ' started following you',
          'Check out their profile and follow back!', '/profile/' || NEW.follower_id::text,
          'follow:' || NEW.follower_id::text || ':' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'))
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS public.rate_events (
  user_id uuid NOT NULL, kind text NOT NULL, at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS rate_events_user_kind_at ON public.rate_events (user_id, kind, at);
ALTER TABLE public.rate_events ENABLE ROW LEVEL SECURITY;            -- no policies: server only
REVOKE ALL ON public.rate_events FROM PUBLIC, anon, authenticated;
-- Counts attempts in a log (not live rows), so insert/delete cycling cannot reset it.
CREATE OR REPLACE FUNCTION public.limit_user_writes() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_max int := TG_ARGV[0]::int;
BEGIN
  IF v_uid IS NULL OR auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF (SELECT count(*) FROM public.rate_events
       WHERE user_id = v_uid AND kind = TG_TABLE_NAME AND at > now() - interval '1 hour') >= v_max THEN
    RAISE EXCEPTION 'rate limited' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.rate_events (user_id, kind) VALUES (v_uid, TG_TABLE_NAME);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.limit_user_writes() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER a_rate_limit BEFORE INSERT ON public.feed_post_comments FOR EACH ROW EXECUTE FUNCTION public.limit_user_writes('60');
CREATE TRIGGER a_rate_limit BEFORE INSERT ON public.follow_requests    FOR EACH ROW EXECUTE FUNCTION public.limit_user_writes('30');
CREATE TRIGGER a_rate_limit BEFORE INSERT ON public.club_join_requests FOR EACH ROW EXECUTE FUNCTION public.limit_user_writes('10');
CREATE TRIGGER a_rate_limit BEFORE INSERT ON public.post_reports       FOR EACH ROW EXECUTE FUNCTION public.limit_user_writes('20');
CREATE TRIGGER a_rate_limit BEFORE INSERT ON public.followers          FOR EACH ROW EXECUTE FUNCTION public.limit_user_writes('60');
CREATE TRIGGER a_rate_limit BEFORE INSERT ON public.group_challenges   FOR EACH ROW EXECUTE FUNCTION public.limit_user_writes('5');
-- clients never insert notifications (service role and SECURITY DEFINER triggers do)
DROP POLICY "notifications: self or service role insert" ON public.notifications;
REVOKE INSERT ON public.notifications FROM anon, authenticated;

-- M5 location oracle: store only the ~1 km cell the app promises
CREATE OR REPLACE FUNCTION public.snap_last_known_location() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  IF NEW.last_known_location IS NOT NULL THEN
    NEW.last_known_location := ST_SetSRID(ST_MakePoint(round(ST_X(NEW.last_known_location)::numeric, 2),
                                                       round(ST_Y(NEW.last_known_location)::numeric, 2)), 4326);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_snap_location BEFORE INSERT OR UPDATE OF last_known_location ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.snap_last_known_location();
UPDATE public.profiles SET last_known_location = last_known_location WHERE last_known_location IS NOT NULL;

-- M6 default EXECUTE for future functions; anon loses every SECURITY DEFINER fn except the landing-page one
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
DO $$ DECLARE f regprocedure; BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p
            WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
              AND p.proname NOT IN ('city_runner_count')
              AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f); END LOOP;
END $$;

-- Explicit per-function privileges (house rule; scripts/lint-migrations.mjs).
-- The feed_posts trigger runs as the runner and calls this, so runners keep EXECUTE;
-- the check at the top of the function is what stops use on someone else's row.
REVOKE ALL ON FUNCTION public.feed_post_with_server_stats(public.feed_posts) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_post_with_server_stats(public.feed_posts) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.notify_follow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.i_can_view_profile(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.i_can_view_profile_vis(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.i_can_view_post(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.i_can_view_profile(uuid), public.i_can_view_profile_vis(uuid, text),
  public.i_can_view_post(uuid, text) TO authenticated, service_role;

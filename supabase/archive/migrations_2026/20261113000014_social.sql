-- Social batch:
--   C3  club feed: members' activities, newest first
--   F5  group activities: runs that started within 100 m and 5 min of each other
--   O3  runners near you to follow
--   N4  "Sam just claimed a zone next to yours" (opt-in)
--   C4  group challenges: 2–20 people, a target, a deadline

-- ── C3 ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_club_feed(p_club uuid, lim int DEFAULT 20, cursor_ts timestamptz DEFAULT NULL)
RETURNS TABLE(id uuid, user_id uuid, run_id uuid, distance_km numeric, duration_sec integer, avg_pace text, activity_type text,
  route_points jsonb, territories_claimed integer, likes integer, comment_count integer, created_at timestamptz, username text,
  avatar_url text, avatar_color text, pace_earned integer, territory_tier text, territory_area_m2 double precision, runner_rank text,
  post_type text, stolen_from_username text, stolen_area_m2 double precision, zone_tier text, stolen_from_user_id uuid,
  has_liked boolean, title text, content text, visibility text, photo_paths text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    fp.id, fp.user_id, fp.run_id, fp.distance_km, fp.duration_sec, fp.avg_pace, fp.activity_type,
    CASE WHEN fp.map_hidden THEN NULL ELSE fp.route_points END,
    fp.territories_claimed, fp.likes, fp.comment_count, fp.created_at,
    p.username, p.avatar_url, p.avatar_color,
    fp.pace_earned, fp.territory_tier, fp.territory_area_m2, fp.runner_rank, fp.post_type,
    fp.stolen_from_username, fp.stolen_area_m2, fp.zone_tier, fp.stolen_from_user_id,
    EXISTS (SELECT 1 FROM feed_post_likes l WHERE l.post_id = fp.id AND l.user_id = auth.uid()),
    fp.title, fp.content, fp.visibility, fp.photo_paths
  FROM feed_posts fp
  JOIN profiles p ON p.id = fp.user_id
  WHERE EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = p_club AND m.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = p_club AND m.user_id = fp.user_id)
    AND fp.post_type IN ('run', 'conquest', 'milestone')
    AND (cursor_ts IS NULL OR fp.created_at < cursor_ts)
    AND fp.user_id NOT IN (SELECT hidden_user_ids(auth.uid()))
    AND can_view_post(auth.uid(), fp.user_id, fp.visibility)
  ORDER BY fp.created_at DESC
  LIMIT LEAST(lim, 50);
$$;

-- ── F5 ──────────────────────────────────────────────────────────────────────
-- For each post, the other runners whose run started within 5 minutes and
-- 100 m of this one — only those whose own post the viewer may see.
CREATE OR REPLACE FUNCTION public.get_post_companions(p_post_ids uuid[])
RETURNS TABLE (post_id uuid, user_id uuid, username text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mine AS (
    SELECT fp.id AS post_id, r.id AS run_id, r.user_id, r.started_at,
           ST_SetSRID(ST_MakePoint((r.gps_points->0->>'lng')::float8, (r.gps_points->0->>'lat')::float8), 4326)::geography AS start_pt
      FROM feed_posts fp JOIN runs r ON r.id = fp.run_id
     WHERE fp.id = ANY (p_post_ids) AND jsonb_array_length(COALESCE(r.gps_points, '[]'::jsonb)) > 0
       AND can_view_post(auth.uid(), fp.user_id, fp.visibility)
  )
  SELECT DISTINCT m.post_id, o.user_id, p.username
    FROM mine m
    JOIN runs o ON o.user_id <> m.user_id
               AND o.started_at BETWEEN m.started_at - interval '5 minutes' AND m.started_at + interval '5 minutes'
               AND jsonb_array_length(COALESCE(o.gps_points, '[]'::jsonb)) > 0
    JOIN feed_posts ofp ON ofp.run_id = o.id
    JOIN profiles p ON p.id = o.user_id
   WHERE ST_DWithin(m.start_pt,
           ST_SetSRID(ST_MakePoint((o.gps_points->0->>'lng')::float8, (o.gps_points->0->>'lat')::float8), 4326)::geography, 100)
     AND can_view_post(auth.uid(), o.user_id, ofp.visibility)
     AND o.user_id NOT IN (SELECT hidden_user_ids(auth.uid()));
$$;
CREATE INDEX IF NOT EXISTS runs_started_at_idx ON public.runs (started_at);

-- ── O3 ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.suggest_runners_nearby(lim int DEFAULT 5)
RETURNS TABLE (id uuid, username text, avatar_url text, avatar_color text, total_distance_km numeric, territory_score int, distance_km double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT last_known_location AS loc FROM profiles WHERE id = auth.uid())
  SELECT p.id, p.username, p.avatar_url, p.avatar_color, p.total_distance_km::numeric, p.territory_score::int,
         round((ST_Distance(p.last_known_location::geography, me.loc::geography) / 1000)::numeric, 1)::float8
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

-- ── N4 ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS friend_zone_alerts boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.notify_friend_zone_nearby()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_name text;
BEGIN
  IF NEW.geom IS NULL THEN RETURN NEW; END IF;
  SELECT username INTO v_name FROM profiles WHERE id = NEW.owner_id;
  FOR r IN
    SELECT DISTINCT f.follower_id AS uid
      FROM followers f
      JOIN profiles fp ON fp.id = f.follower_id AND fp.friend_zone_alerts
     WHERE f.following_id = NEW.owner_id
       AND NOT is_blocked_between(f.follower_id, NEW.owner_id)
       AND EXISTS (SELECT 1 FROM territory_polygons t
                    WHERE t.owner_id = f.follower_id
                      AND ST_DWithin(t.geom::geography, NEW.geom::geography, 300))
  LOOP
    PERFORM queue_notification(
      r.uid, 'territory_claimed',
      v_name || ' just claimed a zone next to yours',
      'Go and see what they took, or claim the ground around it first.',
      '/map', 'friend_zone:' || NEW.owner_id || ':' || to_char(now(), 'YYYY-MM-DD'), false);
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_friend_zone ON public.territory_polygons;
CREATE TRIGGER trg_notify_friend_zone AFTER INSERT ON public.territory_polygons
  FOR EACH ROW EXECUTE FUNCTION public.notify_friend_zone_nearby();

CREATE OR REPLACE FUNCTION public.set_friend_zone_alerts(p_on boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE profiles SET friend_zone_alerts = p_on WHERE id = auth.uid();
$$;
CREATE OR REPLACE FUNCTION public.get_friend_zone_alerts()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT friend_zone_alerts FROM profiles WHERE id = auth.uid();
$$;

-- ── C4 ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_challenges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 60),
  metric      text NOT NULL CHECK (metric IN ('distance_km', 'zones', 'active_days')),
  target      numeric NOT NULL CHECK (target > 0 AND target <= 10000),
  starts_at   timestamptz NOT NULL DEFAULT now(),
  ends_at     timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '92 days')
);
CREATE TABLE IF NOT EXISTS public.group_challenge_members (
  challenge_id uuid NOT NULL REFERENCES public.group_challenges(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'joined', 'declined')),
  joined_at    timestamptz,
  PRIMARY KEY (challenge_id, user_id)
);
ALTER TABLE public.group_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_challenge_members ENABLE ROW LEVEL SECURITY;
-- All access through the RPCs below.

CREATE OR REPLACE FUNCTION public.create_group_challenge(p_title text, p_metric text, p_target numeric, p_ends_at timestamptz, p_invitees uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_me text;
  u uuid;
  n int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF COALESCE(array_length(p_invitees, 1), 0) < 1 OR array_length(p_invitees, 1) > 19 THEN
    RAISE EXCEPTION 'a challenge has 2 to 20 people';
  END IF;
  INSERT INTO group_challenges (creator_id, title, metric, target, ends_at)
  VALUES (auth.uid(), trim(p_title), p_metric, p_target, p_ends_at) RETURNING id INTO v_id;
  INSERT INTO group_challenge_members (challenge_id, user_id, status, joined_at) VALUES (v_id, auth.uid(), 'joined', now());
  SELECT username INTO v_me FROM profiles WHERE id = auth.uid();
  FOREACH u IN ARRAY p_invitees LOOP
    -- Only people you follow, and who aren't blocked either way.
    CONTINUE WHEN u = auth.uid()
      OR NOT EXISTS (SELECT 1 FROM followers WHERE follower_id = auth.uid() AND following_id = u)
      OR is_blocked_between(auth.uid(), u);
    INSERT INTO group_challenge_members (challenge_id, user_id) VALUES (v_id, u) ON CONFLICT DO NOTHING;
    PERFORM queue_notification(u, 'challenge', v_me || ' challenged you: ' || trim(p_title),
      'Join before ' || to_char(p_ends_at, 'DD Mon'), '/challenges/' || v_id, 'challenge_invite:' || v_id, true);
    n := n + 1;
  END LOOP;
  IF n = 0 THEN RAISE EXCEPTION 'invite at least one runner you follow'; END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_group_challenge(p_challenge uuid, p_join boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE group_challenge_members
     SET status = CASE WHEN p_join THEN 'joined' ELSE 'declined' END,
         joined_at = CASE WHEN p_join THEN now() ELSE NULL END
   WHERE challenge_id = p_challenge AND user_id = auth.uid() AND status <> 'joined';
$$;

-- Progress for everyone who joined, counted between start and end.
CREATE OR REPLACE FUNCTION public.group_challenge_progress(p_challenge uuid)
RETURNS TABLE (user_id uuid, username text, avatar_color text, status text, progress numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.user_id, p.username, p.avatar_color, m.status,
    CASE c.metric
      WHEN 'distance_km' THEN COALESCE((SELECT round(sum(r.distance_m) / 1000.0, 1) FROM runs r
             WHERE r.user_id = m.user_id AND NOT COALESCE(r.excluded, false)
               AND r.started_at BETWEEN c.starts_at AND c.ends_at), 0)
      WHEN 'active_days' THEN COALESCE((SELECT count(DISTINCT (r.started_at AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date) FROM runs r
             WHERE r.user_id = m.user_id AND NOT COALESCE(r.excluded, false)
               AND r.started_at BETWEEN c.starts_at AND c.ends_at), 0)
      ELSE COALESCE((SELECT count(*) FROM zone_events e
             WHERE e.user_id = m.user_id AND e.kind IN ('claimed', 'stolen')
               AND e.at BETWEEN c.starts_at AND c.ends_at), 0)
    END
  FROM group_challenges c
  JOIN group_challenge_members m ON m.challenge_id = c.id
  JOIN profiles p ON p.id = m.user_id
  WHERE c.id = p_challenge
    AND EXISTS (SELECT 1 FROM group_challenge_members me WHERE me.challenge_id = c.id AND me.user_id = auth.uid())
    AND m.status <> 'declined'
  ORDER BY 5 DESC, p.username;
$$;

CREATE OR REPLACE FUNCTION public.my_group_challenges()
RETURNS TABLE (id uuid, title text, metric text, target numeric, starts_at timestamptz, ends_at timestamptz,
               creator_name text, my_status text, people int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.title, c.metric, c.target, c.starts_at, c.ends_at, p.username, me.status,
         (SELECT count(*)::int FROM group_challenge_members x WHERE x.challenge_id = c.id AND x.status = 'joined')
    FROM group_challenges c
    JOIN group_challenge_members me ON me.challenge_id = c.id AND me.user_id = auth.uid() AND me.status <> 'declined'
    JOIN profiles p ON p.id = c.creator_id
   ORDER BY (c.ends_at < now()), c.ends_at;
$$;

REVOKE ALL ON FUNCTION public.get_club_feed(uuid, int, timestamptz), public.get_post_companions(uuid[]),
  public.suggest_runners_nearby(int), public.set_friend_zone_alerts(boolean), public.get_friend_zone_alerts(),
  public.create_group_challenge(text, text, numeric, timestamptz, uuid[]), public.respond_group_challenge(uuid, boolean),
  public.group_challenge_progress(uuid), public.my_group_challenges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_club_feed(uuid, int, timestamptz), public.get_post_companions(uuid[]),
  public.suggest_runners_nearby(int), public.set_friend_zone_alerts(boolean), public.get_friend_zone_alerts(),
  public.create_group_challenge(text, text, numeric, timestamptz, uuid[]), public.respond_group_challenge(uuid, boolean),
  public.group_challenge_progress(uuid), public.my_group_challenges() TO authenticated;

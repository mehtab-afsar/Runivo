-- Social fixes from the pre-launch social audit (23 Nov 2026, /home/claude/audit/social.md).
--
--  1. P0-01  A post is visible only if its author's profile is visible to the viewer
--            (private profiles, and every 13-17 year old, were in Discover). Teens'
--            activities default to followers only.
--  2. P1-03  A comment counted twice (add_comment and trg_sync_comment_count).
--  3. P1-06  The follow graph was readable by anyone, anon included.
--  4. P1-07  Following a non-public profile is a request the owner approves; owners
--            can remove a follower. Direct inserts can only follow public profiles.
--  5. P1-05  Runner search on the server.
--  6. P1-08  Posts take the server's time and tier; level, xp, coins, energy and
--            achievements can't be set by the client (keeps 20261123000002's lock on
--            total_territories_claimed). P1-09 avatar_url must be the runner's own upload.
--  7. P1-13  Club invite links (any club, invite-only included) and a notification
--            to the owner when someone asks to join.
--  8. P2     Likers respect visibility; refresh_post_routes not for anon; broken
--            kudos trigger dropped; dead stories/run_photos tables dropped; awards,
--            join requests and attendees not world-readable; club totals not
--            owner-writable; likes only through toggle_like; seeded global lobbies
--            removed; live position not written inside a privacy place.
--
-- Comment read access (B11) and the text filter (20261123000001) are handled elsewhere.

SET search_path = public, extensions;

-- ── Helper: a profile's visibility, for policies (profiles is owner-only) ────
CREATE OR REPLACE FUNCTION public.profile_visibility_of(p_user uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT profile_visibility FROM public.profiles WHERE id = p_user $$;
REVOKE ALL ON FUNCTION public.profile_visibility_of(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_visibility_of(uuid) TO authenticated, service_role;

-- ── 1. Posts follow the author's profile visibility ──────────────────────────
CREATE OR REPLACE FUNCTION public.can_view_post(p_viewer uuid, p_author uuid, p_visibility text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p_viewer = p_author
      OR (
        p_viewer IS NOT NULL
        AND NOT public.is_blocked_between(p_viewer, p_author)
        AND public.can_view_profile(p_viewer, p_author, public.profile_visibility_of(p_author))
        AND (
          COALESCE(p_visibility, 'everyone') = 'everyone'
          OR (p_visibility = 'followers' AND EXISTS (
                SELECT 1 FROM public.followers WHERE follower_id = p_viewer AND following_id = p_author))
        )
      );
$$;
REVOKE ALL ON FUNCTION public.can_view_post(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_post(uuid, uuid, text) TO authenticated, service_role;

-- Teens: activities default to followers; what they already posted to everyone too.
UPDATE public.profiles SET default_activity_visibility = 'followers'
 WHERE age_range = 'under_18' AND default_activity_visibility = 'everyone';
UPDATE public.feed_posts SET visibility = 'followers'
 WHERE visibility = 'everyone'
   AND user_id IN (SELECT id FROM public.profiles WHERE age_range = 'under_18');

-- ── 2. One comment counts once ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_comment(p_post_id uuid, p_content text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, extensions
    AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.feed_post_comments (post_id, user_id, content)
  VALUES (p_post_id, auth.uid(), trim(p_content))
  RETURNING id INTO v_id;
  RETURN v_id;   -- trg_sync_comment_count keeps feed_posts.comment_count
END;
$$;
REVOKE ALL ON FUNCTION public.add_comment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_comment(uuid, text) TO authenticated, service_role;

UPDATE public.feed_posts fp
   SET comment_count = c.n
  FROM (SELECT p.id, count(c.id)::int AS n
          FROM public.feed_posts p LEFT JOIN public.feed_post_comments c ON c.post_id = p.id
         GROUP BY p.id) c
 WHERE c.id = fp.id AND fp.comment_count IS DISTINCT FROM c.n;

-- ── 3. Who follows whom is visible only where both profiles are ─────────────
DROP POLICY IF EXISTS "followers: anyone can read" ON public.followers;
CREATE POLICY "followers: visible edges" ON public.followers FOR SELECT TO authenticated USING (
  follower_id = auth.uid() OR following_id = auth.uid()
  OR (public.can_view_profile(auth.uid(), following_id, public.profile_visibility_of(following_id))
      AND public.can_view_profile(auth.uid(), follower_id, public.profile_visibility_of(follower_id))));
REVOKE ALL ON public.followers FROM anon;

-- ── 4. Follow requests ──────────────────────────────────────────────────────
CREATE TABLE public.follow_requests (
    follower_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT follow_requests_check CHECK (follower_id <> following_id)
);
CREATE INDEX follow_requests_following_idx ON public.follow_requests (following_id, created_at DESC);
ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follow_requests: either side reads" ON public.follow_requests
  FOR SELECT TO authenticated USING (auth.uid() = follower_id OR auth.uid() = following_id);
REVOKE ALL ON public.follow_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.follow_requests TO authenticated;
GRANT ALL ON public.follow_requests TO service_role;

-- Only public profiles can be followed with a plain insert; the rest go through set_follow.
DROP POLICY IF EXISTS "followers: self can follow" ON public.followers;
CREATE POLICY "followers: self can follow public profiles" ON public.followers FOR INSERT
  WITH CHECK (auth.uid() = follower_id AND public.profile_visibility_of(following_id) = 'public');

-- set_follow(target, true) follows (public) or asks (followers-only / private);
-- set_follow(target, false) unfollows or withdraws the request.
-- Returns the new state: 'following' | 'requested' | 'none'.
CREATE OR REPLACE FUNCTION public.set_follow(p_target uuid, p_follow boolean) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_me   uuid := auth.uid();
  v_vis  text;
  v_name text;
  v_new  boolean;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF p_target IS NULL OR p_target = v_me THEN RAISE EXCEPTION 'cannot follow yourself' USING ERRCODE = '22023'; END IF;

  IF NOT COALESCE(p_follow, false) THEN
    DELETE FROM public.followers WHERE follower_id = v_me AND following_id = p_target;
    DELETE FROM public.follow_requests WHERE follower_id = v_me AND following_id = p_target;
    RETURN 'none';
  END IF;

  IF EXISTS (SELECT 1 FROM public.followers WHERE follower_id = v_me AND following_id = p_target) THEN
    RETURN 'following';
  END IF;
  IF public.is_blocked_between(v_me, p_target) THEN RAISE EXCEPTION 'blocked' USING ERRCODE = '42501'; END IF;

  SELECT profile_visibility INTO v_vis FROM public.profiles WHERE id = p_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found' USING ERRCODE = '22023'; END IF;

  -- "Only me" means only me: nobody can follow it, so no request that leads nowhere.
  IF v_vis = 'private' THEN
    DELETE FROM public.follow_requests WHERE follower_id = v_me AND following_id = p_target;
    RETURN 'none';
  END IF;

  IF v_vis = 'public' THEN
    INSERT INTO public.followers (follower_id, following_id) VALUES (v_me, p_target) ON CONFLICT DO NOTHING;
    DELETE FROM public.follow_requests WHERE follower_id = v_me AND following_id = p_target;
    RETURN 'following';
  END IF;

  INSERT INTO public.follow_requests (follower_id, following_id) VALUES (v_me, p_target)
  ON CONFLICT DO NOTHING
  RETURNING true INTO v_new;
  IF v_new THEN
    SELECT username INTO v_name FROM public.profiles WHERE id = v_me;
    INSERT INTO public.notifications (user_id, type, title, body, action_url)
    VALUES (p_target, 'follow', COALESCE(v_name, 'A runner') || ' asked to follow you',
            'Tap to accept or decline.', '/profile/' || v_me::text);
  END IF;
  RETURN 'requested';
END;
$$;
REVOKE ALL ON FUNCTION public.set_follow(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_follow(uuid, boolean) TO authenticated, service_role;

-- Old clients: same rules. Returns true when you now follow them.
CREATE OR REPLACE FUNCTION public.toggle_follow(target_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, extensions
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.followers WHERE follower_id = auth.uid() AND following_id = target_id)
     OR EXISTS (SELECT 1 FROM public.follow_requests WHERE follower_id = auth.uid() AND following_id = target_id) THEN
    PERFORM public.set_follow(target_id, false);
    RETURN false;
  END IF;
  RETURN public.set_follow(target_id, true) = 'following';
END;
$$;
REVOKE ALL ON FUNCTION public.toggle_follow(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_follow(uuid) TO authenticated, service_role;

-- The profile owner accepts or declines a request.
CREATE OR REPLACE FUNCTION public.respond_follow_request(p_follower uuid, p_accept boolean) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_me uuid := auth.uid(); v_name text; v_vis text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.follow_requests WHERE follower_id = p_follower AND following_id = v_me;
  IF NOT FOUND THEN RETURN false; END IF;
  IF COALESCE(p_accept, false) THEN
    INSERT INTO public.followers (follower_id, following_id) VALUES (p_follower, v_me) ON CONFLICT DO NOTHING;
    SELECT username, profile_visibility INTO v_name, v_vis FROM public.profiles WHERE id = v_me;
    INSERT INTO public.notifications (user_id, type, title, body, action_url)
    VALUES (p_follower, 'follow', COALESCE(v_name, 'A runner') || ' accepted your follow request',
            CASE WHEN v_vis = 'private' THEN 'Their profile is set to Only me for now.'
                 ELSE 'You can see their activities now.' END,
            '/profile/' || v_me::text);
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.respond_follow_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_follow_request(uuid, boolean) TO authenticated, service_role;

-- Remove someone who follows you (they are not told).
CREATE OR REPLACE FUNCTION public.remove_follower(p_follower uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.followers WHERE follower_id = p_follower AND following_id = auth.uid();
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_follower(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_follower(uuid) TO authenticated, service_role;

-- A block also drops pending requests both ways.
CREATE OR REPLACE FUNCTION public.drop_follow_requests_on_block() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.follow_requests
   WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
      OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.drop_follow_requests_on_block() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_block_drops_follow_requests AFTER INSERT ON public.user_blocks
  FOR EACH ROW EXECUTE FUNCTION public.drop_follow_requests_on_block();

-- ── 5. Runner search ─────────────────────────────────────────────────────────
-- Username prefix search. Private profiles are not findable (unless you follow them).
CREATE OR REPLACE FUNCTION public.search_runners(q text, lim integer DEFAULT 20)
RETURNS TABLE(id uuid, username text, avatar_url text, avatar_color text, total_distance_km numeric, territory_score integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p.id, p.username, p.avatar_url, p.avatar_color,
         CASE WHEN public.can_view_profile(auth.uid(), p.id, p.profile_visibility) THEN p.total_distance_km END::numeric,
         p.territory_score::int
    FROM public.profiles p
   WHERE auth.uid() IS NOT NULL
     AND length(trim(COALESCE(q, ''))) >= 2
     AND p.username ILIKE replace(replace(replace(lower(trim(q)), '\', ''), '%', ''), '_', '\_') || '%'
     AND p.id <> auth.uid()
     AND p.id NOT IN (SELECT public.hidden_user_ids(auth.uid()))
     AND (p.profile_visibility <> 'private'
          OR EXISTS (SELECT 1 FROM public.followers f WHERE f.follower_id = auth.uid() AND f.following_id = p.id))
   ORDER BY length(p.username), p.username
   LIMIT LEAST(GREATEST(COALESCE(lim, 20), 1), 50);
$$;
REVOKE ALL ON FUNCTION public.search_runners(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_runners(text, integer) TO authenticated, service_role;

-- ── 6. Server-owned post time / tier and profile stats ───────────────────────
CREATE OR REPLACE FUNCTION public.feed_post_server_stats() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  NEW.created_at := now();     -- a post can't be dated into the future (or past)
  NEW := public.feed_post_with_server_stats(NEW);
  IF COALESCE(NEW.post_type, 'run') = 'run' THEN
    -- The tier of the biggest zone this run holds, not the client's word for it.
    NEW.territory_tier := (SELECT t.tier FROM public.territory_polygons t
                            WHERE t.run_id = NEW.run_id AND t.owner_id = NEW.user_id
                            ORDER BY t.area_m2 DESC LIMIT 1);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.protect_profile_columns() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_host text;
BEGIN
  IF auth.role() = 'service_role'
     OR current_setting('runivo.trusted_writer', true) = 'on' THEN
    RETURN NEW;
  END IF;

  NEW.subscription_tier       := OLD.subscription_tier;
  NEW.subscription_expires_at := OLD.subscription_expires_at;
  NEW.subscription_event_at   := OLD.subscription_event_at;
  NEW.pace_balance            := OLD.pace_balance;
  NEW.pace_total_earned       := OLD.pace_total_earned;
  NEW.pace_weekly_earned      := OLD.pace_weekly_earned;
  NEW.pace_weekly_reset_at    := OLD.pace_weekly_reset_at;
  NEW.runner_rank             := OLD.runner_rank;
  NEW.territory_score         := OLD.territory_score;
  NEW.follower_count          := OLD.follower_count;
  NEW.following_count         := OLD.following_count;
  NEW.streak_days             := OLD.streak_days;
  NEW.last_run_date           := OLD.last_run_date;
  NEW.total_distance_km       := OLD.total_distance_km;
  NEW.total_runs              := OLD.total_runs;
  -- Shown to other runners, with no server source: the client can't change them.
  NEW.level                   := OLD.level;
  NEW.xp                      := OLD.xp;
  NEW.coins                   := OLD.coins;
  NEW.energy                  := OLD.energy;
  NEW.unlocked_achievements   := OLD.unlocked_achievements;
  NEW.total_territories_claimed := OLD.total_territories_claimed;   -- server-owned since 20261123000002
  -- Becoming under 18 (age screen): activities default to followers. The rest of the
  -- minor rules (private, no live sharing, sticky flag) are guard_minor_profile (20261123000003).
  IF NEW.age_range = 'under_18' AND OLD.age_range IS DISTINCT FROM 'under_18'
     AND NEW.default_activity_visibility = 'everyone' THEN
    NEW.default_activity_visibility := 'followers';
  END IF;
  -- A profile photo is the runner's own upload in this project's avatars bucket
  -- (the host the runner's token was issued by: https://<project>/auth/v1).
  IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url AND NEW.avatar_url IS NOT NULL THEN
    v_host := lower(substring(COALESCE(auth.jwt() ->> 'iss', '') from '^https?://([^/]+)'));
    IF v_host IS NULL OR v_host !~ '^[a-z0-9.:-]+$' THEN v_host := '[A-Za-z0-9.:-]+'; ELSE v_host := replace(v_host, '.', '\.'); END IF;
    IF NEW.avatar_url !~ ('^https?://' || v_host || '/storage/v1/object/public/avatars/' || NEW.id::text || '/') THEN
      NEW.avatar_url := OLD.avatar_url;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_profile_columns() FROM PUBLIC, anon, authenticated;

-- ── 7. Club invites and join-request notifications ──────────────────────────
CREATE TABLE public.club_invites (
    club_id    uuid PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
    code       text NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.club_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_invites FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.club_invites TO service_role;

-- A club's invite code, for members to share (made on first ask).
CREATE OR REPLACE FUNCTION public.get_club_invite(p_club uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, extensions
    AS $$
DECLARE v_code text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.club_members WHERE club_id = p_club AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'only members can invite' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.club_invites (club_id) VALUES (p_club) ON CONFLICT (club_id) DO NOTHING;
  SELECT code INTO v_code FROM public.club_invites WHERE club_id = p_club;
  RETURN v_code;
END;
$$;
REVOKE ALL ON FUNCTION public.get_club_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_club_invite(uuid) TO authenticated, service_role;

-- Join with an invite code: works for invite-only clubs too. Removed members stay out.
-- Returns 'joined' | 'already' | 'bad_code' | 'banned'.
CREATE OR REPLACE FUNCTION public.join_club_with_invite(p_club uuid, p_code text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.club_members WHERE club_id = p_club AND user_id = v_me) THEN RETURN 'already'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.club_invites WHERE club_id = p_club AND code = p_code) THEN RETURN 'bad_code'; END IF;
  IF EXISTS (SELECT 1 FROM public.club_bans WHERE club_id = p_club AND user_id = v_me) OR public.is_banned(v_me) THEN
    RETURN 'banned';
  END IF;
  INSERT INTO public.club_members (club_id, user_id, role) VALUES (p_club, v_me, 'member') ON CONFLICT DO NOTHING;
  DELETE FROM public.club_join_requests WHERE club_id = p_club AND user_id = v_me;
  RETURN 'joined';
END;
$$;
REVOKE ALL ON FUNCTION public.join_club_with_invite(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_club_with_invite(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.notify_club_join_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, action_url)
  SELECT c.owner_id, 'club_join',
         COALESCE((SELECT username FROM public.profiles WHERE id = NEW.user_id), 'A runner') || ' wants to join ' || c.name,
         'Open the club''s Admin tab to accept or decline.', '/club/' || NEW.club_id::text
    FROM public.clubs c WHERE c.id = NEW.club_id AND c.owner_id <> NEW.user_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_club_join_request() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_notify_club_join_request AFTER INSERT ON public.club_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_club_join_request();

-- ── 8. Smaller items ─────────────────────────────────────────────────────────
-- P2-01: likers only for posts you can see, without hidden runners.
CREATE OR REPLACE FUNCTION public.get_post_likers(p_post_id uuid, lim integer DEFAULT 3)
RETURNS TABLE(id uuid, username text, avatar_url text, avatar_color text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, extensions
    AS $$
  SELECT p.id, p.username, p.avatar_url, p.avatar_color
    FROM public.feed_post_likes l
    JOIN public.feed_posts fp ON fp.id = l.post_id
    JOIN public.profiles p ON p.id = l.user_id
   WHERE l.post_id = p_post_id
     AND public.can_view_post(auth.uid(), fp.user_id, fp.visibility)
     AND l.user_id NOT IN (SELECT public.hidden_user_ids(auth.uid()))
   ORDER BY l.created_at DESC
   LIMIT LEAST(GREATEST(COALESCE(lim, 3), 1), 50);
$$;
REVOKE ALL ON FUNCTION public.get_post_likers(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_post_likers(uuid, integer) TO authenticated, service_role;

-- P2-02
REVOKE ALL ON FUNCTION public.refresh_post_routes(uuid, uuid) FROM anon;
-- P2-03: the kudos table's trigger read a column it doesn't have; nothing uses the table.
DROP TRIGGER IF EXISTS trg_notify_kudos ON public.kudos;
-- P2-07: unused tables (the stories bucket stays for delete-account's cleanup).
DROP TABLE IF EXISTS public.stories;
DROP TABLE IF EXISTS public.run_photos;
-- P2-08: a private runner's awards are private.
DROP POLICY IF EXISTS awards_read_own ON public.user_awards;
CREATE POLICY "user_awards: visible with the profile" ON public.user_awards FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_view_profile(auth.uid(), user_id, public.profile_visibility_of(user_id)));
REVOKE ALL ON public.user_awards FROM anon;
-- P2-09: who asked to join a club / who goes to an event.
DROP POLICY IF EXISTS "club_join_requests: anyone can read" ON public.club_join_requests;
CREATE POLICY "club_join_requests: requester or moderators" ON public.club_join_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_club_moderator(club_id, auth.uid()));
REVOKE ALL ON public.club_join_requests FROM anon;
DROP POLICY IF EXISTS "event_participants: anyone can read" ON public.event_participants;
CREATE POLICY "event_participants: signed-in, not hidden" ON public.event_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id NOT IN (SELECT public.hidden_user_ids(auth.uid())));
REVOKE ALL ON public.event_participants FROM anon;
-- P2-10: club owners edit the club's face, not its counters.
REVOKE UPDATE ON public.clubs FROM authenticated, anon;
GRANT UPDATE (name, description, badge_emoji, join_policy, avatar_url, banner_url) ON public.clubs TO authenticated;
-- P2-17: likes only through toggle_like, which keeps the counter.
REVOKE INSERT, DELETE ON public.feed_post_likes FROM authenticated, anon;
-- P2-11: seeded global rooms nobody can report in.
DELETE FROM public.lobbies WHERE club_id IS NULL AND created_by IS NULL
   AND id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
              '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004',
              '00000000-0000-0000-0000-000000000005');

-- P2-05: a live position inside one of your privacy places is not shared.
CREATE OR REPLACE FUNCTION public.skip_live_position_in_privacy_place() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, extensions
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.privacy_places pp
              WHERE pp.user_id = NEW.user_id
                AND ST_DWithin(pp.center, ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography, pp.radius_m)) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.skip_live_position_in_privacy_place() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_live_position_privacy BEFORE INSERT OR UPDATE OF lat, lng ON public.live_run_positions
  FOR EACH ROW EXECUTE FUNCTION public.skip_live_position_in_privacy_place();

-- ── 9. Word-filter triggers run as their owner ───────────────────────────────
-- 20261123000001's clear_blocked_text / replace_blocked_username are SECURITY
-- INVOKER, but contains_blocked_term is not executable by clients, so every
-- client insert into feed_posts, runs and profiles (sync upload, pushProfile's
-- upsert) failed with "permission denied for function contains_blocked_term".
-- reject_blocked_text already runs as definer; these now do too.
ALTER FUNCTION public.clear_blocked_text() SECURITY DEFINER;
ALTER FUNCTION public.replace_blocked_username() SECURITY DEFINER;

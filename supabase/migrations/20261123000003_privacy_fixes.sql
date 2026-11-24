-- Privacy fixes from the pre-launch review (23 Nov 2026), bugs.md B02, B04, B11, B12.
--
-- 1. Runners aged 13 to 17 (age_range = 'under_18', set by the age screen) keep
--    a safe start on the SERVER (Followers: only runners they approve), whatever a client sends:
--    - the profile can't be made public (Everyone), and live run sharing stays off.
--      The app used to push its stale phone copy of these on any settings change,
--      which turned a teen's private profile public when they switched km to mi (B02);
--    - 'under_18' can't be cleared or overwritten by the client, and a confirmed age
--      can't be un-confirmed. Onboarding sent null here when "About you" was skipped,
--      so PaceX stopped knowing it was coaching a minor (B04).
-- 2. Comments: readable only by signed-in runners who may see the post, never from
--    someone either side has blocked, never hidden ones (except the author's own).
--    Two SELECT policies used USING (true) with no role, so anyone with the public
--    anon key could read every comment, on followers-only and private posts too (B11).
--    get_comments (SECURITY DEFINER, skips RLS) gets the same post-visibility check.
-- 3. run_territories: the pre-polygon table, read by nothing, readable by anon and
--    ignoring map hiding and private places. 20261123000002 dropped its write
--    policies; the table itself goes (B12).

-- ── 1. Minors ────────────────────────────────────────────────────────────────
-- SECURITY INVOKER: it only edits NEW, needs no privileges of its own.
CREATE OR REPLACE FUNCTION public.guard_minor_profile() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    -- The minor flag and the age confirmation are one-way for clients.
    IF OLD.age_range = 'under_18' THEN
      NEW.age_range := OLD.age_range;
    END IF;
    IF OLD.age_confirmed_at IS NOT NULL AND NEW.age_confirmed_at IS NULL THEN
      NEW.age_confirmed_at := OLD.age_confirmed_at;
    END IF;
  END IF;

  IF NEW.age_range = 'under_18' THEN
    IF NEW.profile_visibility = 'public' THEN
      -- Asking for it outright is refused, so the app can say it didn't save.
      -- Becoming a minor on a public row (age screen, onboarding) goes to Followers:
      -- every follow of a non-public profile needs their approval (set_follow).
      IF OLD.age_range = 'under_18' AND OLD.profile_visibility IS DISTINCT FROM 'public' THEN
        RAISE EXCEPTION 'profiles of runners under 18 cannot be public' USING ERRCODE = '42501';
      END IF;
      NEW.profile_visibility := 'followers';
    END IF;
    IF NEW.live_run_sharing_enabled THEN
      IF OLD.age_range = 'under_18' AND NOT OLD.live_run_sharing_enabled THEN
        RAISE EXCEPTION 'live run sharing is not available under 18' USING ERRCODE = '42501';
      END IF;
      NEW.live_run_sharing_enabled := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_minor_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_guard_minor ON public.profiles;
CREATE TRIGGER profiles_guard_minor BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_minor_profile();

-- Rows already marked under 18 get the safe start now.
UPDATE public.profiles
   SET profile_visibility = 'followers'
 WHERE age_range = 'under_18' AND profile_visibility = 'public';
UPDATE public.profiles
   SET live_run_sharing_enabled = false
 WHERE age_range = 'under_18' AND live_run_sharing_enabled;

-- ── 2. Comments ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS comments_read ON public.feed_post_comments;
DROP POLICY IF EXISTS "feed_post_comments: anyone can read" ON public.feed_post_comments;

CREATE POLICY "feed_post_comments: viewers of the post read" ON public.feed_post_comments
  FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() OR hidden_at IS NULL)
    AND NOT public.is_blocked_between(auth.uid(), user_id)
    AND EXISTS (
      SELECT 1 FROM public.feed_posts p
       WHERE p.id = feed_post_comments.post_id
         AND public.can_view_post(auth.uid(), p.user_id, p.visibility)
    )
  );

REVOKE SELECT ON TABLE public.feed_post_comments FROM anon;

CREATE OR REPLACE FUNCTION public.get_comments(p_post_id uuid, lim integer DEFAULT 50)
    RETURNS TABLE(id uuid, user_id uuid, username text, avatar_color text, content text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT c.id, c.user_id, p.username, p.avatar_color,
         c.content, c.created_at
  FROM public.feed_post_comments c
  JOIN public.profiles p ON p.id = c.user_id
  JOIN public.feed_posts fp ON fp.id = c.post_id
  WHERE c.post_id = p_post_id
    AND c.hidden_at IS NULL
    AND public.can_view_post(auth.uid(), fp.user_id, fp.visibility)
    AND NOT public.is_blocked_between(auth.uid(), c.user_id)
  ORDER BY c.created_at ASC
  LIMIT lim;
$$;

REVOKE ALL ON FUNCTION public.get_comments(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_comments(uuid, integer) TO authenticated, service_role;

-- ── 3. Legacy run_territories ─────────────────────────────────────────────────
DROP TABLE IF EXISTS public.run_territories;

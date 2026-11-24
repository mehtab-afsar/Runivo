-- ============================================================
-- Backend hardening before the public launch (security audit 2026-11-24)
-- ============================================================
-- 1. Block and mute lists were readable by anyone. hidden_user_ids(uuid) and
--    leaderboard_circle(uuid, text) take ANY runner's id and are SECURITY
--    DEFINER, but the squashed grants left them executable by `anon`
--    (and not by `authenticated`). An anonymous caller could ask who a runner
--    blocked, was blocked by, or muted. Server-side callers only.
-- 2. The one RLS policy that used hidden_user_ids directly
--    (event_participants, 20261123000004) would fail with "permission denied
--    for function" for signed-in runners, because they cannot execute it.
--    It now goes through is_hidden_from_me(), which is bound to the caller.
-- 3. public_route_for(user, points, hidden) was executable by anyone and drops
--    the points near THAT user's privacy places: probing it with test points
--    locates a runner's home. Only the feed_posts route trigger needs it, so
--    that trigger becomes SECURITY DEFINER and clients lose access.
-- 4. sync_energy(uuid) let anyone reset any runner's energy regeneration clock.
--    No client calls it.
-- 5. is_blocked_between() had no reason to be callable anonymously.
-- 6. personal_records were readable by anyone, including anonymous callers and
--    runners with a private profile. Same rule as user_awards (20261123000004).
-- 7. Table privileges: RLS is the only barrier, so remove what clients never
--    need (TRUNCATE is not subject to RLS; anon never writes).
SET check_function_bodies = false;
SET client_min_messages = warning;
SET search_path = public, extensions;

-- ── 1. Block / mute lists: server-side only ───────────────────────────
REVOKE ALL ON FUNCTION public.hidden_user_ids(p_viewer uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hidden_user_ids(p_viewer uuid) TO service_role;

REVOKE ALL ON FUNCTION public.leaderboard_circle(p_viewer uuid, p_circle text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_circle(p_viewer uuid, p_circle text) TO service_role;

-- ── 2. A caller-bound wrapper for policies ────────────────────────────
CREATE OR REPLACE FUNCTION public.is_hidden_from_me(p_other uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, extensions
    AS $$
  SELECT p_other IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND p_other IN (SELECT public.hidden_user_ids(auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.is_hidden_from_me(p_other uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_hidden_from_me(p_other uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "event_participants: signed-in, not hidden" ON public.event_participants;
CREATE POLICY "event_participants: signed-in, not hidden" ON public.event_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR NOT public.is_hidden_from_me(user_id));

-- ── 3. Privacy-place oracle ───────────────────────────────────────────
-- blur_feed_post_route() (BEFORE INSERT/UPDATE trigger on feed_posts) was the
-- only caller and ran as the signed-in runner; as SECURITY DEFINER it keeps
-- working once the runner can no longer execute public_route_for().
ALTER FUNCTION public.blur_feed_post_route() SECURITY DEFINER;
ALTER FUNCTION public.blur_feed_post_route() SET search_path = public, extensions;
REVOKE ALL ON FUNCTION public.blur_feed_post_route() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.public_route_for(p_user uuid, p_points jsonb, p_post_hidden boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_route_for(p_user uuid, p_points jsonb, p_post_hidden boolean) TO service_role;

-- ── 4. Energy clock ───────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.sync_energy(p_user_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_energy(p_user_id uuid) TO service_role;

-- ── 5. Block lookups: signed-in callers only (policies need authenticated) ──
REVOKE ALL ON FUNCTION public.is_blocked_between(a uuid, b uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_blocked_between(a uuid, b uuid) TO authenticated, service_role;

-- ── 6. Personal records follow the profile's visibility ───────────────
DROP POLICY IF EXISTS pr_read ON public.personal_records;
CREATE POLICY "personal_records: visible with the profile" ON public.personal_records FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_view_profile(auth.uid(), user_id, public.profile_visibility_of(user_id)));
REVOKE ALL ON public.personal_records FROM anon;

-- ── 7. Table privileges ───────────────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM authenticated;

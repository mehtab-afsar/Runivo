-- Fixes from the independent review of the launch work (23 Nov 2026, review.md).
--
-- F5. "Friends running now" never showed anyone: the live_run_positions read
--     policy checked profiles.live_run_sharing_enabled with a plain sub-select,
--     and profiles is owner-only under RLS, so for any other runner it was empty.
-- F7. Whole-word matches that wiped innocent text: names and places such as
--     "Lund parkrun", "Run with Dick", "Randi's 10k", "Coon Rapids", "Paki Bay",
--     "Cum laude 5k", and words like nude/sexy that runners use in jokes.
-- F8. A post's tier came from its biggest piece while its area was the run's whole
--     claim, so they could disagree; a steal-only run got a tier with no area.

-- ── F5 ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.live_sharing_on(p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE((SELECT live_run_sharing_enabled FROM public.profiles WHERE id = p_user), false);
$$;
REVOKE ALL ON FUNCTION public.live_sharing_on(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.live_sharing_on(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "live_run_positions: mutual connections can read while live" ON public.live_run_positions;
CREATE POLICY "live_run_positions: mutual connections can read while live" ON public.live_run_positions
  FOR SELECT TO authenticated
  USING (
    updated_at > now() - interval '30 seconds'
    AND public.live_sharing_on(user_id)
    AND EXISTS (SELECT 1 FROM public.followers f WHERE f.follower_id = auth.uid() AND f.following_id = live_run_positions.user_id)
    AND EXISTS (SELECT 1 FROM public.followers f WHERE f.follower_id = live_run_positions.user_id AND f.following_id = auth.uid())
    AND NOT public.is_blocked_between(auth.uid(), live_run_positions.user_id)
  );

-- ── F7 ──────────────────────────────────────────────────────────────────────
DELETE FROM public.blocked_terms
 WHERE term IN ('dick', 'randi', 'lund', 'coon', 'coons', 'cum', 'paki', 'nude', 'nudity', 'sexy', 'raand', 'chod', 'gand');

-- ── F8 ──────────────────────────────────────────────────────────────────────
-- Same bands as the app's tierForArea (packages/shared/src/engine/runEngine.ts).
CREATE OR REPLACE FUNCTION public.tier_for_area(m2 double precision) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN m2 IS NULL OR m2 <= 0 THEN NULL
    WHEN m2 < 5000   THEN 'patch'
    WHEN m2 < 50000  THEN 'block'
    WHEN m2 < 200000 THEN 'district'
    WHEN m2 < 500000 THEN 'quarter'
    ELSE 'domain'
  END;
$$;

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
    -- The tier of the area this run claimed (the same number the post shows).
    NEW.territory_tier := public.tier_for_area(NEW.territory_area_m2);
  END IF;
  RETURN NEW;
END $$;

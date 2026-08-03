-- ============================================================
-- C-1: Stop exposing every user's PII to the entire internet
-- ============================================================
-- `profiles` has carried this policy since day one (20260301000001_core_schema.sql:110):
--
--   create policy "profiles: anyone can read" on public.profiles for select using (true);
--
-- It has no TO clause, so it applies to the `public` role — which includes `anon`.
-- Supabase grants anon SELECT on public tables by default, so RLS was the only gate
-- and it said `true`. Meanwhile the table accumulated:
--
--   • phone                (20260301000001_core_schema.sql:59)
--   • age/gender/height_cm/weight_kg (20260301000013_biometrics.sql:16-19)
--   • last_known_location  (20260515000057_city_rank_rpc.sql:2) — written on onboarding
--                          and after every run, i.e. effectively a home-address index
--
-- EXPO_PUBLIC_SUPABASE_ANON_KEY ships inside the app bundle by definition, so anyone
-- who ran `strings` on the IPA/AAB could dump the entire user table with one curl and
-- no account. This is the same class of bug 20260701000076_runs_owner_scope.sql fixed
-- for runs.gps_points; profiles was never revisited.
--
-- Fix: owner reads its own row in full; cross-user reads go through a view that
-- physically cannot project the sensitive columns. Column-level GRANTs alone are not
-- enough here — a missed grant still leaks via `select=*` through PostgREST.

-- ── 1. Replace the blanket read policy ──────────────────────────────────────
DROP POLICY IF EXISTS "profiles: anyone can read" ON public.profiles;

CREATE POLICY "profiles: owner reads own row"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- ── 2. Public projection for social surfaces ────────────────────────────────
-- security_invoker = off (the default) so the view runs as its owner and is not
-- blocked by the owner-only policy above. That is the entire point: it is the one
-- sanctioned path to other users' data, and it exposes only non-sensitive columns.
--
-- Deliberately EXCLUDED — do not add these back without a privacy review:
--   phone, age, gender, height_cm, weight_kg, last_known_location,
--   subscription_tier, subscription_expires_at, referred_by,
--   foot_type, foot_scan_at, coins, xp, energy, last_energy_regen,
--   pace_balance, pace_weekly_earned, pace_weekly_reset_at, last_run_date,
--   onboarding_completed_at, notifications_enabled, weekly_goal_km,
--   distance_unit, mission_difficulty, experience_level, weekly_frequency,
--   primary_goal, preferred_distance, playstyle
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = off) AS
  SELECT
    id,
    username,
    display_name,
    avatar_url,
    avatar_color,
    bio,
    location,
    instagram,
    strava,
    level,
    runner_rank,
    territory_score,
    pace_total_earned,
    total_distance_km,
    total_runs,
    total_territories_claimed,
    streak_days,
    follower_count,
    following_count,
    country,
    unlocked_achievements,
    pinned_run_id,
    created_at
  FROM public.profiles;

COMMENT ON VIEW public.profiles_public IS
  'Non-sensitive projection of profiles for leaderboards, feed, clubs and other-user '
  'profile screens. Never add PII (phone, biometrics, location) or private economy '
  'columns here — see 20260723000001_profiles_pii_lockdown.sql.';

-- ── 3. Grants ───────────────────────────────────────────────────────────────
-- anon must not reach this view: the anon key is extractable from the shipped binary.
REVOKE ALL ON public.profiles_public FROM PUBLIC;
REVOKE ALL ON public.profiles_public FROM anon;
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_public TO service_role;

-- ── 4. Repoint the one SECURITY INVOKER function that joins profiles ────────
-- get_map_polygons is LANGUAGE sql STABLE with SECURITY INVOKER, so the owner-only
-- policy above applies to its INNER JOIN on profiles — every territory belonging to
-- another player would silently drop out of the territory map. (Verified against a
-- local DB: joining profiles returned 0 rows for a rival's polygon, joining
-- profiles_public returned 1.) Everything else that reads profiles cross-user is
-- either SECURITY DEFINER (get_feed, the leaderboard RPCs) or was repointed on the
-- client to profiles_public.
CREATE OR REPLACE FUNCTION public.get_map_polygons(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision
)
RETURNS TABLE(
  id uuid, owner_id uuid, owner_name text, area_m2 double precision,
  freshness smallint, last_defended_at timestamptz, is_loop_fill boolean,
  tier text, polygon_coords jsonb
)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    tp.id,
    tp.owner_id,
    COALESCE(tp.owner_name, p.username) AS owner_name,
    tp.area_m2,
    tp.freshness,
    tp.last_defended_at,
    tp.is_loop_fill,
    tp.tier,
    tp.polygon_coords
  FROM territory_polygons tp
  JOIN profiles_public p ON p.id = tp.owner_id
  WHERE tp.geom IS NOT NULL
    AND tp.polygon_coords IS NOT NULL
    AND jsonb_array_length(tp.polygon_coords) >= 4
    AND ST_Intersects(
      tp.geom,
      ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    )
  LIMIT 500;
$function$;

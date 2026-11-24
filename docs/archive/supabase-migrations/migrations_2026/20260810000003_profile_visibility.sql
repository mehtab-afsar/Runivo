-- ============================================================
-- Settings' "Profile Visibility" (Public/Friends/Private) selector persisted
-- locally (StoredSettings.privacy) and nothing else — no column on `profiles`,
-- no RLS policy, no query anywhere ever read it. Picking "Private" changed
-- nothing: any authenticated user could still load your full profile via
-- profiles_public (its RLS is `security_invoker = off`, i.e. no row-level
-- restriction at all).
--
-- Scope of this fix, deliberately bounded: it restricts the PROFILE VIEW
-- itself (what UserProfileScreen shows a visitor) — bio, stats, awards. It
-- does NOT touch leaderboards, club rosters, or feed post attribution, which
-- still show username/avatar the same way a private Instagram/Strava account's
-- username still appears in places you already interact (comments, club
-- membership lists). Locking down every surface a profile fact appears on is
-- a much larger change; this covers the one place a stranger actually goes to
-- look you up.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (profile_visibility IN ('public', 'followers', 'private'));

-- Returns the target's public profile fields, restricted by profile_visibility
-- unless the viewer is the owner, an accepted follower (for 'followers'), or
-- the profile is 'public'. SECURITY DEFINER so it can check the followers
-- table itself rather than relying on the caller already having row access.
CREATE OR REPLACE FUNCTION get_user_profile_for_viewer(p_target_id UUID)
RETURNS TABLE(
  username TEXT, display_name TEXT, bio TEXT, location TEXT,
  avatar_url TEXT, avatar_color TEXT, runner_rank TEXT,
  total_runs INT, total_distance_km FLOAT8, total_territories_claimed INT,
  follower_count INT, following_count INT,
  restricted BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_visibility TEXT;
  v_can_view   BOOLEAN;
BEGIN
  SELECT profile_visibility INTO v_visibility FROM profiles WHERE id = p_target_id;
  IF v_visibility IS NULL THEN
    RETURN; -- target doesn't exist — empty result set
  END IF;

  v_can_view := (
    auth.uid() = p_target_id
    OR v_visibility = 'public'
    OR (v_visibility = 'followers' AND EXISTS (
      SELECT 1 FROM followers WHERE follower_id = auth.uid() AND following_id = p_target_id
    ))
  );

  IF v_can_view THEN
    RETURN QUERY
      SELECT p.username, p.display_name, p.bio, p.location,
             p.avatar_url, p.avatar_color, p.runner_rank,
             p.total_runs, p.total_distance_km::FLOAT8, p.total_territories_claimed,
             p.follower_count, p.following_count,
             FALSE
      FROM profiles p WHERE p.id = p_target_id;
  ELSE
    -- Minimal identity only — username/avatar so the profile screen can still
    -- render a header, everything else withheld.
    RETURN QUERY
      SELECT p.username, p.display_name, NULL::TEXT, NULL::TEXT,
             p.avatar_url, p.avatar_color, NULL::TEXT,
             NULL::INT, NULL::FLOAT8, NULL::INT,
             NULL::INT, NULL::INT,
             TRUE
      FROM profiles p WHERE p.id = p_target_id;
  END IF;
END;
$$;

-- Client-callable (unlike the service-role-only functions elsewhere) — it does
-- its own authorization check internally via auth.uid(), so authenticated is
-- the right grant. anon is revoked: this app has no unauthenticated browsing,
-- so there's no legitimate caller without a real session.
REVOKE EXECUTE ON FUNCTION get_user_profile_for_viewer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_user_profile_for_viewer(UUID) TO authenticated;

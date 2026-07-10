-- ============================================================
-- H19: join_policy is never enforced — anyone can join an invite-only club
-- ============================================================
-- "club_members: self can join" (20260301000005) only checks
-- `auth.uid() = user_id` — it never looks at the club's join_policy, so any
-- authenticated user can insert themselves into an invite-only club directly,
-- bypassing the entire approval flow (and gaining membership-scoped read
-- access, e.g. club chat, as a side effect). accept_club_join_request is
-- SECURITY DEFINER and already verifies the caller is an owner/admin before
-- inserting, so it's unaffected by tightening this policy — it's the only
-- remaining path for invite_only clubs.

DROP POLICY IF EXISTS "club_members: self can join" ON public.club_members;

CREATE POLICY "club_members: self can join open clubs"
  ON public.club_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = club_id AND join_policy = 'open'
    )
  );

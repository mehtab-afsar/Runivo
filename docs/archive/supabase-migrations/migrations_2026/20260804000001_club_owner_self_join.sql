-- ============================================================
-- Creating an invite-only club left the creator outside their own club
-- ============================================================
-- club_members' only INSERT policy is:
--
--   auth.uid() = user_id
--   AND EXISTS (SELECT 1 FROM clubs WHERE id = club_id AND join_policy = 'open')
--
-- clubService.createClub() inserts the club, then inserts the creator into
-- club_members as 'admin'. For an OPEN club that second insert satisfies the
-- policy. For an INVITE_ONLY club it does not — the club row is created, but the
-- creator is never added as a member.
--
-- The client never checked that second insert's error (it returns a Club object
-- with joined: true regardless), so the failure was completely silent: the club
-- appeared to be created, the creator was not in it, the Admin tab never
-- rendered (it keys off club_members.role = 'admin'), and nobody could approve
-- join requests for it — permanently orphaned the moment it was made.
--
-- Fix: let a club's own owner insert their membership row regardless of
-- join_policy. Deliberately scoped to clubs.owner_id = auth.uid(), so it grants
-- nothing beyond "the person who just created this club may join it".
-- Everyone else still goes through the open-club policy or the
-- accept_club_join_request RPC.

DROP POLICY IF EXISTS "club_members: owner can join own club" ON public.club_members;
CREATE POLICY "club_members: owner can join own club"
  ON public.club_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.clubs
      WHERE clubs.id = club_members.club_id
        AND clubs.owner_id = auth.uid()
    )
  );

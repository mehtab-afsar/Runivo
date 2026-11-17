-- Fix BUG-08: Club owner can leave without transferring ownership
-- Adds a BEFORE DELETE trigger on club_members that blocks removal of the
-- last owner. The owner must promote another member or delete the club.

CREATE OR REPLACE FUNCTION public.prevent_orphaned_club()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.role = 'owner' THEN
    -- Allow cascade delete: if the club itself has already been deleted, let it proceed
    IF NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = OLD.club_id) THEN
      RETURN OLD;
    END IF;
    -- Block if this would leave the club with no owner
    IF NOT EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = OLD.club_id
        AND user_id != OLD.user_id
        AND role = 'owner'
    ) THEN
      RAISE EXCEPTION 'Cannot remove the last owner of a club. Transfer ownership or delete the club first.';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_orphaned_club
  BEFORE DELETE ON public.club_members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_orphaned_club();

COMMENT ON FUNCTION public.prevent_orphaned_club IS
  'Prevents the last owner of a club from leaving without transferring ownership.
   To leave: first promote another member to owner, then delete your own membership.';

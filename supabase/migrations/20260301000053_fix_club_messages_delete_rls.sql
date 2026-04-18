-- Fix: club_messages has no DELETE RLS policy
-- Users cannot delete their own messages. Club owners/admins cannot moderate.

-- Allow members to delete their own messages
CREATE POLICY "Members can delete own messages"
  ON public.club_messages
  FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id  = club_messages.club_id
        AND user_id  = auth.uid()
    )
  );

-- Allow club owners and admins to delete any message (moderation)
CREATE POLICY "Club owners and admins can delete any message"
  ON public.club_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = club_messages.club_id
        AND user_id = auth.uid()
        AND role    IN ('owner', 'admin')
    )
  );

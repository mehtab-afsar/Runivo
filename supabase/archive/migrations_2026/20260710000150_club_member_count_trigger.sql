-- ============================================================
-- M26: clubs.member_count only updated by accept_club_join_request
-- ============================================================
-- Direct joins (open clubs, via club_members upsert) and leaves (delete) never
-- touched member_count — only the invite-only approval RPC did — so counts
-- drifted from reality after every open-club join/leave. A trigger on
-- club_members keeps it accurate regardless of which path added/removed a row,
-- so the RPC's manual increment is removed to avoid double-counting.

CREATE OR REPLACE FUNCTION sync_club_member_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.clubs SET member_count = member_count + 1 WHERE id = NEW.club_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.clubs SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.club_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS club_members_sync_count ON public.club_members;
CREATE TRIGGER club_members_sync_count
  AFTER INSERT OR DELETE ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION sync_club_member_count();

-- Remove the now-redundant manual increment — the trigger above fires on the
-- same INSERT this function performs.
CREATE OR REPLACE FUNCTION public.accept_club_join_request(request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_club_id uuid;
  v_user_id uuid;
BEGIN
  SELECT club_id, user_id INTO v_club_id, v_user_id
  FROM public.club_join_requests
  WHERE id = request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = v_club_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.club_join_requests SET status = 'accepted' WHERE id = request_id;

  INSERT INTO public.club_members (club_id, user_id, role)
    VALUES (v_club_id, v_user_id, 'member')
    ON CONFLICT DO NOTHING;
END;
$$;

-- Recalculate existing clubs' counts once so pre-existing drift is corrected.
UPDATE public.clubs c
SET member_count = (SELECT COUNT(*) FROM public.club_members cm WHERE cm.club_id = c.id);

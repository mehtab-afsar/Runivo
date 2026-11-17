-- ============================================================
-- club_activity: the table clubService.ts has always queried, and that
-- ClubDetailScreen's Activity tab has always rendered — except it was never
-- created. fetchClubActivity() silently swallows the resulting query error
-- (`if (!data) return []`), so the Activity tab has been permanently empty
-- for every club, with no visible failure anywhere.
-- ============================================================
-- Creating it for real also enables surfacing club activity in the main
-- Feed (previously nothing connected club membership to the feed at all):
-- a client query with no club_id filter, combined with the membership-scoped
-- SELECT policy below, naturally returns "activity from clubs I'm in" —
-- exactly what a cross-club feed section needs, with no extra RPC.
--
-- Only 'joined' is populated for now (on club_members insert). 'captured' /
-- 'lost' / 'defended' / 'leveled_up' are wired into the ActivityAction type
-- and ACTION_LABELS already but nothing in the run/territory pipeline emits
-- them yet — that's a club-territory linkage that doesn't exist elsewhere in
-- the schema either, so it's out of scope here rather than half-wired.
-- ============================================================

CREATE TABLE public.club_activity (
  id          uuid        primary key default gen_random_uuid(),
  club_id     uuid        not null references public.clubs(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  username    text        not null,
  action      text        not null check (action in ('captured', 'lost', 'defended', 'joined', 'leveled_up')),
  detail      text,
  created_at  timestamptz not null default now()
);

CREATE INDEX club_activity_club_id_idx ON public.club_activity(club_id, created_at desc);

COMMENT ON TABLE public.club_activity IS 'Per-club activity feed, e.g. member joins. Read is scoped to members of that club.';

ALTER TABLE public.club_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club_activity: members can read"
  ON public.club_activity FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_activity.club_id AND cm.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policy for authenticated users — writes only via
-- this SECURITY DEFINER trigger.
CREATE OR REPLACE FUNCTION public.log_club_activity_on_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_username text;
BEGIN
  SELECT username INTO v_username FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.club_activity (club_id, user_id, username, action)
  VALUES (NEW.club_id, NEW.user_id, COALESCE(v_username, 'Runner'), 'joined');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_club_activity_on_join ON public.club_members;
CREATE TRIGGER trg_log_club_activity_on_join
  AFTER INSERT ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION public.log_club_activity_on_join();

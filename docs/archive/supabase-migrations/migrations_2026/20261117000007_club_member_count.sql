-- New clubs showed "2 members" with only the creator in them: the app inserted
-- the club with member_count = 1, then the creator's club_members row added 1
-- more (club_members_sync_count). A new club now always starts at 0 and the
-- count only moves with real member rows; existing counts are recomputed once.

-- The column defaulted to 1, which double-counted the creator the same way.
ALTER TABLE public.clubs ALTER COLUMN member_count SET DEFAULT 0;

CREATE OR REPLACE FUNCTION public.clubs_start_at_zero()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Clubs made from the app (a signed-in user) start empty; the creator's member
  -- row then counts them. Server-side writers (seed data, admin tools) are left alone.
  IF auth.uid() IS NOT NULL AND COALESCE(current_setting('runivo.trusted_writer', true), '') <> 'on' THEN
    NEW.member_count := 0;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS clubs_start_at_zero ON public.clubs;
CREATE TRIGGER clubs_start_at_zero BEFORE INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.clubs_start_at_zero();

UPDATE public.clubs c
   SET member_count = s.n
  FROM (SELECT cl.id, count(m.user_id)::int AS n
          FROM public.clubs cl LEFT JOIN public.club_members m ON m.club_id = cl.id
         GROUP BY cl.id) s
 WHERE s.id = c.id AND c.member_count IS DISTINCT FROM s.n;

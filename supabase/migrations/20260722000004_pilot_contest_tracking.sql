-- ============================================================
-- Pilot instrumentation: precise steal→reclaim + contested-run tracking
-- ============================================================
-- Added ahead of the closed-club pilot to make the core hypothesis
-- ("does losing territory make someone run to reclaim it") answerable
-- precisely rather than via a coarse "did the victim run again" proxy.
--
-- 1. feed_posts.stolen_territory_id links a victim's 'attack' feed post to
--    the actual territory_polygons row that was taken, so a later query can
--    check whether the SAME spot was reclaimed within N hours (not just
--    whether the victim ran anywhere).
-- 2. run_territory_contests logs every rival-territory overlap detected
--    during a run, whether or not it crossed the steal threshold — today
--    process-run-territory computes this in-memory and discards anything
--    that doesn't qualify, so "contested-run rate" (exposure, not just
--    completed steals) is currently unmeasurable at any granularity.

ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS stolen_territory_id uuid REFERENCES public.territory_polygons(id);

CREATE TABLE IF NOT EXISTS public.run_territory_contests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         uuid NOT NULL,
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rival_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  overlap_pct    numeric NOT NULL,
  qualified      boolean NOT NULL, -- true if this overlap actually crossed the steal threshold
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS run_territory_contests_user_id_idx ON public.run_territory_contests(user_id);

ALTER TABLE public.run_territory_contests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can read their own contest log" ON public.run_territory_contests;
CREATE POLICY "users can read their own contest log"
  ON public.run_territory_contests FOR SELECT
  USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policy for authenticated users — RLS default-denies
-- direct writes; only process-run-territory (service_role) writes this table.

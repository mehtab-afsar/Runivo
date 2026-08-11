-- ============================================================
-- Live Run Sharing — see a friend's avatar moving on the map while
-- they're actually running, not their idle whereabouts.
-- ============================================================
-- Deliberately NOT Snap Map's model. Snap Map's real, still-live-in-2026
-- criticism is that it shows PERSISTENT idle location — where you live, that
-- your home is empty right now. This is structurally different: a row here
-- only exists while a mutual connection has opted in AND is actively
-- running AND updated within the last 30 seconds. Stop running, pause, or
-- close the app, and you disappear within one missed update — there is no
-- "last seen 3 hours ago" state, on purpose.
--
-- Visibility requires ALL of:
--   1. The runner has live_run_sharing_enabled = true (off by default)
--   2. The viewer and runner mutually follow each other (both directions in
--      `followers`) — a one-way follower (the common case, e.g. a public
--      figure with many followers who don't follow back) can never see this,
--      unlike Snap Map's broader "friends" list that critics have pointed
--      out often includes near-strangers.
--   3. The row is fresh (<30s old) — enforced in the RLS policy itself, not
--      just client-side, so even a direct API call can't fetch a stale
--      position.
--
-- One row per user (PK = user_id) — a run overwrites, never accumulates, so
-- there's no location history to ever leak or need to purge.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS live_run_sharing_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.live_run_positions (
  user_id     uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  run_id      text NOT NULL,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.live_run_positions IS
  'Ephemeral, single-row-per-user live position during an active run. Overwritten every update, deleted on run stop — never a history table.';

ALTER TABLE public.live_run_positions ENABLE ROW LEVEL SECURITY;

-- Owner: full read/write/delete on their own row (upsert while running,
-- delete on stop/pause).
CREATE POLICY "live_run_positions: owner full access"
  ON public.live_run_positions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Mutual connections: read-only, and only while every condition above holds.
-- Written as three EXISTS checks rather than a helper function so the whole
-- rule is visible in one place during a security review.
CREATE POLICY "live_run_positions: mutual connections can read while live"
  ON public.live_run_positions FOR SELECT TO authenticated
  USING (
    updated_at > now() - interval '30 seconds'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = live_run_positions.user_id AND p.live_run_sharing_enabled = true
    )
    AND EXISTS (
      SELECT 1 FROM public.followers
      WHERE follower_id = auth.uid() AND following_id = live_run_positions.user_id
    )
    AND EXISTS (
      SELECT 1 FROM public.followers
      WHERE follower_id = live_run_positions.user_id AND following_id = auth.uid()
    )
  );

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- postgres_changes respects RLS on the subscribing client's own session, so a
-- viewer only ever receives change events for rows the SELECT policy above
-- already allows them to see — the same guarantee territory_polygons relies
-- on (20260515000056_territory_polygon_and_pace.sql).
ALTER PUBLICATION supabase_realtime ADD TABLE live_run_positions;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_run_positions TO authenticated;

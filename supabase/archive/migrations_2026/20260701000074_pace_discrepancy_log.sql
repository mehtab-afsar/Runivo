-- process-run-territory/index.ts inserts here whenever client/server PACE disagree by
-- more than 2 (comparing clientPaceEarned vs serverPaceEarned) — this write path fires
-- on every run sync with a meaningful GPS-filtering discrepancy and has always been
-- live, but silently swallowed by its own try/catch since this table was never created
-- (the insert's own comment even says "silently skipped if table absent"). No read site
-- exists anywhere in the app yet — this is write-only observability, useful once a
-- query/dashboard is built against it.
CREATE TABLE IF NOT EXISTS public.pace_discrepancy_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  run_id          UUID        NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  client_pace     INT         NOT NULL,
  server_pace     INT         NOT NULL,
  distance_km     NUMERIC     NOT NULL,
  gps_point_count INT         NOT NULL,
  logged_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pace_discrepancy_log ENABLE ROW LEVEL SECURITY;
-- Written only from process-run-territory (service-role client, bypasses RLS by
-- default) — no client-side insert/select policy needed since nothing reads this yet.

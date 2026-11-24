-- ============================================================
-- Pilot instrumentation: steal-notification A/B arm
-- ============================================================
-- The "⚔ Your territory is under attack" push is the product's single
-- strongest re-engagement hook, and the pilot's job is to put a number on it
-- rather than assume it works. process-run-territory now randomises whether
-- that push actually fires for each steal, and records the arm here.
--
-- What this measures, precisely: a suppressed victim STILL sees the attack in
-- their feed the next time they open the app. So this isolates whether the
-- PROACTIVE ALERT drives the return run — not whether awareness does. That is
-- the intended question; do not report it as "does losing territory matter".
--
-- Power caveat: with ~30 pilot users over 4 weeks there may only be a few
-- dozen steal events total. Split across two arms this is directionally
-- useful, NOT statistically significant. Pair it with the qualitative calls.

ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS push_suppressed boolean NOT NULL DEFAULT false;

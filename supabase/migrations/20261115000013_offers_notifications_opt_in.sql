-- ============================================================
-- Promotional notifications are opt-in (App Store Guideline 4.5.4).
--
-- profiles.offers_enabled gates every 'campaign' / 'new_event' push, including
-- the partner-store nudges ("You have the PACE for it") sent by
-- store_digest / run_hourly_notifications. It defaulted to TRUE, so every runner
-- received partner and promotional pushes without ever agreeing to them. Apple
-- requires explicit consent for push that promotes anything; gameplay alerts
-- (zone attacked, fading zones, streak) are separate settings and unchanged.
--
-- Default off. Existing rows are reset too: the column was never shown to the
-- runner at signup, so no existing 'true' was a choice. (The app has not shipped
-- to the App Store yet, so no live user loses a preference they set.)
-- ============================================================

ALTER TABLE public.profiles ALTER COLUMN offers_enabled SET DEFAULT false;
UPDATE public.profiles SET offers_enabled = false WHERE offers_enabled IS DISTINCT FROM false;

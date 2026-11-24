-- ============================================================
-- Explicit consent before personal data goes to a third-party AI
-- (App Store Guideline 5.1.2(i)).
--
-- supabase/functions/ai-coach sends a runner's runs, pace, heart rate, weight,
-- age range, an optional imported health baseline, and anything they type in
-- chat to Anthropic. Until now nothing asked first, and the post-run debrief
-- fired automatically after every synced run. The function now refuses
-- (403 ai_consent_required) unless this column is set; the app shows a consent
-- screen that names Anthropic and what is sent before it sets it, and Settings
-- can withdraw it (NULL).
--
-- Separate from health_consent_at: that one is about importing health-app data,
-- this one is about sending any of it to the AI provider.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_consent_at timestamptz;

COMMENT ON COLUMN public.profiles.ai_consent_at IS
  'When the runner agreed to send their run and fitness data to the third-party AI provider (Anthropic) for PaceX. NULL = no consent; the ai-coach function refuses.';

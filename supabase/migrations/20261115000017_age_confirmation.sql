-- ============================================================
-- Age check (Terms 1: Runivo is for runners 13 and over).
--
-- Every signed-in account passes an age screen once (birth month and year; the
-- date itself is never stored). This column records that the check was passed.
-- A runner under 13 is not allowed in and their account is deleted; 13 to 17
-- start with a private profile and no live sharing (set by the app at that
-- moment). NULL = not checked yet, so existing accounts are asked once.
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_confirmed_at timestamptz;

COMMENT ON COLUMN public.profiles.age_confirmed_at IS
  'When this runner passed the age screen (13 or over). NULL = not asked yet. The birth date is not stored.';

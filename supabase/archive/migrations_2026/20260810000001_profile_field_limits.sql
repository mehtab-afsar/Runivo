-- Profile edit fields (display_name, bio, location, instagram, strava) had no
-- length limit anywhere — no DB constraint despite a doc comment on `bio`
-- claiming a 150-char cap (20260301000017_profile_columns.sql), and no
-- `maxLength` in EditProfileSheet.tsx. A client could submit an arbitrarily
-- large string for any of them. The UI now enforces the same limits via
-- maxLength (apps/mobile/src/features/profile/components/EditProfileSheet.tsx)
-- — this migration is the real backstop, since the UI limit alone doesn't stop
-- a direct API call.
--
-- Truncate any existing over-limit values first so the CHECK can be added
-- unconditionally rather than failing against existing data.
UPDATE profiles SET display_name = left(display_name, 40) WHERE char_length(display_name) > 40;
UPDATE profiles SET bio          = left(bio, 150)          WHERE char_length(bio) > 150;
UPDATE profiles SET location     = left(location, 60)       WHERE char_length(location) > 60;
UPDATE profiles SET instagram    = left(instagram, 100)     WHERE char_length(instagram) > 100;
UPDATE profiles SET strava       = left(strava, 200)        WHERE char_length(strava) > 200;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_display_name_length CHECK (display_name IS NULL OR char_length(display_name) <= 40),
  ADD CONSTRAINT profiles_bio_length          CHECK (bio          IS NULL OR char_length(bio)          <= 150),
  ADD CONSTRAINT profiles_location_length     CHECK (location     IS NULL OR char_length(location)     <= 60),
  ADD CONSTRAINT profiles_instagram_length    CHECK (instagram    IS NULL OR char_length(instagram)    <= 100),
  ADD CONSTRAINT profiles_strava_length       CHECK (strava       IS NULL OR char_length(strava)       <= 200);

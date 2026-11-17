-- City Rank (get_city_rank RPC, migration 20260515000057) has been silently returning
-- a rank for every user regardless of merit, because no rival profile ever has
-- last_known_location populated. The app is being updated to populate
-- last_known_location on onboarding location grant and after each run — this
-- migration adds the matching `country` column so the client can push both together
-- via the existing profiles upsert (no RLS change needed: the existing
-- "profiles: owner can update" policy already covers new columns on the same row).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS country TEXT;

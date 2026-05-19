-- Add columns that Admin.tsx already writes but the schema was missing
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS organizer  TEXT,
  ADD COLUMN IF NOT EXISTS image_url  TEXT,
  ADD COLUMN IF NOT EXISTS pace_bonus INT NOT NULL DEFAULT 0;

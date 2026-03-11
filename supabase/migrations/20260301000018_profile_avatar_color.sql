-- ============================================================
-- Migration 018: Add avatar_color column to profiles
-- ============================================================
-- The Edit Profile sheet has a color picker for the user's
-- avatar hexagon, but the selected color ID was never persisted
-- (profiles only had avatar_url for a photo URL, not a color).
-- Adding avatar_color so the choice is remembered across sessions
-- and devices.
-- ============================================================

alter table public.profiles
  add column if not exists avatar_color text not null default 'teal';

comment on column public.profiles.avatar_color is 'Avatar color scheme ID, e.g. "teal", "indigo", "rose". Matches AVATAR_COLORS in the frontend.';

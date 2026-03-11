-- ============================================================
-- Migration 017: Add bio and location columns to profiles
-- ============================================================
-- The Edit Profile sheet collects bio (textarea, max 150 chars)
-- and location (text input) but these were never persisted —
-- no columns existed. Adding them so saves round-trip correctly.
-- ============================================================

alter table public.profiles
  add column if not exists bio      text,
  add column if not exists location text;

comment on column public.profiles.bio      is 'Short user bio (max 150 characters).';
comment on column public.profiles.location is 'User location string, e.g. "New Delhi, India".';

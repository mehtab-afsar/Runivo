-- ============================================================
-- Migration 023: Profile Social Fields
-- ============================================================
-- Adds display_name, strava, and instagram columns so that
-- profile edits are persisted to the database and not just
-- stored in localStorage.
-- ============================================================

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists strava       text,
  add column if not exists instagram    text;

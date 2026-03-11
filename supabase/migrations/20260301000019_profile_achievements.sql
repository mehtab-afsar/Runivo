-- ============================================================
-- Migration 019: Persist unlocked achievements in profiles
-- ============================================================
-- unlockedAchievements[] was IndexedDB-only — clearing the
-- browser or switching devices wiped all earned badges.
-- This column lets pushProfile/pullProfile sync them to Supabase
-- so achievements are preserved across sessions and devices.
-- ============================================================

alter table public.profiles
  add column if not exists unlocked_achievements text[] not null default '{}';

comment on column public.profiles.unlocked_achievements is
  'Array of achievement IDs the user has unlocked, e.g. ["first_run","streak_7"].
   Merged (union) on pull so achievements are never removed.';

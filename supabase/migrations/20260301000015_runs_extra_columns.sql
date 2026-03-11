-- ============================================================
-- Migration 015: Add missing reward columns to runs table
-- ============================================================
-- The frontend stores diamonds_earned, enemy_captured, and
-- pre_run_level on every run, but these columns were missing
-- from the original schema, causing them to be silently dropped
-- on every sync cycle (pullRuns would reset them to 0 via ?? 0
-- fallbacks). Adding them with safe defaults so existing rows
-- are unaffected and future syncs round-trip the data correctly.
-- ============================================================

alter table public.runs
  add column if not exists diamonds_earned  int not null default 0,
  add column if not exists enemy_captured   int not null default 0,
  add column if not exists pre_run_level    int not null default 1;

comment on column public.runs.diamonds_earned is 'Diamonds earned from level-up milestones, streak milestones, and completed missions during this run.';
comment on column public.runs.enemy_captured  is 'Number of enemy territories captured during this run.';
comment on column public.runs.pre_run_level   is 'Player level at the start of the run (used for level-up detection).';

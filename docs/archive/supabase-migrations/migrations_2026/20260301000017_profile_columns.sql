-- ============================================================
-- Profile extra columns (consolidated from migrations 017–019, 023, 041)
-- ============================================================
-- bio, location, avatar_color, unlocked_achievements,
-- display_name, strava, instagram, foot_type, foot_scan_at
-- ============================================================

alter table public.profiles
  add column if not exists bio                    text,
  add column if not exists location               text,
  add column if not exists display_name           text,
  add column if not exists strava                 text,
  add column if not exists instagram              text,
  add column if not exists avatar_color           text not null default 'teal',
  add column if not exists unlocked_achievements  text[] not null default '{}',
  add column if not exists foot_type              text,       -- 'flat' | 'neutral' | 'high'
  add column if not exists foot_scan_at           timestamptz;

comment on column public.profiles.bio                   is 'Short user bio (max 150 characters).';
comment on column public.profiles.location              is 'User location string, e.g. "New Delhi, India".';
comment on column public.profiles.avatar_color          is 'Avatar color scheme ID matching AVATAR_COLORS in the frontend.';
comment on column public.profiles.unlocked_achievements is 'Array of achievement IDs the user has unlocked. Merged (union) on pull.';
comment on column public.profiles.foot_type             is 'Foot arch type from foot scan: flat | neutral | high.';
comment on column public.profiles.foot_scan_at          is 'Timestamp when the foot scan was completed.';

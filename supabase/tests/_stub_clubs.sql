-- Stand-ins for the clubs tables (20260301000005_functions_triggers.sql) and
-- profiles.last_known_location (20260515000057_city_rank_rpc.sql).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_known_location geometry(Point, 4326);
CREATE TABLE IF NOT EXISTS public.clubs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text UNIQUE NOT NULL,
  description  text,
  badge_emoji  text NOT NULL DEFAULT '🏃',
  owner_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  join_policy  text NOT NULL DEFAULT 'open',
  member_count int NOT NULL DEFAULT 1,
  total_km     numeric(12,3) NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.club_members (
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role    text NOT NULL DEFAULT 'member',
  PRIMARY KEY (club_id, user_id)
);
GRANT SELECT ON public.clubs, public.club_members TO authenticated;

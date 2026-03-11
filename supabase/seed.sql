-- ============================================================
-- Runivo — Development Seed Data
-- ============================================================
-- Populates realistic data for mehtabafsar346@gmail.com
-- Run with:
--   /opt/homebrew/opt/libpq/bin/psql \
--     "postgresql://..." \
--     -f supabase/seed.sql
--
-- IMPORTANT: Sign up as mehtabafsar346@gmail.com (pw: Moon@123)
-- in the app FIRST so the auth.users row exists.
-- ============================================================

SET session_replication_role = 'replica';   -- skip triggers while seeding

-- ============================================================
-- 0. FIXED UUIDs for seed users (stable across re-runs)
-- ============================================================
DO $$
BEGIN
  -- nothing — just confirm pgcrypto works
  PERFORM crypt('test', gen_salt('bf'));
END;
$$;

-- Mehtab (main user) + companion users
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_user_meta_data, raw_app_meta_data,
  aud, role, is_super_admin, is_sso_user
)
VALUES
  -- Mehtab — fixed UUID so the rest of the seed can reference it
  ('a0000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000',
   'mehtabafsar346@gmail.com',  crypt('Moon@123', gen_salt('bf')), now(), now(), now(),
   '{"username":"mehtabafsar346"}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', false, false),

  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'aria_speed@runivo.app',     crypt('Seed@1234', gen_salt('bf')), now(), now(), now(),
   '{"username":"Aria_Speed"}'::jsonb,   '{}'::jsonb, 'authenticated', 'authenticated', false, false),

  ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'ironkhan@runivo.app',       crypt('Seed@1234', gen_salt('bf')), now(), now(), now(),
   '{"username":"IronKhan"}'::jsonb,     '{}'::jsonb, 'authenticated', 'authenticated', false, false),

  ('a1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'zoey_runs@runivo.app',      crypt('Seed@1234', gen_salt('bf')), now(), now(), now(),
   '{"username":"ZoeyRuns"}'::jsonb,     '{}'::jsonb, 'authenticated', 'authenticated', false, false),

  ('a1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'dev_racer@runivo.app',      crypt('Seed@1234', gen_salt('bf')), now(), now(), now(),
   '{"username":"DevRacer"}'::jsonb,     '{}'::jsonb, 'authenticated', 'authenticated', false, false),

  ('a1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
   'nightrunner99@runivo.app',  crypt('Seed@1234', gen_salt('bf')), now(), now(), now(),
   '{"username":"NightRunner99"}'::jsonb,'{}'::jsonb, 'authenticated', 'authenticated', false, false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 1. PROFILES — companion users
-- ============================================================
INSERT INTO public.profiles (
  id, username,
  level, xp, coins, diamonds, energy,
  total_distance_km, total_runs, total_territories_claimed, streak_days,
  follower_count, following_count,
  experience_level, primary_goal, weekly_goal_km, playstyle, mission_difficulty,
  weekly_frequency, preferred_distance, distance_unit, notifications_enabled,
  age, gender, height_cm, weight_kg,
  bio, location, avatar_color,
  unlocked_achievements,
  last_run_date, onboarding_completed_at
)
VALUES
  -- Aria_Speed — fast competitive female runner, Mumbai
  ('a1000000-0000-0000-0000-000000000001', 'Aria_Speed',
   15, 18400, 3200, 42, 85,
   312.5, 61, 47, 18,
   89, 34,
   'competitive', 'run_faster', 60, 'conqueror', 'hard',
   6, '10k', 'km', true,
   24, 'female', 165, 54.0,
   'Chasing PRs every single morning 🔥 Mumbai speed queen.',
   'Mumbai, India', 'rose',
   ARRAY['first_run','streak_3','streak_7','first_territory','zone_5','zone_10','zone_25','distance_10','distance_50','distance_100','speed_demon'],
   now()::date - 1, now() - interval '90 days'),

  -- IronKhan — high-level experienced, Delhi
  ('a1000000-0000-0000-0000-000000000002', 'IronKhan',
   22, 34100, 7800, 110, 100,
   589.2, 112, 93, 31,
   213, 58,
   'competitive', 'compete', 80, 'conqueror', 'hard',
   7, 'long', 'km', true,
   29, 'male', 178, 72.0,
   'Laps around you while you sleep. Top 3 Delhi all-time.',
   'New Delhi, India', 'indigo',
   ARRAY['first_run','streak_3','streak_7','streak_30','first_territory','zone_5','zone_10','zone_25','zone_50','distance_10','distance_50','distance_100','distance_250','distance_500','iron_legs'],
   now()::date - 1, now() - interval '180 days'),

  -- ZoeyRuns — casual weekend runner, Bangalore
  ('a1000000-0000-0000-0000-000000000003', 'ZoeyRuns',
   5, 2900, 680, 12, 70,
   38.4, 12, 8, 3,
   24, 19,
   'casual', 'get_fit', 20, 'explorer', 'easy',
   3, '5k', 'km', true,
   21, 'female', 162, 58.0,
   'Just started running, loving every km 🌿',
   'Bangalore, India', 'emerald',
   ARRAY['first_run','streak_3','first_territory','distance_10'],
   now()::date - 2, now() - interval '20 days'),

  -- DevRacer — regular runner, Pune
  ('a1000000-0000-0000-0000-000000000004', 'DevRacer',
   10, 9600, 1900, 28, 90,
   163.7, 38, 22, 9,
   67, 45,
   'regular', 'explore', 40, 'explorer', 'mixed',
   4, '10k', 'km', true,
   26, 'male', 172, 68.0,
   'Running + Coding = Life. Weekend warrior.',
   'Pune, India', 'sky',
   ARRAY['first_run','streak_3','streak_7','first_territory','zone_5','zone_10','distance_10','distance_50','distance_100'],
   now()::date - 3, now() - interval '60 days'),

  -- NightRunner99 — casual night runner, Delhi
  ('a1000000-0000-0000-0000-000000000005', 'NightRunner99',
   7, 5200, 1100, 18, 60,
   82.1, 19, 11, 5,
   41, 30,
   'casual', 'explore', 30, 'defender', 'mixed',
   3, '5k', 'km', true,
   23, 'male', 175, 74.0,
   'Only running after midnight. Streets are mine.',
   'New Delhi, India', 'violet',
   ARRAY['first_run','streak_3','first_territory','zone_5','distance_10','distance_50'],
   now()::date - 2, now() - interval '45 days'),

  -- Mehtab — main user (triggers skipped, so insert directly)
  ('a0000000-0000-0000-0000-000000000000', 'mehtabafsar346',
   12, 11800, 2650, 38, 92,
   147.6, 23, 18, 12,
   5, 4,
   'regular', 'compete', 40, 'conqueror', 'mixed',
   5, '10k', 'km', true,
   22, 'male', 176, 70.0,
   'Conquering New Delhi one zone at a time ⚔️ Level 12 and climbing.',
   'New Delhi, India', 'teal',
   ARRAY['first_run','streak_3','streak_7','streak_10','first_territory','zone_5','zone_10','distance_10','distance_50','distance_100','conqueror','speed_demon'],
   now()::date, now() - interval '30 days')

ON CONFLICT (id) DO UPDATE SET
  level = EXCLUDED.level, xp = EXCLUDED.xp,
  coins = EXCLUDED.coins, diamonds = EXCLUDED.diamonds,
  total_distance_km = EXCLUDED.total_distance_km, total_runs = EXCLUDED.total_runs,
  total_territories_claimed = EXCLUDED.total_territories_claimed,
  streak_days = EXCLUDED.streak_days, bio = EXCLUDED.bio,
  follower_count = EXCLUDED.follower_count, following_count = EXCLUDED.following_count,
  location = EXCLUDED.location, avatar_color = EXCLUDED.avatar_color,
  unlocked_achievements = EXCLUDED.unlocked_achievements;

-- (Mehtab's profile is now included in the INSERT above with ON CONFLICT DO UPDATE)

-- ============================================================
-- 3. RUNS — Mehtab's last 10 runs (GPS around Delhi)
-- ============================================================
-- Convenience: get Mehtab's ID once
DO $$
DECLARE
  mid uuid;
  r1 uuid; r2 uuid; r3 uuid; r4 uuid; r5 uuid;
  r6 uuid; r7 uuid; r8 uuid; r9 uuid; r10 uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid; p6 uuid;
  ev1 uuid; ev2 uuid; ev3 uuid;
BEGIN
  -- Use the fixed UUID inserted above; fall back to lookup if someone ran this
  -- seed on a remote DB where Mehtab signed up via the app (different UUID)
  mid := 'a0000000-0000-0000-0000-000000000000';
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = mid) THEN
    SELECT id INTO mid FROM auth.users WHERE email = 'mehtabafsar346@gmail.com';
  END IF;
  IF mid IS NULL THEN
    RAISE NOTICE 'mehtabafsar346@gmail.com not found — skipping run/club data.';
    RETURN;
  END IF;

  r1  := gen_random_uuid();
  r2  := gen_random_uuid();
  r3  := gen_random_uuid();
  r4  := gen_random_uuid();
  r5  := gen_random_uuid();
  r6  := gen_random_uuid();
  r7  := gen_random_uuid();
  r8  := gen_random_uuid();
  r9  := gen_random_uuid();
  r10 := gen_random_uuid();

  -- ----------------------------------------------------------
  -- RUNS
  -- ----------------------------------------------------------
  INSERT INTO public.runs (
    id, user_id, activity_type,
    started_at, finished_at, distance_m, duration_sec, avg_pace,
    gps_points, territories_claimed,
    xp_earned, coins_earned, diamonds_earned, enemy_captured, pre_run_level
  ) VALUES
  -- Run 1: 10.2km India Gate loop (today)
  (r1, mid, 'run',
   now() - interval '2 hours', now() - interval '1 hour 3 min',
   10200, 3780, '6:10',
   '[{"lat":28.6129,"lng":77.2295,"timestamp":1000,"speed":2.8,"accuracy":5},
     {"lat":28.6160,"lng":77.2330,"timestamp":1060,"speed":2.9,"accuracy":5},
     {"lat":28.6200,"lng":77.2350,"timestamp":1120,"speed":3.0,"accuracy":4},
     {"lat":28.6220,"lng":77.2300,"timestamp":1180,"speed":2.8,"accuracy":5},
     {"lat":28.6190,"lng":77.2250,"timestamp":1240,"speed":2.7,"accuracy":6},
     {"lat":28.6150,"lng":77.2220,"timestamp":1300,"speed":2.9,"accuracy":5},
     {"lat":28.6110,"lng":77.2240,"timestamp":1360,"speed":3.1,"accuracy":4},
     {"lat":28.6090,"lng":77.2280,"timestamp":1420,"speed":2.8,"accuracy":5},
     {"lat":28.6129,"lng":77.2295,"timestamp":1480,"speed":2.6,"accuracy":5}]'::jsonb,
   ARRAY['882beac5c3fffff','882beac5c5fffff','882beac5c1fffff'],
   320, 48, 2, 1, 11),

  -- Run 2: 7.5km Lodhi Garden (yesterday)
  (r2, mid, 'run',
   now() - interval '1 day 7 hours', now() - interval '1 day 6 hours 15 min',
   7500, 2700, '6:00',
   '[{"lat":28.5931,"lng":77.2196,"timestamp":2000,"speed":3.1,"accuracy":4},
     {"lat":28.5960,"lng":77.2230,"timestamp":2060,"speed":3.2,"accuracy":4},
     {"lat":28.5990,"lng":77.2200,"timestamp":2120,"speed":3.0,"accuracy":5},
     {"lat":28.5970,"lng":77.2160,"timestamp":2180,"speed":2.9,"accuracy":5},
     {"lat":28.5940,"lng":77.2140,"timestamp":2240,"speed":3.1,"accuracy":4},
     {"lat":28.5910,"lng":77.2170,"timestamp":2300,"speed":3.0,"accuracy":5},
     {"lat":28.5931,"lng":77.2196,"timestamp":2360,"speed":2.8,"accuracy":5}]'::jsonb,
   ARRAY['882beacd19fffff','882beacd1bfffff'],
   240, 36, 1, 0, 11),

  -- Run 3: 12.8km long run, Connaught Place to Rajpath (2 days ago)
  (r3, mid, 'run',
   now() - interval '2 days 6 hours', now() - interval '2 days 4 hours 30 min',
   12800, 5400, '7:03',
   '[{"lat":28.6315,"lng":77.2195,"timestamp":3000,"speed":2.6,"accuracy":5},
     {"lat":28.6280,"lng":77.2220,"timestamp":3080,"speed":2.7,"accuracy":4},
     {"lat":28.6240,"lng":77.2270,"timestamp":3160,"speed":2.8,"accuracy":5},
     {"lat":28.6200,"lng":77.2310,"timestamp":3240,"speed":2.6,"accuracy":6},
     {"lat":28.6160,"lng":77.2330,"timestamp":3320,"speed":2.7,"accuracy":5},
     {"lat":28.6130,"lng":77.2295,"timestamp":3400,"speed":2.9,"accuracy":4},
     {"lat":28.6100,"lng":77.2250,"timestamp":3480,"speed":2.7,"accuracy":5},
     {"lat":28.6140,"lng":77.2200,"timestamp":3560,"speed":2.8,"accuracy":5},
     {"lat":28.6190,"lng":77.2190,"timestamp":3640,"speed":2.6,"accuracy":6},
     {"lat":28.6240,"lng":77.2180,"timestamp":3720,"speed":2.7,"accuracy":5},
     {"lat":28.6290,"lng":77.2185,"timestamp":3800,"speed":2.6,"accuracy":5},
     {"lat":28.6315,"lng":77.2195,"timestamp":3880,"speed":2.5,"accuracy":6}]'::jsonb,
   ARRAY['882beac5c3fffff','882beac5c5fffff','882beac5cbfffff','882beac5c9fffff'],
   450, 62, 3, 2, 11),

  -- Run 4: 5.1km quick tempo (3 days ago)
  (r4, mid, 'run',
   now() - interval '3 days 5 hours', now() - interval '3 days 4 hours 40 min',
   5100, 1440, '4:42',
   '[{"lat":28.6129,"lng":77.2295,"timestamp":4000,"speed":4.0,"accuracy":4},
     {"lat":28.6150,"lng":77.2320,"timestamp":4050,"speed":4.1,"accuracy":4},
     {"lat":28.6170,"lng":77.2300,"timestamp":4100,"speed":4.2,"accuracy":3},
     {"lat":28.6150,"lng":77.2270,"timestamp":4150,"speed":4.0,"accuracy":4},
     {"lat":28.6129,"lng":77.2295,"timestamp":4200,"speed":3.8,"accuracy":4}]'::jsonb,
   ARRAY['882beac5c3fffff'],
   180, 28, 0, 0, 10),

  -- Run 5: 9.3km defend run (4 days ago)
  (r5, mid, 'defend',
   now() - interval '4 days 7 hours', now() - interval '4 days 6 hours 5 min',
   9300, 3900, '7:00',
   '[{"lat":28.6050,"lng":77.2400,"timestamp":5000,"speed":2.5,"accuracy":5},
     {"lat":28.6080,"lng":77.2430,"timestamp":5080,"speed":2.6,"accuracy":5},
     {"lat":28.6110,"lng":77.2460,"timestamp":5160,"speed":2.7,"accuracy":4},
     {"lat":28.6140,"lng":77.2440,"timestamp":5240,"speed":2.5,"accuracy":5},
     {"lat":28.6160,"lng":77.2410,"timestamp":5320,"speed":2.6,"accuracy":5},
     {"lat":28.6140,"lng":77.2380,"timestamp":5400,"speed":2.7,"accuracy":4},
     {"lat":28.6110,"lng":77.2370,"timestamp":5480,"speed":2.5,"accuracy":5},
     {"lat":28.6070,"lng":77.2380,"timestamp":5560,"speed":2.6,"accuracy":5},
     {"lat":28.6050,"lng":77.2400,"timestamp":5640,"speed":2.4,"accuracy":6}]'::jsonb,
   ARRAY['882beac5c1fffff','882beac5c7fffff'],
   290, 42, 1, 0, 10),

  -- Run 6: 15.4km longest run — Old Delhi to Connaught (5 days ago)
  (r6, mid, 'run',
   now() - interval '5 days 5 hours', now() - interval '5 days 3 hours',
   15400, 6600, '7:09',
   '[{"lat":28.6560,"lng":77.2300,"timestamp":6000,"speed":2.5,"accuracy":5},
     {"lat":28.6520,"lng":77.2280,"timestamp":6100,"speed":2.6,"accuracy":4},
     {"lat":28.6480,"lng":77.2260,"timestamp":6200,"speed":2.7,"accuracy":5},
     {"lat":28.6440,"lng":77.2240,"timestamp":6300,"speed":2.6,"accuracy":5},
     {"lat":28.6400,"lng":77.2220,"timestamp":6400,"speed":2.5,"accuracy":6},
     {"lat":28.6360,"lng":77.2200,"timestamp":6500,"speed":2.6,"accuracy":5},
     {"lat":28.6315,"lng":77.2195,"timestamp":6600,"speed":2.7,"accuracy":4},
     {"lat":28.6280,"lng":77.2220,"timestamp":6700,"speed":2.6,"accuracy":5},
     {"lat":28.6240,"lng":77.2240,"timestamp":6800,"speed":2.5,"accuracy":5},
     {"lat":28.6200,"lng":77.2260,"timestamp":6900,"speed":2.6,"accuracy":5},
     {"lat":28.6160,"lng":77.2280,"timestamp":7000,"speed":2.7,"accuracy":4},
     {"lat":28.6129,"lng":77.2295,"timestamp":7100,"speed":2.5,"accuracy":5}]'::jsonb,
   ARRAY['882beac5c3fffff','882beac5c5fffff','882beac589fffff','882beac58bfffff'],
   520, 72, 4, 2, 10),

  -- Run 7: 6.2km attack run (7 days ago)
  (r7, mid, 'attack',
   now() - interval '7 days 6 hours', now() - interval '7 days 5 hours 20 min',
   6200, 2400, '6:27',
   '[{"lat":28.6200,"lng":77.2100,"timestamp":7000,"speed":2.9,"accuracy":5},
     {"lat":28.6230,"lng":77.2130,"timestamp":7060,"speed":3.0,"accuracy":4},
     {"lat":28.6250,"lng":77.2160,"timestamp":7120,"speed":2.8,"accuracy":5},
     {"lat":28.6220,"lng":77.2190,"timestamp":7180,"speed":2.9,"accuracy":5},
     {"lat":28.6190,"lng":77.2160,"timestamp":7240,"speed":3.0,"accuracy":4},
     {"lat":28.6170,"lng":77.2120,"timestamp":7300,"speed":2.8,"accuracy":5},
     {"lat":28.6200,"lng":77.2100,"timestamp":7360,"speed":2.7,"accuracy":5}]'::jsonb,
   ARRAY['882beac5cbfffff','882beac5c9fffff'],
   210, 32, 1, 1, 10),

  -- Run 8: 8.9km Humayun's Tomb area (8 days ago)
  (r8, mid, 'run',
   now() - interval '8 days 7 hours', now() - interval '8 days 6 hours',
   8900, 3540, '6:38',
   '[{"lat":28.5933,"lng":77.2507,"timestamp":8000,"speed":2.7,"accuracy":5},
     {"lat":28.5960,"lng":77.2540,"timestamp":8070,"speed":2.8,"accuracy":4},
     {"lat":28.5990,"lng":77.2560,"timestamp":8140,"speed":2.9,"accuracy":5},
     {"lat":28.6010,"lng":77.2530,"timestamp":8210,"speed":2.7,"accuracy":5},
     {"lat":28.5990,"lng":77.2500,"timestamp":8280,"speed":2.8,"accuracy":4},
     {"lat":28.5960,"lng":77.2480,"timestamp":8350,"speed":2.7,"accuracy":5},
     {"lat":28.5933,"lng":77.2507,"timestamp":8420,"speed":2.6,"accuracy":5}]'::jsonb,
   ARRAY['882beacd03fffff'],
   270, 40, 2, 0, 10),

  -- Run 9: 4.5km easy recovery (10 days ago)
  (r9, mid, 'run',
   now() - interval '10 days 8 hours', now() - interval '10 days 7 hours 35 min',
   4500, 2100, '7:47',
   '[{"lat":28.5931,"lng":77.2196,"timestamp":9000,"speed":2.1,"accuracy":6},
     {"lat":28.5950,"lng":77.2210,"timestamp":9070,"speed":2.2,"accuracy":6},
     {"lat":28.5960,"lng":77.2190,"timestamp":9140,"speed":2.1,"accuracy":7},
     {"lat":28.5940,"lng":77.2175,"timestamp":9210,"speed":2.2,"accuracy":6},
     {"lat":28.5931,"lng":77.2196,"timestamp":9280,"speed":2.0,"accuracy":6}]'::jsonb,
   ARRAY[]::text[],
   130, 20, 0, 0, 9),

  -- Run 10: 11km Nehru Place / Saket area (12 days ago)
  (r10, mid, 'run',
   now() - interval '12 days 6 hours', now() - interval '12 days 4 hours 55 min',
   11000, 4500, '6:49',
   '[{"lat":28.5494,"lng":77.2517,"timestamp":10000,"speed":2.6,"accuracy":5},
     {"lat":28.5520,"lng":77.2550,"timestamp":10090,"speed":2.7,"accuracy":4},
     {"lat":28.5550,"lng":77.2580,"timestamp":10180,"speed":2.8,"accuracy":5},
     {"lat":28.5580,"lng":77.2560,"timestamp":10270,"speed":2.6,"accuracy":5},
     {"lat":28.5590,"lng":77.2520,"timestamp":10360,"speed":2.7,"accuracy":4},
     {"lat":28.5570,"lng":77.2490,"timestamp":10450,"speed":2.6,"accuracy":5},
     {"lat":28.5540,"lng":77.2480,"timestamp":10540,"speed":2.7,"accuracy":5},
     {"lat":28.5510,"lng":77.2500,"timestamp":10630,"speed":2.6,"accuracy":5},
     {"lat":28.5494,"lng":77.2517,"timestamp":10720,"speed":2.5,"accuracy":6}]'::jsonb,
   ARRAY['882beacd79fffff','882beacd7bfffff'],
   360, 52, 2, 1, 9)
  ON CONFLICT (id) DO NOTHING;

  -- ----------------------------------------------------------
  -- A few runs for the companion users (leaderboard variety)
  -- ----------------------------------------------------------
  INSERT INTO public.runs (
    id, user_id, activity_type,
    started_at, finished_at, distance_m, duration_sec, avg_pace,
    gps_points, territories_claimed,
    xp_earned, coins_earned, diamonds_earned, enemy_captured, pre_run_level
  ) VALUES
  -- Aria_Speed — 14km today
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', 'run',
   now() - interval '3 hours', now() - interval '1 hour 15 min',
   14000, 4800, '5:43',
   '[{"lat":19.0760,"lng":72.8777,"timestamp":1000,"speed":3.3,"accuracy":4},
     {"lat":19.0800,"lng":72.8810,"timestamp":1060,"speed":3.4,"accuracy":4},
     {"lat":19.0840,"lng":72.8790,"timestamp":1120,"speed":3.3,"accuracy":4},
     {"lat":19.0800,"lng":72.8750,"timestamp":1180,"speed":3.2,"accuracy":5},
     {"lat":19.0760,"lng":72.8777,"timestamp":1240,"speed":3.1,"accuracy":5}]'::jsonb,
   ARRAY['882b95734bfffff','882b95734dfffff'],
   480, 65, 3, 0, 14),
  -- IronKhan — 18km yesterday
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000002', 'run',
   now() - interval '1 day 4 hours', now() - interval '1 day 1 hour 50 min',
   18000, 6600, '6:07',
   '[{"lat":28.6400,"lng":77.2000,"timestamp":1000,"speed":2.9,"accuracy":4},
     {"lat":28.6450,"lng":77.2050,"timestamp":1100,"speed":3.0,"accuracy":4},
     {"lat":28.6500,"lng":77.2030,"timestamp":1200,"speed":2.9,"accuracy":5},
     {"lat":28.6480,"lng":77.1980,"timestamp":1300,"speed":2.8,"accuracy":5},
     {"lat":28.6400,"lng":77.2000,"timestamp":1400,"speed":2.7,"accuracy":5}]'::jsonb,
   ARRAY['882beac589fffff','882beac58bfffff','882beac5cbfffff'],
   620, 82, 4, 1, 21),
  -- DevRacer — 10km 2 days ago
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000004', 'run',
   now() - interval '2 days 5 hours', now() - interval '2 days 4 hours',
   10000, 3600, '6:00',
   '[{"lat":18.5204,"lng":73.8567,"timestamp":1000,"speed":3.0,"accuracy":4},
     {"lat":18.5240,"lng":73.8600,"timestamp":1060,"speed":3.1,"accuracy":4},
     {"lat":18.5260,"lng":73.8580,"timestamp":1120,"speed":2.9,"accuracy":5},
     {"lat":18.5230,"lng":73.8550,"timestamp":1180,"speed":3.0,"accuracy":5},
     {"lat":18.5204,"lng":73.8567,"timestamp":1240,"speed":2.8,"accuracy":5}]'::jsonb,
   ARRAY['88194ad0b3fffff'],
   340, 48, 2, 0, 9)
  ON CONFLICT (id) DO NOTHING;

  -- ----------------------------------------------------------
  -- TERRITORIES owned by Mehtab
  -- ----------------------------------------------------------
  INSERT INTO public.territories (h3_index, owner_id, owner_name, defense, tier, captured_at)
  VALUES
    ('882beac5c3fffff', mid, 'mehtabafsar346', 78, 'gold',   now() - interval '2 days'),
    ('882beac5c5fffff', mid, 'mehtabafsar346', 65, 'silver', now() - interval '3 days'),
    ('882beac5c1fffff', mid, 'mehtabafsar346', 55, 'bronze', now() - interval '4 days'),
    ('882beac5cbfffff', mid, 'mehtabafsar346', 82, 'gold',   now() - interval '1 day'),
    ('882beac5c9fffff', mid, 'mehtabafsar346', 50, 'bronze', now() - interval '7 days'),
    ('882beacd19fffff', mid, 'mehtabafsar346', 70, 'silver', now() - interval '5 days'),
    ('882beac589fffff', mid, 'mehtabafsar346', 60, 'bronze', now() - interval '5 days')
  ON CONFLICT (h3_index) DO UPDATE
    SET owner_id = EXCLUDED.owner_id, owner_name = EXCLUDED.owner_name,
        defense = EXCLUDED.defense, tier = EXCLUDED.tier;

  -- Some territories owned by rivals
  INSERT INTO public.territories (h3_index, owner_id, owner_name, defense, tier, captured_at)
  VALUES
    ('882beac5c7fffff', 'a1000000-0000-0000-0000-000000000002', 'IronKhan', 90, 'crown', now() - interval '1 day'),
    ('882beacd1bfffff', 'a1000000-0000-0000-0000-000000000002', 'IronKhan', 85, 'gold',  now() - interval '3 days'),
    ('882beacd03fffff', 'a1000000-0000-0000-0000-000000000005', 'NightRunner99', 55, 'bronze', now() - interval '2 days')
  ON CONFLICT (h3_index) DO UPDATE
    SET owner_id = EXCLUDED.owner_id, owner_name = EXCLUDED.owner_name,
        defense = EXCLUDED.defense, tier = EXCLUDED.tier;

  -- ----------------------------------------------------------
  -- FOLLOW GRAPH
  -- ----------------------------------------------------------
  -- Mehtab follows: IronKhan, Aria_Speed, DevRacer, NightRunner99
  INSERT INTO public.followers (follower_id, following_id) VALUES
    (mid, 'a1000000-0000-0000-0000-000000000002'),  -- → IronKhan
    (mid, 'a1000000-0000-0000-0000-000000000001'),  -- → Aria_Speed
    (mid, 'a1000000-0000-0000-0000-000000000004'),  -- → DevRacer
    (mid, 'a1000000-0000-0000-0000-000000000005')   -- → NightRunner99
  ON CONFLICT DO NOTHING;
  -- Followers of Mehtab: all 5 companion users
  INSERT INTO public.followers (follower_id, following_id) VALUES
    ('a1000000-0000-0000-0000-000000000001', mid),  -- Aria_Speed
    ('a1000000-0000-0000-0000-000000000002', mid),  -- IronKhan
    ('a1000000-0000-0000-0000-000000000003', mid),  -- ZoeyRuns
    ('a1000000-0000-0000-0000-000000000004', mid),  -- DevRacer
    ('a1000000-0000-0000-0000-000000000005', mid)   -- NightRunner99
  ON CONFLICT DO NOTHING;
  -- IronKhan and Aria follow each other
  INSERT INTO public.followers (follower_id, following_id) VALUES
    ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002'),
    ('a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001')
  ON CONFLICT DO NOTHING;

  -- ----------------------------------------------------------
  -- CLUBS
  -- ----------------------------------------------------------
  c1 := gen_random_uuid();
  c2 := gen_random_uuid();
  c3 := gen_random_uuid();
  c4 := gen_random_uuid();

  INSERT INTO public.clubs (id, name, description, badge_emoji, owner_id, join_policy, member_count, total_km) VALUES
    (c1, 'Delhi Conquerors',
     'We don''t just run — we own the map. Delhi''s most feared territory squad.',
     '⚔️', mid, 'invite_only', 5, 312.4),
    (c2, 'India Speed League',
     'Top runners from across India. Weekly challenges and territory wars.',
     '🏆', 'a1000000-0000-0000-0000-000000000002', 'open', 4, 893.2),
    (c3, 'Night Owls Delhi',
     'We run when the city sleeps. Midnight to 4AM. Join us.',
     '🦉', 'a1000000-0000-0000-0000-000000000005', 'open', 3, 198.5),
    (c4, 'Casual Striders',
     'No pressure, just fun runs. All paces welcome 🌿',
     '🌿', 'a1000000-0000-0000-0000-000000000003', 'open', 2, 76.8)
  ON CONFLICT (name) DO NOTHING;

  -- Club members
  INSERT INTO public.club_members (club_id, user_id, role, joined_at) VALUES
    -- Delhi Conquerors (Mehtab owns)
    (c1, mid,                                          'owner',  now() - interval '25 days'),
    (c1, 'a1000000-0000-0000-0000-000000000002', 'admin',  now() - interval '20 days'),
    (c1, 'a1000000-0000-0000-0000-000000000004', 'member', now() - interval '15 days'),
    (c1, 'a1000000-0000-0000-0000-000000000001', 'member', now() - interval '10 days'),
    (c1, 'a1000000-0000-0000-0000-000000000005', 'member', now() - interval '5 days'),
    -- India Speed League (Mehtab is member)
    (c2, 'a1000000-0000-0000-0000-000000000002', 'owner',  now() - interval '60 days'),
    (c2, 'a1000000-0000-0000-0000-000000000001', 'admin',  now() - interval '55 days'),
    (c2, mid,                                          'member', now() - interval '18 days'),
    (c2, 'a1000000-0000-0000-0000-000000000004', 'member', now() - interval '12 days'),
    -- Night Owls
    (c3, 'a1000000-0000-0000-0000-000000000005', 'owner',  now() - interval '30 days'),
    (c3, mid,                                          'member', now() - interval '14 days'),
    (c3, 'a1000000-0000-0000-0000-000000000003', 'member', now() - interval '7 days'),
    -- Casual Striders
    (c4, 'a1000000-0000-0000-0000-000000000003', 'owner',  now() - interval '15 days'),
    (c4, 'a1000000-0000-0000-0000-000000000004', 'member', now() - interval '8 days')
  ON CONFLICT DO NOTHING;

  -- Club messages in Delhi Conquerors
  INSERT INTO public.club_messages (club_id, user_id, content, created_at) VALUES
    (c1, 'a1000000-0000-0000-0000-000000000002', '3 new zones captured near India Gate today 🗺️ Who else was out there?', now() - interval '3 hours 40 min'),
    (c1, mid,                                     'Me! Did the full loop — 10.2km, grabbed 3 zones. IronKhan was already there lol', now() - interval '3 hours 20 min'),
    (c1, 'a1000000-0000-0000-0000-000000000001', 'Nice work boys. Mumbai squad coming to Delhi next week, watch your zones 😈', now() - interval '2 hours 50 min'),
    (c1, 'a1000000-0000-0000-0000-000000000004', 'Haha Delhi is ready. Our defenses are at 78+ on all gold zones', now() - interval '2 hours 30 min'),
    (c1, mid,                                     'Territory war this weekend? Let''s push into sector 7 together', now() - interval '2 hours 10 min'),
    (c1, 'a1000000-0000-0000-0000-000000000002', '100% in. I''ll anchor the crown zone. You take the flanks', now() - interval '1 hour 50 min'),
    (c1, 'a1000000-0000-0000-0000-000000000005', 'Just woke up, catching up on this chat lol. I''m in for the weekend war', now() - interval '45 min'),
    (c1, mid,                                     'Let''s go 🔥 Meeting at India Gate 6AM Saturday', now() - interval '20 min');

  -- Messages in India Speed League
  INSERT INTO public.club_messages (club_id, user_id, content, created_at) VALUES
    (c2, 'a1000000-0000-0000-0000-000000000002', 'Weekly XP challenge: 5000 XP by Sunday. Top scorer gets a shoutout 🏆', now() - interval '1 day 2 hours'),
    (c2, 'a1000000-0000-0000-0000-000000000001', 'Already at 2400 XP. Let''s go 💨', now() - interval '1 day 1 hour'),
    (c2, mid,                                     '1560 XP here. Will hit 3000 by tonight.', now() - interval '22 hours'),
    (c2, 'a1000000-0000-0000-0000-000000000004', 'Nice! I''m at 980. Going for a 10k run now', now() - interval '20 hours');

  -- ----------------------------------------------------------
  -- FEED POSTS
  -- ----------------------------------------------------------
  p1 := gen_random_uuid();
  p2 := gen_random_uuid();
  p3 := gen_random_uuid();
  p4 := gen_random_uuid();
  p5 := gen_random_uuid();
  p6 := gen_random_uuid();

  INSERT INTO public.feed_posts (id, user_id, run_id, content, distance_km, territories_claimed, likes, comment_count, created_at) VALUES
    (p1, mid,  r1, 'India Gate loop done ✅ 10.2km, grabbed 3 new zones. The city is mine 🗺️ #Delhi #Runivo', 10.2, 3, 18, 4, now() - interval '1 hour 30 min'),
    (p2, mid,  r2, 'Early morning Lodhi Garden 🌿 7.5km easy pace. Zone defence holding strong.', 7.5, 2, 12, 2, now() - interval '1 day 5 hours'),
    (p3, mid,  r3, 'Longest run this month 💪 12.8km from CP to Rajpath. 4 territories claimed, 2 taken from rivals.', 12.8, 4, 24, 6, now() - interval '2 days 3 hours'),
    (p4, 'a1000000-0000-0000-0000-000000000002', NULL, '18km this morning. Delhi is too small for me. Expanding into sector 12. 👑 #IronKhan #Territory', 18.0, 3, 31, 7, now() - interval '1 day 2 hours'),
    (p5, 'a1000000-0000-0000-0000-000000000001', NULL, 'Mumbai mode: activated 🔥 14km sub-6min pace. Zones loading... #SpeedQueen', 14.0, 2, 27, 5, now() - interval '2 hours'),
    (p6, 'a1000000-0000-0000-0000-000000000003', NULL, 'First 5km done!! Legs feel like jelly but I love it 😅 #NewRunner #ZoeyRuns', 5.0, 1, 14, 3, now() - interval '2 days 8 hours')
  ON CONFLICT (id) DO NOTHING;

  -- Likes (set directly since toggle_like uses auth.uid())
  INSERT INTO public.feed_post_likes (post_id, user_id, created_at) VALUES
    (p1, 'a1000000-0000-0000-0000-000000000002', now() - interval '1 hour'),
    (p1, 'a1000000-0000-0000-0000-000000000001', now() - interval '55 min'),
    (p1, 'a1000000-0000-0000-0000-000000000004', now() - interval '45 min'),
    (p2, 'a1000000-0000-0000-0000-000000000005', now() - interval '23 hours'),
    (p3, 'a1000000-0000-0000-0000-000000000002', now() - interval '2 days 1 hour'),
    (p3, 'a1000000-0000-0000-0000-000000000001', now() - interval '2 days'),
    (p4, mid,                                     now() - interval '1 day 1 hour'),
    (p4, 'a1000000-0000-0000-0000-000000000001', now() - interval '1 day'),
    (p5, mid,                                     now() - interval '90 min'),
    (p5, 'a1000000-0000-0000-0000-000000000004', now() - interval '80 min')
  ON CONFLICT DO NOTHING;

  -- Comments
  INSERT INTO public.feed_post_comments (post_id, user_id, content, created_at) VALUES
    (p1, 'a1000000-0000-0000-0000-000000000002', 'Watch out mehtab, I''m taking those back tonight 😤', now() - interval '1 hour 20 min'),
    (p1, 'a1000000-0000-0000-0000-000000000001', 'Clean route! I do the same loop in Mumbai vibes 🔥', now() - interval '1 hour'),
    (p1, 'a1000000-0000-0000-0000-000000000004', 'Drop the zone defense strat!', now() - interval '50 min'),
    (p1, mid,                                     'Defense at 78+ on all gold zones. Try me IronKhan 💪', now() - interval '40 min'),
    (p3, 'a1000000-0000-0000-0000-000000000002', 'Solid distance. Your stamina is leveling up fast.', now() - interval '2 days'),
    (p3, 'a1000000-0000-0000-0000-000000000001', '12.8km no cap 🔥', now() - interval '1 day 23 hours'),
    (p4, mid,                                     'Delhi always has someone ready to defend 😤', now() - interval '1 day')
  ON CONFLICT DO NOTHING;

  -- ----------------------------------------------------------
  -- EVENTS
  -- ----------------------------------------------------------
  ev1 := gen_random_uuid();
  ev2 := gen_random_uuid();
  ev3 := gen_random_uuid();

  INSERT INTO public.events (id, title, description, event_type, starts_at, ends_at, location_name, distance_m, participant_count, xp_multiplier, is_active) VALUES
    (ev1, 'Delhi Territory War — Week 3',
     'All Delhi runners: claim as many zones as possible within 48 hours. XP multiplier active. Top 3 get a diamond drop.',
     'territory-war',
     now() + interval '2 days',
     now() + interval '4 days',
     'India Gate, New Delhi', NULL, 47, 2.0, true),

    (ev2, '10K Community Run — Lodhi Garden',
     'Free group run every Sunday morning. All paces welcome. Meet at the main gate.',
     'community-run',
     now() + interval '5 days',
     now() + interval '5 days 2 hours',
     'Lodhi Garden, New Delhi', 10000, 23, 1.5, true),

    (ev3, 'India Speed League — Sprint Challenge',
     'Fastest 5km wins. Must be GPS tracked. Register by Friday.',
     'race',
     now() + interval '8 days',
     now() + interval '8 days 3 hours',
     'Connaught Place, New Delhi', 5000, 15, 1.8, true)
  ON CONFLICT (id) DO NOTHING;

  -- Event participants
  INSERT INTO public.event_participants (event_id, user_id) VALUES
    (ev1, mid),
    (ev1, 'a1000000-0000-0000-0000-000000000002'),
    (ev1, 'a1000000-0000-0000-0000-000000000001'),
    (ev1, 'a1000000-0000-0000-0000-000000000004'),
    (ev2, mid),
    (ev2, 'a1000000-0000-0000-0000-000000000003'),
    (ev2, 'a1000000-0000-0000-0000-000000000005'),
    (ev3, 'a1000000-0000-0000-0000-000000000001'),
    (ev3, 'a1000000-0000-0000-0000-000000000002'),
    (ev3, mid)
  ON CONFLICT DO NOTHING;

  -- ----------------------------------------------------------
  -- NOTIFICATIONS for Mehtab
  -- ----------------------------------------------------------
  INSERT INTO public.notifications (user_id, type, title, body, read, action_url) VALUES
    (mid, 'kudos',            'IronKhan liked your post',       '10.2km India Gate loop 👍', false, '/feed'),
    (mid, 'kudos',            'Aria_Speed liked your post',     'Nice route through CP! 🔥',  false, '/feed'),
    (mid, 'territory_claimed','Zone captured!',                  'You claimed 882beac5c3fffff near India Gate.', true, '/territory-map'),
    (mid, 'territory_lost',   'Zone under attack!',             'IronKhan is attacking your zone 882beac5c5fffff', false, '/territory-map'),
    (mid, 'club_join',        'NightRunner99 joined your club',  'NightRunner99 joined Delhi Conquerors.', false, '/club'),
    (mid, 'streak',           '12-day streak! 🔥',              'You''re on fire. Keep it up!',            false, '/profile'),
    (mid, 'event_reminder',   'Delhi Territory War starts in 2 days', 'Get ready to conquer!',             false, '/events'),
    (mid, 'system',           'Level 12 reached!',              'You unlocked the Conqueror badge 🏆',     true, '/profile')
  ON CONFLICT DO NOTHING;

  -- ----------------------------------------------------------
  -- MISSION PROGRESS — a few completed daily missions
  -- ----------------------------------------------------------
  INSERT INTO public.mission_progress (id, user_id, mission_type, current_value, completed, claimed, expires_at) VALUES
    ('daily-2026-3-11-0', mid, 'distance',   5.0,  true,  true,  now() + interval '8 hours'),
    ('daily-2026-3-11-1', mid, 'territories', 3.0, true,  true,  now() + interval '8 hours'),
    ('daily-2026-3-11-2', mid, 'duration',  45.0,  false, false, now() + interval '8 hours')
  ON CONFLICT (id, user_id) DO UPDATE
    SET current_value = EXCLUDED.current_value,
        completed = EXCLUDED.completed,
        claimed = EXCLUDED.claimed;

  RAISE NOTICE '✅ Seed complete for mehtabafsar346@gmail.com (id: %)', mid;
END;
$$;

-- Restore normal trigger behaviour
SET session_replication_role = 'origin';

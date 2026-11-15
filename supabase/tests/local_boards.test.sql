-- City and neighbourhood boards (20261113000007).
\set ON_ERROR_STOP on
BEGIN;
-- These runs stand in for runs the server has scored: in production
-- process-run-territory writes verified_distance_m (20261115000021).
CREATE FUNCTION pg_temp.as_scored() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.verified_distance_m := COALESCE(NEW.verified_distance_m, NEW.distance_m); RETURN NEW; END $$;
CREATE TRIGGER runs_z_test_scored BEFORE INSERT ON public.runs FOR EACH ROW EXECUTE FUNCTION pg_temp.as_scored();

CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('test.uid', u::text, true), set_config('test.role', 'authenticated', true) $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('e7100000-0000-4000-8000-000000000001', 'lb-me@example.com'), ('e7200000-0000-4000-8000-000000000002', 'lb-street@example.com'),
  ('e7300000-0000-4000-8000-000000000003', 'lb-town@example.com'), ('e7400000-0000-4000-8000-000000000004', 'lb-far@example.com'),
  ('e7500000-0000-4000-8000-000000000005', 'lb-muted@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES
  ('e7100000-0000-4000-8000-000000000001', 'lb_me'), ('e7200000-0000-4000-8000-000000000002', 'lb_street'),
  ('e7300000-0000-4000-8000-000000000003', 'lb_town'), ('e7400000-0000-4000-8000-000000000004', 'lb_far'),
  ('e7500000-0000-4000-8000-000000000005', 'lb_muted')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;
-- Me at Indiranagar; street 1 km away; town 6 km away; far in another city; muted next door.
UPDATE public.profiles SET last_known_location = ST_SetSRID(ST_MakePoint(77.6408, 12.9784), 4326) WHERE id IN ('e7100000-0000-4000-8000-000000000001', 'e7500000-0000-4000-8000-000000000005');
UPDATE public.profiles SET last_known_location = ST_SetSRID(ST_MakePoint(77.6408, 12.9874), 4326) WHERE id = 'e7200000-0000-4000-8000-000000000002';
UPDATE public.profiles SET last_known_location = ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326) WHERE id = 'e7300000-0000-4000-8000-000000000003';
UPDATE public.profiles SET last_known_location = ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326) WHERE id = 'e7400000-0000-4000-8000-000000000004';
INSERT INTO public.user_mutes (muter_id, muted_id) VALUES ('e7100000-0000-4000-8000-000000000001', 'e7500000-0000-4000-8000-000000000005');
INSERT INTO public.runs (user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace)
SELECT u, 'run', now() - interval '3 hours', now() - interval '2 hours', km * 1000, 3600, '6:00'
  FROM (VALUES ('e7100000-0000-4000-8000-000000000001'::uuid, 5), ('e7200000-0000-4000-8000-000000000002'::uuid, 8),
               ('e7300000-0000-4000-8000-000000000003'::uuid, 9), ('e7400000-0000-4000-8000-000000000004'::uuid, 9.5),
               ('e7500000-0000-4000-8000-000000000005'::uuid, 7)) t(u, km);

SELECT pg_temp.as_user('e7100000-0000-4000-8000-000000000001');
SELECT pg_temp.check((SELECT array_agg(username ORDER BY rank) FROM public.get_local_leaderboard('distance', 'week', 2)) = ARRAY['lb_street', 'lb_me'],
  'neighbourhood (2 km): runners close by, muted left out');
SELECT pg_temp.check((SELECT array_agg(username ORDER BY rank) FROM public.get_local_leaderboard('distance', 'week', 10)) = ARRAY['lb_town', 'lb_street', 'lb_me'],
  'city (10 km): wider, not other cities');
RESET test.uid;
UPDATE public.profiles SET last_known_location = NULL WHERE id = 'e7100000-0000-4000-8000-000000000001';
SELECT pg_temp.as_user('e7100000-0000-4000-8000-000000000001');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.get_local_leaderboard('distance', 'week', 10)), 'no location: no local board');
ROLLBACK;

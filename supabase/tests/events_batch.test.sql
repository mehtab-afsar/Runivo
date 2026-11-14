-- Bookmarks, pace groups, check-in, results, territory events (20261113000015).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('test.uid', u::text, true), set_config('test.role', 'authenticated', true) $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('f1000000-0000-4000-8000-000000000001', 'eb-a@example.com'), ('f2000000-0000-4000-8000-000000000002', 'eb-b@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES
  ('f1000000-0000-4000-8000-000000000001', 'eba'), ('f2000000-0000-4000-8000-000000000002', 'ebb')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.events (id, title, event_type, starts_at, ends_at, lat, lng, location, source, is_active, pace_groups) VALUES
  ('f3000000-0000-4000-8000-0000000000e1', 'Park run', 'community-run', now() - interval '3 hours', now() - interval '1 hour', 12.97, 77.60,
   ST_SetSRID(ST_MakePoint(77.60, 12.97), 4326), 'hosted', true, ARRAY['5:00', '6:00']),
  ('f3000000-0000-4000-8000-0000000000e2', 'Now run', 'community-run', now() + interval '20 minutes', now() + interval '2 hours', 12.97, 77.60,
   ST_SetSRID(ST_MakePoint(77.60, 12.97), 4326), 'hosted', true, ARRAY['6:00']);
INSERT INTO public.event_participants (event_id, user_id) VALUES
  ('f3000000-0000-4000-8000-0000000000e2', 'f1000000-0000-4000-8000-000000000001');
INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points) VALUES
  ('f4000000-0000-4000-8000-0000000000a1', 'f1000000-0000-4000-8000-000000000001', 'run', now() - interval '170 minutes', now() - interval '140 minutes', 5000, 1800, '6:00',
   (SELECT jsonb_agg(jsonb_build_object('lat', 12.9702 + i * 0.0009, 'lng', 77.6001, 'timestamp', (extract(epoch from now() - interval '170 minutes') * 1000)::bigint + i * 15000) ORDER BY i) FROM generate_series(0, 40) i));

SELECT pg_temp.as_user('f1000000-0000-4000-8000-000000000001');
-- E5
INSERT INTO event_bookmarks (user_id, event_id) VALUES ('f1000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-0000000000e1');
SELECT pg_temp.check((SELECT count(*) FROM event_bookmarks) = 1, 'bookmark saved');
-- E3
SELECT set_event_pace_group('f3000000-0000-4000-8000-0000000000e2', '6:00');
SELECT set_event_pace_group('f3000000-0000-4000-8000-0000000000e2', '4:00');
SELECT pg_temp.check((SELECT pace_group FROM event_attendees('f3000000-0000-4000-8000-0000000000e2')) = '6:00', 'pace group kept; unknown group refused');
SELECT pg_temp.check(NOT check_in_event('f3000000-0000-4000-8000-0000000000e2', 12.99, 77.60), 'too far to check in');
SELECT pg_temp.check(check_in_event('f3000000-0000-4000-8000-0000000000e2', 12.9701, 77.6001), 'checked in at the start');
SELECT pg_temp.check((SELECT arrived FROM event_attendees('f3000000-0000-4000-8000-0000000000e2')), 'shows as arrived');
-- E4
SELECT pg_temp.check((SELECT count(*) FROM event_result('f3000000-0000-4000-8000-0000000000e1')) = 1, 'the run near the start is in the result');
SELECT pg_temp.check(claim_event_finish('f3000000-0000-4000-8000-0000000000e1'), 'finisher badge claimed');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM user_awards WHERE user_id = 'f1000000-0000-4000-8000-000000000001' AND award_id = 'event_finisher'), 'award granted');
SELECT pg_temp.as_user('f2000000-0000-4000-8000-000000000002');
SELECT pg_temp.check(NOT claim_event_finish('f3000000-0000-4000-8000-0000000000e1'), 'non-finisher cannot claim');
-- E6
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO public.events (title, event_type, starts_at, ends_at, lat, lng, location, source, is_active, radius_m) VALUES
  ('Hold the park', 'territory-war', now() - interval '10 minutes', now() + interval '50 minutes', 12.97, 77.60, ST_SetSRID(ST_MakePoint(77.60, 12.97), 4326), 'hosted', true, 800);
SELECT pg_temp.check(territory_event_multiplier('f1000000-0000-4000-8000-000000000001', now(), 12.971, 77.601) = 2, 'double inside the area');
SELECT pg_temp.check(territory_event_multiplier('f1000000-0000-4000-8000-000000000001', now(), 13.10, 77.601) = 1, 'normal outside');
ROLLBACK;

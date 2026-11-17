-- Clubs near you: approximate club points, nearest-first, popular fallback,
-- no coordinates or creator locations reachable by clients.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = notice;

CREATE OR REPLACE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF;
  RAISE NOTICE 'ok  %', what;
END $$;

-- Bengaluru: owners near Cubbon Park, Indiranagar (≈4.5 km east) and Mysuru (≈130 km).
INSERT INTO auth.users (id, email) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'v1-d1000000-0@example.com'),
  ('d1000000-0000-0000-0000-000000000002', 'v1-d1000000-1@example.com'),
  ('d1000000-0000-0000-0000-000000000003', 'v1-d1000000-2@example.com'),
  ('d1000000-0000-0000-0000-000000000004', 'v1-d1000000-3@example.com'),
  ('d1000000-0000-0000-0000-000000000005', 'v1-d1000000-4@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO profiles (id, username, last_known_location) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'cubbon_owner', ST_SetSRID(ST_MakePoint(77.592345, 12.976789), 4326)),
  ('d1000000-0000-0000-0000-000000000002', 'indira_owner', ST_SetSRID(ST_MakePoint(77.6408, 12.9784), 4326)),
  ('d1000000-0000-0000-0000-000000000003', 'mysuru_owner', ST_SetSRID(ST_MakePoint(76.6394, 12.2958), 4326)),
  ('d1000000-0000-0000-0000-000000000004', 'no_loc_owner', NULL),
  ('d1000000-0000-0000-0000-000000000005', 'cubbon_runner', NULL)
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, last_known_location = EXCLUDED.last_known_location;

INSERT INTO clubs (id, name, owner_id, member_count, created_at) VALUES
  ('d2000000-0000-0000-0000-000000000001', 'Cubbon Dawn Runners', 'd1000000-0000-0000-0000-000000000001', 40, now() - interval '3 days'),
  ('d2000000-0000-0000-0000-000000000002', 'Indiranagar Striders', 'd1000000-0000-0000-0000-000000000002', 12, now() - interval '2 days'),
  ('d2000000-0000-0000-0000-000000000003', 'Mysuru Milers',        'd1000000-0000-0000-0000-000000000003', 90, now() - interval '1 day'),
  ('d2000000-0000-0000-0000-000000000004', 'Somewhere Club',       'd1000000-0000-0000-0000-000000000004', 5,  now());
INSERT INTO club_members (club_id, user_id) VALUES ('d2000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000005');

SELECT pg_temp.check((SELECT count(*) FROM club_locations) = 3, 'new clubs get a point from their creator; no location, no point');
SELECT pg_temp.check(
  ST_X(home_location::geometry) = 77.592 AND ST_Y(home_location::geometry) = 12.977,
  'the creator''s location is snapped to a ~100 m grid before it is stored')
FROM club_locations WHERE club_id = 'd2000000-0000-0000-0000-000000000001';

-- A runner at Cubbon Park.
SELECT set_config('test.uid', 'd1000000-0000-0000-0000-000000000005', false);
SELECT pg_temp.check(
  (SELECT array_agg(name ORDER BY distance_km) FROM clubs_near(12.9763, 77.5929)) = ARRAY['Cubbon Dawn Runners', 'Indiranagar Striders'],
  'within 15 km, nearest first; Mysuru (130 km) and the club with no point are left out');
SELECT pg_temp.check(
  bool_and(nearby) AND bool_and(distance_km = round(distance_km, 1)),
  'nearby rows say so, and distance is rounded to 0.1 km')
FROM clubs_near(12.9763, 77.5929);
SELECT pg_temp.check(
  (SELECT distance_km FROM clubs_near(12.9763, 77.5929) WHERE name = 'Indiranagar Striders') BETWEEN 4.5 AND 5.5,
  'Indiranagar is about 5 km from Cubbon Park');
SELECT pg_temp.check(
  (SELECT joined FROM clubs_near(12.9763, 77.5929) WHERE name = 'Indiranagar Striders')
  AND NOT (SELECT joined FROM clubs_near(12.9763, 77.5929) WHERE name = 'Cubbon Dawn Runners'),
  'joined reflects the caller''s memberships');
SELECT pg_temp.check((SELECT count(*) FROM clubs_near(12.9763, 77.5929, 2)) = 1, 'a 2 km radius keeps only Cubbon');
SELECT pg_temp.check((SELECT count(*) FROM clubs_near(12.9763, 77.5929, 5000)) = 2
                     AND NOT EXISTS (SELECT 1 FROM clubs_near(12.9763, 77.5929, 5000) WHERE name = 'Mysuru Milers'),
  'a huge radius is capped at 50 km, so Mysuru (130 km) never shows as nearby');
SELECT pg_temp.check((SELECT count(*) FROM clubs_near(12.9763, 77.5929, 15, 1)) = 1, 'limit is honoured');

-- No location, or nothing nearby: most popular clubs, nearby = false, no distance.
SELECT pg_temp.check(
  -- Other clubs may exist in a shared database: compare this suite's own, in order.
  (SELECT array_agg(name) FROM clubs_near(NULL, NULL) WHERE name IN ('Mysuru Milers', 'Cubbon Dawn Runners', 'Indiranagar Striders', 'Somewhere Club')) = ARRAY['Mysuru Milers', 'Cubbon Dawn Runners', 'Indiranagar Striders', 'Somewhere Club'],
  'no location: the most popular clubs');
SELECT pg_temp.check(bool_and(NOT nearby) AND bool_and(distance_km IS NULL), 'fallback rows carry no distance')
FROM clubs_near(NULL, NULL);
SELECT pg_temp.check((SELECT bool_and(NOT nearby) FROM clubs_near(51.5, -0.12)), 'nothing within range (London): popular fallback');
SELECT pg_temp.check((SELECT count(*) FROM clubs_near(999, 999) WHERE name IN ('Mysuru Milers', 'Cubbon Dawn Runners', 'Indiranagar Striders', 'Somewhere Club')) = 4, 'nonsense coordinates fall back instead of erroring');

-- Owner moves the club to a public meeting point; others can't.
SELECT set_config('test.uid', 'd1000000-0000-0000-0000-000000000005', false);
SELECT pg_temp.check(NOT set_club_location('d2000000-0000-0000-0000-000000000004', 12.97, 77.59, 'Bengaluru'),
  'only the owner can set a club''s location');
SELECT set_config('test.uid', 'd1000000-0000-0000-0000-000000000004', false);
SELECT pg_temp.check(set_club_location('d2000000-0000-0000-0000-000000000004', 12.97123, 77.59456, 'Bengaluru'),
  'the owner can set a meeting point');
SELECT pg_temp.check(source = 'owner_set' AND city = 'Bengaluru' AND ST_X(home_location::geometry) = 77.595,
  'the meeting point is stored snapped, with its city')
FROM club_locations WHERE club_id = 'd2000000-0000-0000-0000-000000000004';
SELECT pg_temp.check(NOT set_club_location('d2000000-0000-0000-0000-000000000004', 120, 77.59),
  'out-of-range coordinates are refused');

-- Clients can't read club_locations, and clubs_near returns no coordinates.
SELECT pg_temp.check(NOT has_table_privilege('authenticated', 'public.club_locations', 'SELECT'),
  'signed-in clients cannot select club_locations');
SELECT pg_temp.check(NOT has_function_privilege('anon', 'public.clubs_near(float8, float8, float8, int)', 'EXECUTE'),
  'anonymous callers cannot list clubs by location');
SELECT pg_temp.check(NOT EXISTS (
  SELECT 1 FROM information_schema.routines r
  JOIN information_schema.parameters p ON p.specific_name = r.specific_name
  WHERE r.routine_name = 'clubs_near' AND p.parameter_mode IN ('OUT', 'INOUT') AND p.data_type IN ('USER-DEFINED', 'geography', 'geometry')),
  'clubs_near returns no geometry columns');

SELECT 'ALL CLUBS NEAR CHECKS PASSED' AS result;
ROLLBACK;

-- Distance missions count only server-verified distance (migration 20261115000018).
-- Run from the repo root. Stands alone: builds the few tables the function reads, then swaps in the migration's function.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;

CREATE TEMP TABLE _u AS SELECT '00000000-0000-0000-0000-0000000000a1'::uuid AS id;
-- Created in public inside this transaction (rolled back at the end).
CREATE TABLE runs (id uuid PRIMARY KEY, user_id uuid, started_at timestamptz, distance_m numeric, excluded boolean NOT NULL DEFAULT false, integrity_status text NOT NULL DEFAULT 'ok');
CREATE TABLE run_processing (run_id uuid PRIMARY KEY, result jsonb);
CREATE TABLE territory_polygons (owner_id uuid, claimed_at timestamptz);
CREATE FUNCTION nutrition_streak_days(uuid) RETURNS int LANGUAGE sql AS 'select 0';
\i supabase/archive/migrations_2026/20261115000018_mission_verified_distance.sql

-- A client-written run claiming 9 km, never processed by the server.
INSERT INTO runs VALUES ('00000000-0000-0000-0000-0000000000b1', (SELECT id FROM _u), now(), 9000);
SELECT pg_temp.check(NOT mission_completed_today((SELECT id FROM _u), 'Long Haul'), 'an unprocessed run (fabricated distance) completes nothing');

-- The server measured only 500 m of it.
INSERT INTO run_processing VALUES ('00000000-0000-0000-0000-0000000000b1', '{"verifiedDistanceKm": 0.5}');
SELECT pg_temp.check(NOT mission_completed_today((SELECT id FROM _u), 'Morning Miles'), 'the verified 500 m, not the claimed 9 km, is what counts');

-- A real, verified 3.2 km run.
INSERT INTO runs VALUES ('00000000-0000-0000-0000-0000000000b2', (SELECT id FROM _u), now(), 3200);
INSERT INTO run_processing VALUES ('00000000-0000-0000-0000-0000000000b2', '{"verifiedDistanceKm": 3.2}');
SELECT pg_temp.check(mission_completed_today((SELECT id FROM _u), 'Push Further'), 'verified distance completes a 3 km mission');
SELECT pg_temp.check(NOT mission_completed_today((SELECT id FROM _u), 'Endurance Test'), 'but not a 5 km one');

-- A mock-location run is "flagged": worth nothing.
INSERT INTO runs VALUES ('00000000-0000-0000-0000-0000000000b3', (SELECT id FROM _u), now(), 20000);
INSERT INTO run_processing VALUES ('00000000-0000-0000-0000-0000000000b3', '{"verifiedDistanceKm": 0, "flagged": "mock_location"}');
SELECT pg_temp.check(NOT mission_completed_today((SELECT id FROM _u), 'Long Haul'), 'a flagged (mock location) run adds nothing');

-- A run the integrity check flagged or the runner excluded does not count.
UPDATE runs SET integrity_status = 'flagged' WHERE id = '00000000-0000-0000-0000-0000000000b2';
SELECT pg_temp.check(NOT mission_completed_today((SELECT id FROM _u), 'Push Further'), 'an integrity-flagged run no longer counts');
ROLLBACK;

-- City runner count (20261117000001): aggregate only, floor of 50, rounded to 10s, cached.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
SET LOCAL runivo.trusted_writer = 'on';
DELETE FROM public.city_runner_counts;

-- 57 runners with a recent run starting in Bengaluru, 3 more in Mumbai.
INSERT INTO auth.users (id, email)
  SELECT ('c5000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'r' || g || '@example.com' FROM generate_series(1, 60) g
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username)
  SELECT ('c5000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'cityrunner' || g FROM generate_series(1, 60) g
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.runs (user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points, route)
  SELECT ('c5000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'run', now() - interval '1 day', now() - interval '23 hours',
         5000, 1800, '6:00', '[]'::jsonb,
         CASE WHEN g <= 57
           THEN ST_SetSRID(ST_MakeLine(ST_MakePoint(77.60, 12.97), ST_MakePoint(77.61, 12.98)), 4326)
           ELSE ST_SetSRID(ST_MakeLine(ST_MakePoint(72.88, 19.07), ST_MakePoint(72.89, 19.08)), 4326) END
    FROM generate_series(1, 60) g;

SELECT pg_temp.check((SELECT runners FROM public.city_runner_count(12.97, 77.60)) = 50, 'Bengaluru: 57 runners shows as 50 (rounded down to 10s)');
SELECT pg_temp.check((SELECT city FROM public.city_runner_count(12.97, 77.60)) = 'Bengaluru', 'location picks the city');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.city_runner_count(19.07, 72.88)), 'Mumbai: 3 runners is under the floor, nothing returned');
SELECT pg_temp.check((SELECT city FROM public.city_runner_count()) = 'Bengaluru', 'no location: busiest city');
SELECT pg_temp.check((SELECT computed_at > now() - interval '1 minute' FROM public.city_runner_counts WHERE city = 'Bengaluru'), 'count is cached');
SELECT pg_temp.check(NOT has_table_privilege('anon', 'public.city_runner_counts', 'SELECT'), 'cache table is not readable by the public');
SELECT pg_temp.check(has_function_privilege('anon', 'public.city_runner_count(double precision, double precision)', 'EXECUTE'), 'welcome screen (signed out) can call it');
ROLLBACK;

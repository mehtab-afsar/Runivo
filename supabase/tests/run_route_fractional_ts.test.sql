-- A run whose GPS fixes carry fractional millisecond times (iOS) uploads, and its
-- route is built in time order (20261118000015).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES ('f1500000-0000-4000-8000-000000000001', 'frac@example.com') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES ('f1500000-0000-4000-8000-000000000001', 'frac_ts')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;

INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points)
VALUES ('f1500000-0000-4000-8000-0000000000a1', 'f1500000-0000-4000-8000-000000000001', 'run',
  now() - interval '10 minutes', now(), 300, 120, '6:40',
  '[{"lat":12.9700,"lng":77.5900,"timestamp":1795015014321.3967},
    {"lat":12.9710,"lng":77.5910,"timestamp":1795015016321.5},
    {"lat":12.9705,"lng":77.5905,"timestamp":1795015015321.25}]'::jsonb);

SELECT pg_temp.check((SELECT route IS NOT NULL FROM runs WHERE id = 'f1500000-0000-4000-8000-0000000000a1'), 'a run with fractional fix times is saved with a route');
SELECT pg_temp.check((SELECT st_x(st_pointn(route, 2)) = 77.5905 FROM runs WHERE id = 'f1500000-0000-4000-8000-0000000000a1'), 'route points are in time order');
ROLLBACK;

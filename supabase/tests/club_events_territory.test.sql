-- Club events and club territory (20261113000008).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('test.uid', u::text, true), set_config('test.role', 'authenticated', true) $$;
CREATE FUNCTION pg_temp.fails(sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN EXECUTE sql; RETURN false; EXCEPTION WHEN OTHERS THEN RETURN true; END $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('f8100000-0000-4000-8000-000000000001', 'ce-owner@example.com'), ('f8200000-0000-4000-8000-000000000002', 'ce-member@example.com'),
  ('f8300000-0000-4000-8000-000000000003', 'ce-other@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES
  ('f8100000-0000-4000-8000-000000000001', 'ce_owner'), ('f8200000-0000-4000-8000-000000000002', 'ce_member'), ('f8300000-0000-4000-8000-000000000003', 'ce_other')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;
INSERT INTO public.clubs (id, name, owner_id) VALUES
  ('f8a00000-0000-4000-8000-0000000000a1', 'ce club A', 'f8100000-0000-4000-8000-000000000001'),
  ('f8b00000-0000-4000-8000-0000000000b1', 'ce club B', 'f8300000-0000-4000-8000-000000000003');
INSERT INTO public.club_members (club_id, user_id, role) VALUES
  ('f8a00000-0000-4000-8000-0000000000a1', 'f8100000-0000-4000-8000-000000000001', 'admin'),
  ('f8a00000-0000-4000-8000-0000000000a1', 'f8200000-0000-4000-8000-000000000002', 'member'),
  ('f8b00000-0000-4000-8000-0000000000b1', 'f8300000-0000-4000-8000-000000000003', 'admin');
INSERT INTO public.territory_polygons (owner_id, geom, area_m2, tier, polygon_coords) VALUES
  ('f8100000-0000-4000-8000-000000000001', ST_GeomFromText('POLYGON((77.6 12.9,77.601 12.9,77.601 12.901,77.6 12.9))', 4326), 5000, 'patch', '[[77.6,12.9],[77.601,12.9],[77.601,12.901],[77.6,12.9]]'),
  ('f8200000-0000-4000-8000-000000000002', ST_GeomFromText('POLYGON((77.61 12.9,77.611 12.9,77.611 12.901,77.61 12.9))', 4326), 7000, 'patch', '[[77.61,12.9],[77.611,12.9],[77.611,12.901],[77.61,12.9]]'),
  ('f8300000-0000-4000-8000-000000000003', ST_GeomFromText('POLYGON((77.62 12.9,77.621 12.9,77.621 12.901,77.62 12.9))', 4326), 9000, 'patch', '[[77.62,12.9],[77.621,12.9],[77.621,12.901],[77.62,12.9]]');

SELECT pg_temp.as_user('f8100000-0000-4000-8000-000000000001');
SELECT pg_temp.check(public.create_club_event('f8a00000-0000-4000-8000-0000000000a1', 'Saturday long run', now() + interval '2 days', 'Cubbon Park gate', 10000, NULL, 4) = 4,
  'an admin schedules a weekly run for 4 weeks (no Plus needed)');
SELECT pg_temp.check((SELECT count(*) FROM public.get_club_events('f8a00000-0000-4000-8000-0000000000a1')) = 4, 'the club lists them');
SELECT public.create_club_event('f8a00000-0000-4000-8000-0000000000a1', 'Hill reps', now() + interval '3 days', 'Nandi gate', 6000, NULL, 1, NULL, NULL,
  '[{"lat":12.97,"lng":77.59},{"lat":12.98,"lng":77.60}]'::jsonb);
SELECT pg_temp.check((SELECT jsonb_array_length(route_points) FROM public.get_club_events('f8a00000-0000-4000-8000-0000000000a1') WHERE title = 'Hill reps') = 2,
  'a club run can carry a route');
SELECT pg_temp.check(pg_temp.fails($q$SELECT public.create_club_event('f8a00000-0000-4000-8000-0000000000a1', 'Bad route', now() + interval '3 days', 'x', NULL, NULL, 1, NULL, NULL, '[{"lat":1,"lng":1}]'::jsonb)$q$),
  'a one-point route is refused');
SELECT pg_temp.check((SELECT max(starts_at) - min(starts_at) FROM public.get_club_events('f8a00000-0000-4000-8000-0000000000a1') WHERE title = 'Saturday long run') = interval '21 days', 'a week apart');
SELECT pg_temp.as_user('f8200000-0000-4000-8000-000000000002');
SELECT pg_temp.check(pg_temp.fails($q$SELECT public.create_club_event('f8a00000-0000-4000-8000-0000000000a1', 'x run', now() + interval '1 day', 'here')$q$), 'a plain member cannot schedule');
SELECT pg_temp.check(pg_temp.fails($q$SELECT public.create_club_event('f8b00000-0000-4000-8000-0000000000b1', 'other club', now() + interval '1 day', 'here')$q$), 'nor for another club');
SELECT pg_temp.as_user('f8100000-0000-4000-8000-000000000001');
SELECT pg_temp.check(pg_temp.fails($q$SELECT public.create_club_event('f8a00000-0000-4000-8000-0000000000a1', 'past run', now() - interval '1 day', 'here')$q$), 'not in the past');

SELECT pg_temp.check((SELECT count(*) FROM public.get_club_territory('f8a00000-0000-4000-8000-0000000000a1')) = 2, 'club territory is every member''s zones');
SELECT pg_temp.check((SELECT array_agg(name ORDER BY rank) FROM public.get_club_territory_board(50) WHERE name LIKE 'ce club%') = ARRAY['ce club A', 'ce club B'], 'clubs ranked by area held (12,000 vs 9,000 m²)');
ROLLBACK;

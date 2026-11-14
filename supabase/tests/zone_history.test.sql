-- Zone history and legends (20261113000013).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('d1100000-0000-4000-8000-000000000001', 'zh-a@example.com'), ('d1200000-0000-4000-8000-000000000002', 'zh-b@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES
  ('d1100000-0000-4000-8000-000000000001', 'zh_a'), ('d1200000-0000-4000-8000-000000000002', 'zh_b')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;

-- A claims a square.
INSERT INTO public.territory_polygons (id, owner_id, area_m2, tier, polygon_coords) VALUES
  ('d1300000-0000-4000-8000-0000000000a1', 'd1100000-0000-4000-8000-000000000001', 70000, 'block',
   '[[10.0000,50.0000],[10.0030,50.0000],[10.0030,50.0020],[10.0000,50.0020],[10.0000,50.0000]]');
SELECT pg_temp.check((SELECT kind FROM zone_events WHERE zone_id = 'd1300000-0000-4000-8000-0000000000a1') = 'claimed', 'a claim is logged');

-- A defends it twice.
UPDATE public.territory_polygons SET last_defended_at = now() + interval '1 hour' WHERE id = 'd1300000-0000-4000-8000-0000000000a1';
UPDATE public.territory_polygons SET last_defended_at = now() + interval '2 hours' WHERE id = 'd1300000-0000-4000-8000-0000000000a1';
SELECT pg_temp.check((SELECT count(*) FROM zone_events WHERE zone_id = 'd1300000-0000-4000-8000-0000000000a1' AND kind = 'defended') = 2, 'defences are logged');

-- B steals a piece inside it (insert while A's zone still exists).
INSERT INTO public.territory_polygons (id, owner_id, area_m2, tier, polygon_coords) VALUES
  ('d1300000-0000-4000-8000-0000000000b1', 'd1200000-0000-4000-8000-000000000002', 10000, 'block',
   '[[10.0005,50.0005],[10.0012,50.0005],[10.0012,50.0012],[10.0005,50.0012],[10.0005,50.0005]]');
SELECT pg_temp.check((SELECT kind = 'stolen' AND prev_owner_id = 'd1100000-0000-4000-8000-000000000001' FROM zone_events WHERE zone_id = 'd1300000-0000-4000-8000-0000000000b1'), 'a steal names who lost it');

SELECT set_config('test.uid', 'd1200000-0000-4000-8000-000000000002', true), set_config('test.role', 'authenticated', true);
SELECT pg_temp.check((SELECT count(*) FROM get_zone_history('d1300000-0000-4000-8000-0000000000a1')) = 4, 'history of the ground: claim, 2 defences, steal');
SELECT pg_temp.check((SELECT bool_and(is_legend) FROM get_zone_history('d1300000-0000-4000-8000-0000000000a1') WHERE username = 'zh_a' AND kind = 'defended'), 'A is the legend');
SELECT pg_temp.check((SELECT max(legend_defences) FROM get_zone_history('d1300000-0000-4000-8000-0000000000a1')) = 2, 'legend has 2 defences');
SELECT pg_temp.check(legend_zone_count('d1100000-0000-4000-8000-000000000001') >= 1, 'legend count for A');
ROLLBACK;

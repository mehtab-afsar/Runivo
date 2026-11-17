-- Club war (20261117000004): rival by contests, else neighbour on this week's area; members only.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
SET LOCAL runivo.trusted_writer = 'on';

INSERT INTO auth.users (id, email) SELECT ('e1000000-0000-4000-8000-00000000000' || g)::uuid, 'w' || g || '@example.com' FROM generate_series(1, 6) g;
INSERT INTO public.profiles (id, username) SELECT ('e1000000-0000-4000-8000-00000000000' || g)::uuid, 'warrior' || g FROM generate_series(1, 6) g
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;
-- Club A: users 1,2,3. Club B: 4,5. Club C: 6.
INSERT INTO public.clubs (id, name, owner_id) VALUES
  ('e2000000-0000-4000-8000-00000000000a', 'Striders', 'e1000000-0000-4000-8000-000000000001'),
  ('e2000000-0000-4000-8000-00000000000b', 'Harriers', 'e1000000-0000-4000-8000-000000000004'),
  ('e2000000-0000-4000-8000-00000000000c', 'Pacers',   'e1000000-0000-4000-8000-000000000006');
INSERT INTO public.club_members (club_id, user_id) VALUES
  ('e2000000-0000-4000-8000-00000000000a', 'e1000000-0000-4000-8000-000000000001'),
  ('e2000000-0000-4000-8000-00000000000a', 'e1000000-0000-4000-8000-000000000002'),
  ('e2000000-0000-4000-8000-00000000000a', 'e1000000-0000-4000-8000-000000000003'),
  ('e2000000-0000-4000-8000-00000000000b', 'e1000000-0000-4000-8000-000000000004'),
  ('e2000000-0000-4000-8000-00000000000b', 'e1000000-0000-4000-8000-000000000005'),
  ('e2000000-0000-4000-8000-00000000000c', 'e1000000-0000-4000-8000-000000000006')
ON CONFLICT DO NOTHING;

-- This week: A members 1=3000, 2=5000 (3 none). B 4=4000. C 6=9000. Last week's zone doesn't count.
INSERT INTO public.territory_polygons (owner_id, geom, area_m2, tier, claimed_at, polygon_coords)
SELECT o::uuid,
       ST_GeomFromText(format('POLYGON((%1$s 12.9,%2$s 12.9,%2$s 12.901,%1$s 12.9))', 77.6 + i * 0.01, 77.601 + i * 0.01), 4326),
       a, 'patch', c,
       jsonb_build_array(jsonb_build_array(77.6 + i * 0.01, 12.9), jsonb_build_array(77.601 + i * 0.01, 12.9),
                         jsonb_build_array(77.601 + i * 0.01, 12.901), jsonb_build_array(77.6 + i * 0.01, 12.9))
  FROM (VALUES
    ('e1000000-0000-4000-8000-000000000001', 3000, now(), 1),
    ('e1000000-0000-4000-8000-000000000002', 5000, now(), 2),
    ('e1000000-0000-4000-8000-000000000004', 4000, now(), 3),
    ('e1000000-0000-4000-8000-000000000006', 9000, now(), 4),
    ('e1000000-0000-4000-8000-000000000002', 7000, now() - interval '8 days', 5)
  ) v(o, a, c, i);

SET LOCAL test.uid = 'e1000000-0000-4000-8000-000000000001';
CREATE TEMP TABLE w1 AS SELECT * FROM public.club_war('e2000000-0000-4000-8000-00000000000a');
SELECT pg_temp.check((SELECT rival_name FROM w1) = 'Pacers', 'no contests: rival is the club just ahead this week');
SELECT pg_temp.check((SELECT club_area_m2 FROM w1) = 8000, 'club score counts this week only');
SELECT pg_temp.check((SELECT my_area_m2 FROM w1) = 3000 AND (SELECT my_rank FROM w1) = 2, 'your share and rank in the club');
SELECT pg_temp.check((SELECT ends_at FROM w1) > now() AND (SELECT ends_at FROM w1) <= now() + interval '7 days', 'ends at the end of this week');

-- Harriers keep contesting Striders' zones: they become the rival.
WITH r AS (
  INSERT INTO public.runs (user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points)
  VALUES ('e1000000-0000-4000-8000-000000000004', 'run', now() - interval '2 hours', now() - interval '1 hour', 5000, 1800, '6:00', '[]'),
         ('e1000000-0000-4000-8000-000000000001', 'run', now() - interval '3 hours', now() - interval '2 hours', 5000, 1800, '6:00', '[]')
  RETURNING id, user_id
)
INSERT INTO public.run_territory_contests (run_id, user_id, rival_owner_id, overlap_pct, qualified)
SELECT r.id, r.user_id,
       CASE WHEN r.user_id = 'e1000000-0000-4000-8000-000000000004' THEN 'e1000000-0000-4000-8000-000000000002'::uuid
            ELSE 'e1000000-0000-4000-8000-000000000005'::uuid END,
       0.5, true
  FROM r;
CREATE TEMP TABLE w2 AS SELECT * FROM public.club_war('e2000000-0000-4000-8000-00000000000a');
SELECT pg_temp.check((SELECT rival_name FROM w2) = 'Harriers' AND (SELECT rival_area_m2 FROM w2) = 4000, 'rival is the club we clash with most');

SET LOCAL test.uid = 'e1000000-0000-4000-8000-000000000006';
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.club_war('e2000000-0000-4000-8000-00000000000a')), 'non-members see nothing');
ROLLBACK;

-- Club feed, run-together, nearby runners, friend zone alerts, group challenges (20261113000014).
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
  ('e1000000-0000-4000-8000-000000000001', 'sb-a@example.com'),
  ('e2000000-0000-4000-8000-000000000002', 'sb-b@example.com'),
  ('e3000000-0000-4000-8000-000000000003', 'sb-c@example.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username, last_known_location, territory_score) VALUES
  ('e1000000-0000-4000-8000-000000000001', 'sba', 'SRID=4326;POINT(77.60 12.97)', 10),
  ('e2000000-0000-4000-8000-000000000002', 'sbb', 'SRID=4326;POINT(77.61 12.97)', 50),
  ('e3000000-0000-4000-8000-000000000003', 'sbc', 'SRID=4326;POINT(80.00 20.00)', 90)
ON CONFLICT (id) DO UPDATE SET last_known_location = EXCLUDED.last_known_location, territory_score = EXCLUDED.territory_score;

-- O3: B is 1 km from A, C is far away.
SELECT pg_temp.as_user('e1000000-0000-4000-8000-000000000001');
SELECT pg_temp.check((SELECT array_agg(username) FROM suggest_runners_nearby(5)) = ARRAY['sbb'], 'nearby suggests B, not far-away C');

-- F5: A and B start together.
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points) VALUES
  ('e1100000-0000-4000-8000-0000000000a1', 'e1000000-0000-4000-8000-000000000001', 'run', now() - interval '2 hours', now() - interval '1 hour', 5000, 1800, '6:00', (SELECT jsonb_agg(jsonb_build_object('lat', 12.9700 + i * 0.0009, 'lng', 77.6000, 'timestamp', (extract(epoch from now() - interval '2 hours') * 1000)::bigint + i * 15000) ORDER BY i) FROM generate_series(0, 40) i)),
  ('e2100000-0000-4000-8000-0000000000b1', 'e2000000-0000-4000-8000-000000000002', 'run', now() - interval '2 hours' + interval '2 minutes', now() - interval '1 hour', 5000, 1800, '6:00', (SELECT jsonb_agg(jsonb_build_object('lat', 12.9703 + i * 0.0009, 'lng', 77.6002, 'timestamp', (extract(epoch from now() - interval '118 minutes') * 1000)::bigint + i * 15000) ORDER BY i) FROM generate_series(0, 40) i));
INSERT INTO public.feed_posts (id, user_id, run_id, distance_km, post_type) VALUES
  ('e1200000-0000-4000-8000-0000000000c1', 'e1000000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-0000000000a1', 5, 'run'),
  ('e2200000-0000-4000-8000-0000000000c2', 'e2000000-0000-4000-8000-000000000002', 'e2100000-0000-4000-8000-0000000000b1', 5, 'run');
SELECT pg_temp.as_user('e3000000-0000-4000-8000-000000000003');
SELECT pg_temp.check((SELECT username FROM get_post_companions(ARRAY['e1200000-0000-4000-8000-0000000000c1'::uuid])) = 'sbb', 'A ran with B');

-- C3: club feed for members only.
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO public.clubs (id, name, owner_id) VALUES ('e4000000-0000-4000-8000-0000000000d1', 'SB club', 'e1000000-0000-4000-8000-000000000001');
INSERT INTO public.club_members (club_id, user_id, role) VALUES
  ('e4000000-0000-4000-8000-0000000000d1', 'e1000000-0000-4000-8000-000000000001', 'owner'),
  ('e4000000-0000-4000-8000-0000000000d1', 'e2000000-0000-4000-8000-000000000002', 'member')
ON CONFLICT DO NOTHING;
SELECT pg_temp.as_user('e2000000-0000-4000-8000-000000000002');
SELECT pg_temp.check((SELECT count(*) FROM get_club_feed('e4000000-0000-4000-8000-0000000000d1')) = 2, 'members see the club feed');
SELECT pg_temp.as_user('e3000000-0000-4000-8000-000000000003');
SELECT pg_temp.check((SELECT count(*) FROM get_club_feed('e4000000-0000-4000-8000-0000000000d1')) = 0, 'outsiders see nothing');

-- C4: A follows B and challenges them; B joins; distance counts.
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO public.followers (follower_id, following_id) VALUES ('e1000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000002') ON CONFLICT DO NOTHING;
CREATE TEMP TABLE ch AS SELECT NULL::uuid AS id;
GRANT ALL ON ch TO PUBLIC;
SELECT pg_temp.as_user('e1000000-0000-4000-8000-000000000001');
-- the challenge started before the runs
UPDATE ch SET id = create_group_challenge('November 50', 'distance_km', 50, now() + interval '10 days', ARRAY['e2000000-0000-4000-8000-000000000002'::uuid, 'e3000000-0000-4000-8000-000000000003'::uuid]);
SET LOCAL runivo.trusted_writer = 'on';
UPDATE group_challenges SET starts_at = now() - interval '1 day' WHERE id = (SELECT id FROM ch);
SELECT pg_temp.check((SELECT count(*) FROM group_challenge_members WHERE challenge_id = (SELECT id FROM ch)) = 2, 'only people you follow are invited');
SELECT pg_temp.as_user('e2000000-0000-4000-8000-000000000002');
SELECT respond_group_challenge((SELECT id FROM ch), true);
SELECT pg_temp.check((SELECT progress FROM group_challenge_progress((SELECT id FROM ch)) WHERE username = 'sbb') = 5.0, 'B has 5 km');
SELECT pg_temp.check((SELECT people FROM my_group_challenges() WHERE id = (SELECT id FROM ch)) = 2, 'two people joined');
SELECT pg_temp.as_user('e3000000-0000-4000-8000-000000000003');
SELECT pg_temp.check((SELECT count(*) FROM group_challenge_progress((SELECT id FROM ch))) = 0, 'non-members see no progress');
ROLLBACK;

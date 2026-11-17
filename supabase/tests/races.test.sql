-- Races catalogue, runner-added races and entries (20261117000011).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;
SET LOCAL runivo.trusted_writer = 'on';
INSERT INTO auth.users (id, email) VALUES
  ('fc000000-0000-4000-8000-000000000001', 'admin@example.com'),
  ('fc000000-0000-4000-8000-000000000002', 'runner@example.com'),
  ('fc000000-0000-4000-8000-000000000003', 'other@example.com');
UPDATE public.profiles SET subscription_tier = 'admin' WHERE id = 'fc000000-0000-4000-8000-000000000001';

-- A curated event with a running distance becomes a catalogue race.
SET LOCAL test.uid = 'fc000000-0000-4000-8000-000000000001';
INSERT INTO public.events (id, title, event_type, starts_at, ends_at, source, registration_url, discipline, distance_m, location_name, lat, lng)
VALUES ('fc200000-0000-4000-8000-000000000001', 'Lakeside Half Test', 'race', now() + interval '60 days', now() + interval '60 days 3 hours',
        'curated', 'https://example.com/lakeside', 'half_marathon', 21097, 'Bengaluru', 12.95, 77.58);
SELECT pg_temp.check((SELECT status FROM public.races WHERE event_id = 'fc200000-0000-4000-8000-000000000001') = 'approved', 'curated event mirrored as an approved race');
SELECT pg_temp.check((SELECT d.label FROM public.race_distances d JOIN public.races r ON r.id = d.race_id WHERE r.event_id = 'fc200000-0000-4000-8000-000000000001') = 'Half', 'distance labelled Half');
UPDATE public.events SET is_active = false WHERE id = 'fc200000-0000-4000-8000-000000000001';
SELECT pg_temp.check((SELECT status FROM public.races WHERE event_id = 'fc200000-0000-4000-8000-000000000001') = 'cancelled', 'inactive event marks the race cancelled');
UPDATE public.events SET is_active = true WHERE id = 'fc200000-0000-4000-8000-000000000001';

-- A runner finds it by name and by distance, nearest first.
SET LOCAL test.uid = 'fc000000-0000-4000-8000-000000000002';
SELECT pg_temp.check((SELECT count(*) FROM public.search_races('lakeside half')) = 1, 'found by name');
SELECT pg_temp.check((SELECT count(*) FROM public.search_races(NULL, NULL, NULL, 21097)) >= 1, 'found by half distance');
SELECT pg_temp.check((SELECT count(*) FROM public.search_races('lakeside', NULL, NULL, 5000)) = 0, 'not found for 5K');
SELECT pg_temp.check((SELECT km_away FROM public.search_races('lakeside', NULL, NULL, NULL, 12.97, 77.59)) <= 5, 'distance away worked out');

-- Adding a race: rules, then pending and private to its author.
SELECT pg_temp.check(public.add_runner_race('ab', current_date + 30, 10000) ->> 'error' = 'bad_name', 'short name refused');
SELECT pg_temp.check(public.add_runner_race('Hilltop 10K Test', current_date - 1, 10000) ->> 'error' = 'bad_date', 'past date refused');
SELECT pg_temp.check(public.add_runner_race('Hilltop 10K Test', current_date + 30, 10000, NULL, 'http://x.com') ->> 'error' = 'bad_url', 'non-https link refused');
CREATE TEMP TABLE added AS SELECT public.add_runner_race('Hilltop 10K Test', current_date + 30, 10000, 'Mysuru', 'https://example.com/h') AS r;
GRANT ALL ON added TO PUBLIC;
SELECT pg_temp.check((SELECT r ? 'distance_id' FROM added), 'runner race added');
SELECT pg_temp.check((SELECT status FROM public.search_races('hilltop')) = 'pending', 'author finds it, pending');
SELECT pg_temp.check(public.enter_race((SELECT (r ->> 'distance_id')::uuid FROM added)) = 'entered', 'author can enter their pending race');

SET LOCAL test.uid = 'fc000000-0000-4000-8000-000000000003';
SELECT pg_temp.check((SELECT count(*) FROM public.search_races('hilltop')) = 0, 'others do not see a pending race');
SELECT pg_temp.check(public.enter_race((SELECT (r ->> 'distance_id')::uuid FROM added)) = 'not_found', 'others cannot enter it');
SELECT pg_temp.check(public.review_runner_race((SELECT (r ->> 'race_id')::uuid FROM added), true) = 'not_allowed', 'only admins review');

SET LOCAL test.uid = 'fc000000-0000-4000-8000-000000000001';
SELECT pg_temp.check(public.review_runner_race((SELECT (r ->> 'race_id')::uuid FROM added), true) = 'done', 'admin approves');
SET LOCAL test.uid = 'fc000000-0000-4000-8000-000000000003';
SELECT pg_temp.check((SELECT count(*) FROM public.search_races('hilltop')) = 1, 'approved race visible to all');

-- Counts only: 1 entrant shows as "a few" (-1).
SELECT pg_temp.check((SELECT entrants FROM public.search_races('hilltop')) = -1, 'one entrant shows as a few');
SELECT pg_temp.check((SELECT NOT mine FROM public.search_races('hilltop')), 'not marked as mine for others');

-- Rate limit: 5 a day.
SET LOCAL test.uid = 'fc000000-0000-4000-8000-000000000002';
SELECT public.add_runner_race('Spam race ' || i, current_date + 40, 5000) FROM generate_series(1, 4) i;
SELECT pg_temp.check(public.add_runner_race('One too many', current_date + 40, 5000) ->> 'error' = 'too_many', 'sixth race in a day refused');

-- Leaving.
SELECT public.leave_race((SELECT (r ->> 'distance_id')::uuid FROM added));
SELECT pg_temp.check((SELECT entrants FROM public.search_races('hilltop')) = 0, 'leaving removes the entry');
ROLLBACK;

-- v1 onboarding: goal values, new columns, health consent, phone sign-up.
-- Run after _stub_supabase.sql, 20261106000001, _stub_onboarding.sql, 20261106000005.
\set ON_ERROR_STOP on
SET client_min_messages = notice;
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF;
  RAISE NOTICE 'ok  %', what;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.fails(sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE sql;
  RETURN false;
EXCEPTION WHEN check_violation THEN
  RETURN true;
END $$;

-- Sign-ups: email, phone (no email), and two phones (unique usernames).
INSERT INTO auth.users (id, email) VALUES ('c1000000-0000-0000-0000-000000000001', 'asha.k@runivo.app');
INSERT INTO auth.users (id, phone) VALUES ('c1000000-0000-0000-0000-000000000002', '+919876543210');
INSERT INTO auth.users (id, phone) VALUES ('c1000000-0000-0000-0000-000000000003', '+919876543211');
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('c1000000-0000-0000-0000-000000000004', 'x@y.com', '{"username":"Leo Runs!"}');

SELECT pg_temp.check(username = 'ashak', 'email sign-up: username from the email')
FROM profiles WHERE id = 'c1000000-0000-0000-0000-000000000001';
SELECT pg_temp.check(username = 'runner', 'phone sign-up no longer fails: username "runner"')
FROM profiles WHERE id = 'c1000000-0000-0000-0000-000000000002';
SELECT pg_temp.check(username LIKE 'runner\_%' AND username <> 'runner', 'second phone sign-up gets a unique suffix')
FROM profiles WHERE id = 'c1000000-0000-0000-0000-000000000003';
SELECT pg_temp.check(username = 'LeoRuns', 'chosen username is sanitised')
FROM profiles WHERE id = 'c1000000-0000-0000-0000-000000000004';

-- Goals: the four PRD answers and the old values.
UPDATE profiles SET primary_goal = 'race'   WHERE id = 'c1000000-0000-0000-0000-000000000001';
UPDATE profiles SET primary_goal = 'social' WHERE id = 'c1000000-0000-0000-0000-000000000002';
UPDATE profiles SET primary_goal = 'run_faster' WHERE id = 'c1000000-0000-0000-0000-000000000003';
SELECT pg_temp.check(count(*) = 3, 'primary_goal accepts race, social and the old values')
FROM profiles WHERE primary_goal IS NOT NULL;
SELECT pg_temp.check(pg_temp.fails($$UPDATE profiles SET primary_goal = 'nap' WHERE id = 'c1000000-0000-0000-0000-000000000001'$$),
  'unknown goal is refused');

-- Running now and about you.
UPDATE profiles SET usual_distance_km = 5, recent_5k_seconds = 1650, pacex_tone = 'structured', age_range = '25_34'
WHERE id = 'c1000000-0000-0000-0000-000000000001';
SELECT pg_temp.check(usual_distance_km = 5 AND recent_5k_seconds = 1650 AND pacex_tone = 'structured' AND age_range = '25_34',
  'onboarding answers are stored') FROM profiles WHERE id = 'c1000000-0000-0000-0000-000000000001';
SELECT pg_temp.check(pg_temp.fails($$UPDATE profiles SET recent_5k_seconds = 300 WHERE id = 'c1000000-0000-0000-0000-000000000001'$$),
  'a 5:00 5K is refused');
SELECT pg_temp.check(pg_temp.fails($$UPDATE profiles SET age_range = '30' WHERE id = 'c1000000-0000-0000-0000-000000000001'$$),
  'unknown age range is refused');
SELECT pg_temp.check(pg_temp.fails($$UPDATE profiles SET pacex_tone = 'rude' WHERE id = 'c1000000-0000-0000-0000-000000000001'$$),
  'unknown PaceX tone is refused');

-- Health consent.
UPDATE profiles SET health_baseline = '{"runs":12}' WHERE id = 'c1000000-0000-0000-0000-000000000002';
SELECT pg_temp.check(health_baseline IS NULL, 'no consent: health data is not kept')
FROM profiles WHERE id = 'c1000000-0000-0000-0000-000000000002';
UPDATE profiles SET health_consent_at = now(), health_consent_version = 'health-v1', health_baseline = '{"runs":12}'
WHERE id = 'c1000000-0000-0000-0000-000000000002';
SELECT pg_temp.check(health_baseline->>'runs' = '12' AND health_consent_version = 'health-v1', 'with consent: baseline stored with the wording version')
FROM profiles WHERE id = 'c1000000-0000-0000-0000-000000000002';
UPDATE profiles SET health_consent_at = NULL WHERE id = 'c1000000-0000-0000-0000-000000000002';
SELECT pg_temp.check(health_baseline IS NULL AND health_consent_version IS NULL, 'withdrawing consent deletes the baseline')
FROM profiles WHERE id = 'c1000000-0000-0000-0000-000000000002';

SELECT 'ALL ONBOARDING CHECKS PASSED' AS result;
ROLLBACK;

-- Migration 20261116000001: user-id RPCs check the caller; the placeholder reward is hidden.
-- Self-contained: builds the few tables it needs, then applies the migration. Run from the repo root.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', what; END IF; RAISE NOTICE 'ok  %', what; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()  RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('test.role', true), ''), 'authenticated') $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;

CREATE TABLE public.profiles (id uuid PRIMARY KEY, profile_visibility text NOT NULL DEFAULT 'public');
CREATE TABLE public.followers (follower_id uuid, following_id uuid);
CREATE TABLE public.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, started_at timestamptz,
  distance_m numeric, duration_sec int, calories_burned int, territories_claimed text[]);
CREATE TABLE public.weekly_consistency (
  user_id uuid, week_start date, consistency_score int, sessions_completed int,
  sessions_planned int, km_actual float8, streak_days_eow int);
CREATE TABLE public.pace_store_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), brand text, title text, partner_id uuid, status text);
CREATE FUNCTION public.is_blocked_between(a uuid, b uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
-- Same rule as 20261115000022.
CREATE FUNCTION public.can_view_profile(p_viewer uuid, p_owner uuid, p_visibility text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p_viewer = p_owner OR (p_viewer IS NOT NULL AND (
    COALESCE(p_visibility, 'public') = 'public'
    OR (p_visibility = 'followers' AND EXISTS (
        SELECT 1 FROM public.followers WHERE follower_id = p_viewer AND following_id = p_owner)))) $$;
-- Old, open versions of what the migration replaces or revokes.
CREATE FUNCTION public.get_run_km_by_user(p_cutoff timestamptz) RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;
CREATE FUNCTION public.get_run_km_by_user(p_cutoff timestamptz, p_limit int DEFAULT 100) RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;
CREATE FUNCTION public.sponsored_progress(p_challenge uuid, p_user uuid) RETURNS numeric LANGUAGE sql AS $$ SELECT 1::numeric $$;

INSERT INTO public.profiles VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'public'),
  ('00000000-0000-0000-0000-0000000000b1', 'followers'),
  ('00000000-0000-0000-0000-0000000000c1', 'private');
INSERT INTO public.followers VALUES ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');
INSERT INTO public.runs (user_id, started_at, distance_m, duration_sec, calories_burned, territories_claimed) VALUES
  ('00000000-0000-0000-0000-0000000000b1', now(), 5000, 1500, 300, '{}'),
  ('00000000-0000-0000-0000-0000000000c1', now(), 8000, 2400, 500, '{}');
INSERT INTO public.weekly_consistency VALUES
  ('00000000-0000-0000-0000-0000000000a1', current_date, 80, 3, 4, 20, 5);
INSERT INTO public.pace_store_rewards (brand, title, partner_id, status) VALUES
  ('Brooks', '20% off Brooks Running', NULL, 'available'),
  ('Brooks', '20% off Brooks Running', gen_random_uuid(), 'available'),
  ('Other',  'Real partner reward',     NULL, 'available');

\ir ../archive/migrations_2026/20261116000001_close_user_id_rpcs.sql

CREATE FUNCTION pg_temp.as_user(uid text, rl text DEFAULT 'authenticated') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('test.uid', uid, true);
  PERFORM set_config('test.role', rl, true);
END $$;

-- get_profile_stats ----------------------------------------------------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
SELECT pg_temp.check((public.get_profile_stats('00000000-0000-0000-0000-0000000000b1')->>'totalRuns')::int = 1,
  'a follower sees a followers-only runner''s stats');
SELECT pg_temp.check((public.get_profile_stats('00000000-0000-0000-0000-0000000000c1')->>'totalRuns')::int = 0,
  'a stranger gets zeros for a private runner');
SELECT pg_temp.check((public.get_profile_stats('00000000-0000-0000-0000-0000000000a1')->>'totalRuns')::int = 0
  AND (public.get_profile_stats('00000000-0000-0000-0000-0000000000a1')->>'totalKm')::numeric = 0,
  'own stats work (no runs yet in the fixture)');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
SELECT pg_temp.check((public.get_profile_stats('00000000-0000-0000-0000-0000000000c1')->>'totalRuns')::int = 1,
  'a private runner sees their own stats');
SELECT pg_temp.check((public.get_profile_stats('00000000-0000-0000-0000-0000000000b1')->>'totalRuns')::int = 0,
  'a non-follower gets zeros for a followers-only runner');
SELECT pg_temp.as_user('', 'authenticated');
SELECT pg_temp.check((public.get_profile_stats('00000000-0000-0000-0000-0000000000a1')->>'totalRuns')::int = 0,
  'no user id: zeros, not an error');
SELECT pg_temp.as_user('', 'service_role');
SELECT pg_temp.check((public.get_profile_stats('00000000-0000-0000-0000-0000000000c1')->>'totalRuns')::int = 1,
  'the service role reads any runner');
SELECT pg_temp.check((public.get_profile_stats('00000000-0000-0000-0000-0000000000ff')->>'totalRuns')::int = 0,
  'an unknown runner returns zeros');

-- get_consistency_history ----------------------------------------------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
SELECT pg_temp.check((SELECT count(*) FROM public.get_consistency_history('00000000-0000-0000-0000-0000000000a1')) = 1,
  'own consistency history is returned');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
SELECT pg_temp.check((SELECT count(*) FROM public.get_consistency_history('00000000-0000-0000-0000-0000000000a1')) = 0,
  'another runner''s consistency history is empty');
SELECT pg_temp.as_user('', 'service_role');
SELECT pg_temp.check((SELECT count(*) FROM public.get_consistency_history('00000000-0000-0000-0000-0000000000a1')) = 1,
  'the service role (ai-coach) reads it');

-- grants ---------------------------------------------------------------------
SELECT pg_temp.check(NOT has_function_privilege('anon', 'public.get_profile_stats(uuid,text)', 'EXECUTE'),
  'anon cannot call get_profile_stats');
SELECT pg_temp.check(NOT has_function_privilege('anon', 'public.get_consistency_history(uuid,int)', 'EXECUTE'),
  'anon cannot call get_consistency_history');
SELECT pg_temp.check(has_function_privilege('authenticated', 'public.get_profile_stats(uuid,text)', 'EXECUTE'),
  'signed-in users can still call get_profile_stats');
SELECT pg_temp.check(NOT has_function_privilege('authenticated', 'public.sponsored_progress(uuid,uuid)', 'EXECUTE'),
  'server-only helper revoked from signed-in users');
SELECT pg_temp.check(has_function_privilege('service_role', 'public.sponsored_progress(uuid,uuid)', 'EXECUTE'),
  'server-only helper kept for the service role');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_run_km_by_user'),
  'get_run_km_by_user is gone');

-- reward ---------------------------------------------------------------------
SELECT pg_temp.check((SELECT count(*) FROM public.pace_store_rewards WHERE status = 'hidden') = 1,
  'only the unattached Brooks placeholder is hidden');
SELECT pg_temp.check((SELECT count(*) FROM public.pace_store_rewards WHERE status = 'available') = 2,
  'partner-linked and other rewards stay available');

ROLLBACK;

-- Minimal stand-ins for the Supabase schema, so the v1 integrity migration can
-- be exercised on plain Postgres + PostGIS (no Docker needed).
-- Usage: see supabase/tests/README.md
CREATE EXTENSION IF NOT EXISTS postgis;
DO $$ BEGIN
  CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT COALESCE(current_setting('test.role', true), 'authenticated') $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('test.uid', true), '')::uuid $$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY, username text,
  subscription_tier text NOT NULL DEFAULT 'free', subscription_expires_at timestamptz,
  pace_balance int NOT NULL DEFAULT 0, pace_total_earned int NOT NULL DEFAULT 0,
  pace_weekly_earned int NOT NULL DEFAULT 0, pace_weekly_reset_at timestamptz NOT NULL DEFAULT now(),
  runner_rank text NOT NULL DEFAULT 'pacer', territory_score float8 NOT NULL DEFAULT 0,
  follower_count int DEFAULT 0, following_count int DEFAULT 0, streak_days int DEFAULT 0,
  last_run_date date, total_distance_km numeric DEFAULT 0, total_runs int DEFAULT 0
);
CREATE TABLE public.runs (id uuid PRIMARY KEY, user_id uuid REFERENCES public.profiles(id), distance_m numeric, started_at timestamptz DEFAULT now());
CREATE TABLE public.territory_polygons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid, owner_id uuid REFERENCES public.profiles(id),
  geom geometry(Polygon, 4326) NOT NULL, polygon_coords jsonb, area_m2 float8 NOT NULL,
  freshness smallint NOT NULL DEFAULT 100, last_defended_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz NOT NULL DEFAULT now(), is_loop_fill boolean NOT NULL DEFAULT false, tier text NOT NULL
);
CREATE OR REPLACE FUNCTION public._tp_geom() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_GeomFromGeoJSON(json_build_object('type','Polygon','coordinates', json_build_array(NEW.polygon_coords))::text), 4326);
  RETURN NEW;
END $$;
CREATE TRIGGER tp_geom BEFORE INSERT OR UPDATE OF polygon_coords ON public.territory_polygons
  FOR EACH ROW EXECUTE FUNCTION public._tp_geom();
CREATE TABLE public.pace_store_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, pace_cost int NOT NULL,
  status text NOT NULL DEFAULT 'available', expires_at timestamptz
);
CREATE TABLE public.pace_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, reward_id uuid, pace_spent int,
  created_at timestamptz DEFAULT now(), UNIQUE (user_id, reward_id)
);
CREATE TABLE public.mission_claims (user_id uuid, mission_id text, pace_earned int, PRIMARY KEY (user_id, mission_id));
CREATE OR REPLACE FUNCTION public.mission_pace_reward(p_title text) RETURNS int LANGUAGE sql IMMUTABLE AS
  $$ SELECT CASE p_title WHEN 'Long Haul' THEN 35 WHEN 'Morning Miles' THEN 4 ELSE NULL END $$;
CREATE OR REPLACE FUNCTION public.mission_completed_today(p_user uuid, p_title text) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT true $$;
CREATE OR REPLACE FUNCTION public.apply_pace_adjustment(p_user_id uuid, p_pace_delta int) RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;
-- The trigger is attached after the migration defines protect_profile_columns().

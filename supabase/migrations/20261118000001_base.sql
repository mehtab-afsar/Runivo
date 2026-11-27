-- ========================================================================
-- Base
-- ========================================================================
-- Extensions, shared helpers and app settings.
--
-- One file per feature: this file creates everything this feature owns
-- (tables, functions, triggers, row-level security, grants, scheduled jobs).
-- It needs only the files before it. Built from the 178 migrations up to
-- 20261117000012 (the 178 old files were removed after commit 9e5cf19; see git history); a fresh
-- database built from these files matches one built from those exactly.
--
-- Tables: app_settings

SET check_function_bodies = false;
SET client_min_messages = warning;
SET search_path = public, extensions;

CREATE EXTENSION IF NOT EXISTS postgis;   -- geometry types, spatial functions and indexes
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid(), digest()


-- ── Tables ────────────────────────────────────────────────────────────

CREATE TABLE public.app_settings (
    key text NOT NULL,
    value jsonb NOT NULL
);


-- ── Keys and checks ───────────────────────────────────────────────────

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


-- ── Functions ─────────────────────────────────────────────────────────

CREATE FUNCTION public.approx_point(p_lat double precision, p_lng double precision) RETURNS public.geography
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT ST_SetSRID(ST_MakePoint(round(p_lng::numeric, 3)::float8, round(p_lat::numeric, 3)::float8), 4326)::geography;
$$;

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE FUNCTION public.point_from_latlng(p_lat double precision, p_lng double precision) RETURNS public.geometry
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE
    WHEN p_lat IS NULL OR p_lng IS NULL THEN NULL
    WHEN p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180
      THEN ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
  END;
$$;


-- ── Row-level security ────────────────────────────────────────────────

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;


-- ── Policies ──────────────────────────────────────────────────────────

CREATE POLICY "app_settings: read" ON public.app_settings FOR SELECT USING (true);


-- ── Grants ────────────────────────────────────────────────────────────

REVOKE ALL ON TABLE public.app_settings FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.app_settings TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.app_settings TO authenticated;
GRANT ALL ON TABLE public.app_settings TO service_role;


-- ── Starting data ──────────────────────────────────────────────────────

INSERT INTO public.app_settings (key, value) VALUES ('subscriptions_enabled', 'false');

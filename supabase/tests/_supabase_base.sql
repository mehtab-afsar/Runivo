-- Stand-in for the parts of Supabase the migrations need (auth, storage, cron, net, vault schemas,
-- roles and auth.uid()), dumped from a bare Supabase-like database. Used by run.sh.
--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO postgres;

--
-- Name: cron; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA cron;


ALTER SCHEMA cron OWNER TO postgres;

--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA extensions;


ALTER SCHEMA extensions OWNER TO postgres;

--
-- Name: net; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA net;


ALTER SCHEMA net OWNER TO postgres;

--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA storage;


ALTER SCHEMA storage OWNER TO postgres;

--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA vault;


ALTER SCHEMA vault OWNER TO postgres;

--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: postgres
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$ SELECT NULL::text $$;


ALTER FUNCTION auth.email() OWNER TO postgres;

--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: postgres
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$ SELECT '{}'::jsonb $$;


ALTER FUNCTION auth.jwt() OWNER TO postgres;

--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: postgres
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$ SELECT COALESCE(current_setting('test.role', true), 'service_role') $$;


ALTER FUNCTION auth.role() OWNER TO postgres;

--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: postgres
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$ SELECT NULLIF(current_setting('test.uid', true), '')::uuid $$;


ALTER FUNCTION auth.uid() OWNER TO postgres;

--
-- Name: schedule(text, text); Type: FUNCTION; Schema: cron; Owner: postgres
--

CREATE FUNCTION cron.schedule(b text, c text) RETURNS bigint
    LANGUAGE sql
    AS $$ SELECT 1::bigint $$;


ALTER FUNCTION cron.schedule(b text, c text) OWNER TO postgres;

--
-- Name: schedule(text, text, text); Type: FUNCTION; Schema: cron; Owner: postgres
--

CREATE FUNCTION cron.schedule(a text, b text, c text) RETURNS bigint
    LANGUAGE sql
    AS $$ SELECT 1::bigint $$;


ALTER FUNCTION cron.schedule(a text, b text, c text) OWNER TO postgres;

--
-- Name: unschedule(bigint); Type: FUNCTION; Schema: cron; Owner: postgres
--

CREATE FUNCTION cron.unschedule(a bigint) RETURNS boolean
    LANGUAGE sql
    AS $$ SELECT true $$;


ALTER FUNCTION cron.unschedule(a bigint) OWNER TO postgres;

--
-- Name: unschedule(text); Type: FUNCTION; Schema: cron; Owner: postgres
--

CREATE FUNCTION cron.unschedule(a text) RETURNS boolean
    LANGUAGE sql
    AS $$ SELECT true $$;


ALTER FUNCTION cron.unschedule(a text) OWNER TO postgres;

--
-- Name: http_post(text, jsonb, jsonb, jsonb, integer); Type: FUNCTION; Schema: net; Owner: postgres
--

CREATE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}'::jsonb, params jsonb DEFAULT '{}'::jsonb, headers jsonb DEFAULT '{}'::jsonb, timeout_milliseconds integer DEFAULT 1000) RETURNS bigint
    LANGUAGE sql
    AS $$ SELECT 1::bigint $$;


ALTER FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) OWNER TO postgres;

--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: postgres
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    AS $$ SELECT string_to_array(name,'/') $$;


ALTER FUNCTION storage.foldername(name text) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: identities; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id text,
    user_id uuid,
    identity_data jsonb,
    provider text,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    email text
);


ALTER TABLE auth.identities OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud text,
    role text,
    email text,
    encrypted_password text,
    email_confirmed_at timestamp with time zone,
    phone text,
    raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    is_anonymous boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_sign_in_at timestamp with time zone,
    confirmation_token text,
    recovery_token text,
    email_change_token_new text,
    email_change text,
    is_sso_user boolean DEFAULT false,
    deleted_at timestamp with time zone
);


ALTER TABLE auth.users OWNER TO postgres;

--
-- Name: job; Type: TABLE; Schema: cron; Owner: postgres
--

CREATE TABLE cron.job (
    jobid bigint,
    jobname text,
    schedule text,
    command text
);


ALTER TABLE cron.job OWNER TO postgres;

--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: postgres
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text,
    public boolean,
    file_size_limit bigint,
    allowed_mime_types text[],
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE storage.buckets OWNER TO postgres;

--
-- Name: objects; Type: TABLE; Schema: storage; Owner: postgres
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE storage.objects OWNER TO postgres;

--
-- Name: decrypted_secrets; Type: TABLE; Schema: vault; Owner: postgres
--

CREATE TABLE vault.decrypted_secrets (
    name text,
    decrypted_secret text
);


ALTER TABLE vault.decrypted_secrets OWNER TO postgres;

--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: postgres
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: postgres
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: postgres
--



--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: objects avatars: owner delete; Type: POLICY; Schema: storage; Owner: postgres
--



--
-- Name: objects avatars: owner update; Type: POLICY; Schema: storage; Owner: postgres
--



--
-- Name: objects avatars: owner upload; Type: POLICY; Schema: storage; Owner: postgres
--



--
-- Name: objects avatars: public read; Type: POLICY; Schema: storage; Owner: postgres
--



--
-- Name: objects feed: owner delete; Type: POLICY; Schema: storage; Owner: postgres
--



--
-- Name: objects feed: owner upload; Type: POLICY; Schema: storage; Owner: postgres
--



--
-- Name: objects feed: public read; Type: POLICY; Schema: storage; Owner: postgres
--



--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: postgres
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: objects stories_storage_delete; Type: POLICY; Schema: storage; Owner: postgres
--



--
-- Name: objects stories_storage_insert; Type: POLICY; Schema: storage; Owner: postgres
--



--
-- Name: objects stories_storage_select; Type: POLICY; Schema: storage; Owner: postgres
--



--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;


--
-- Name: FUNCTION email(); Type: ACL; Schema: auth; Owner: postgres
--

GRANT ALL ON FUNCTION auth.email() TO anon;
GRANT ALL ON FUNCTION auth.email() TO authenticated;


--
-- Name: FUNCTION jwt(); Type: ACL; Schema: auth; Owner: postgres
--

GRANT ALL ON FUNCTION auth.jwt() TO anon;
GRANT ALL ON FUNCTION auth.jwt() TO authenticated;


--
-- Name: FUNCTION role(); Type: ACL; Schema: auth; Owner: postgres
--

GRANT ALL ON FUNCTION auth.role() TO anon;
GRANT ALL ON FUNCTION auth.role() TO authenticated;


--
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: postgres
--

GRANT ALL ON FUNCTION auth.uid() TO anon;
GRANT ALL ON FUNCTION auth.uid() TO authenticated;


--
-- PostgreSQL database dump complete
--



-- ── Behave like Supabase where the schema depends on it ──
-- Make the local stand-in behave like Supabase where it matters for comparing schemas.
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pg_cron; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE PUBLICATION supabase_realtime; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Supabase's default privileges for objects the postgres role creates in public.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
-- pg_cron: record jobs so builds can be compared (same job name replaces the old one, like pg_cron).
CREATE OR REPLACE FUNCTION cron.schedule(a text, b text, c text) RETURNS bigint LANGUAGE plpgsql AS $$
BEGIN DELETE FROM cron.job WHERE jobname = a; INSERT INTO cron.job (jobid, jobname, schedule, command) VALUES ((SELECT coalesce(max(jobid),0)+1 FROM cron.job), a, b, c); RETURN 1; END $$;
CREATE OR REPLACE FUNCTION cron.schedule(b text, c text) RETURNS bigint LANGUAGE plpgsql AS $$
BEGIN INSERT INTO cron.job (jobid, jobname, schedule, command) VALUES ((SELECT coalesce(max(jobid),0)+1 FROM cron.job), NULL, b, c); RETURN 1; END $$;
CREATE OR REPLACE FUNCTION cron.unschedule(a text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN DELETE FROM cron.job WHERE jobname = a; RETURN found; END $$;
CREATE OR REPLACE FUNCTION cron.unschedule(a bigint) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN DELETE FROM cron.job WHERE jobid = a; RETURN found; END $$;

-- ============================================================
-- Migration 001b: Extensions
-- ============================================================
-- Must load before any table that uses geometry types (runs,
-- territories, events). Runs after 001a_core_schema because
-- 'extensions' > 'core_schema' alphabetically — but profiles
-- does not use PostGIS so the dependency is satisfied.
-- ============================================================

create extension if not exists postgis;   -- geometry types, st_geomfromtext(), gist index
create extension if not exists pgcrypto;  -- gen_random_uuid(), crypt()

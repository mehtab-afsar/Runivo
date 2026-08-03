-- ============================================================
-- H-2: Stop third-party OAuth tokens being client-readable
-- ============================================================
-- device-oauth stored Garmin / COROS / Polar access_token, refresh_token and
-- token_secret as cleartext JSONB in device_connections.metadata, while
-- 20260301000043_device_connections.sql:20 granted the owner `FOR ALL` — and FOR ALL
-- includes SELECT. So the app could read its own row and lift live provider tokens
-- with a single PostgREST call, meaning any session compromise also handed over the
-- victim's Garmin/COROS/Polar account: years of continuous heart-rate, sleep and
-- location history in systems Runivo does not control.
--
-- metadata cannot simply be revoked — appleHealthService legitimately reads and
-- writes it for sync stats ({matched, created, workouts}). So the secrets move to
-- their own column that no client role can touch, and metadata stays benign.
--
-- NOTE ON GRANTS: a column-level REVOKE cannot carve an exception out of a
-- table-level grant (Postgres only lets REVOKE remove column-specific grants).
-- Supabase grants ALL on public tables to anon/authenticated by default, so the
-- table-wide privilege must be revoked first and re-granted per column.

-- ── 1. Dedicated secrets column ─────────────────────────────────────────────
ALTER TABLE public.device_connections
  ADD COLUMN IF NOT EXISTS secrets JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.device_connections.secrets IS
  'Provider OAuth tokens (access_token, refresh_token, token_secret, '
  'pending_token_secret). Service-role only — never grant to anon/authenticated. '
  'metadata is the client-visible blob; secrets is not.';

-- ── 2. Move existing tokens out of metadata ─────────────────────────────────
-- Only OAuth providers: apple_health metadata holds sync stats and must be left alone.
UPDATE public.device_connections
   SET secrets  = metadata,
       metadata = '{}'::jsonb
 WHERE device_type IN ('garmin', 'coros', 'polar')
   AND metadata <> '{}'::jsonb;

-- ── 3. Column-scoped privileges ─────────────────────────────────────────────
REVOKE ALL ON public.device_connections FROM anon;
REVOKE ALL ON public.device_connections FROM authenticated;

-- id/created_at/updated_at have defaults, so they are not needed for INSERT.
GRANT SELECT (id, user_id, device_type, status, last_sync_at, error_message,
              metadata, created_at, updated_at)
  ON public.device_connections TO authenticated;

GRANT INSERT (user_id, device_type, status, last_sync_at, error_message, metadata)
  ON public.device_connections TO authenticated;

GRANT UPDATE (status, last_sync_at, error_message, metadata)
  ON public.device_connections TO authenticated;

-- Disconnecting a device deletes the row (and with it the stored tokens).
GRANT DELETE ON public.device_connections TO authenticated;

-- ── 4. RLS still scopes those privileges to the owner's own rows ────────────
-- Replaces the FOR ALL policy with explicit per-command policies so the intent is
-- readable; the secrets column is protected by the grants above, not by RLS.
DROP POLICY IF EXISTS "owner_all" ON public.device_connections;

CREATE POLICY "device_connections: owner reads own"
  ON public.device_connections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "device_connections: owner inserts own"
  ON public.device_connections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "device_connections: owner updates own"
  ON public.device_connections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "device_connections: owner deletes own"
  ON public.device_connections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

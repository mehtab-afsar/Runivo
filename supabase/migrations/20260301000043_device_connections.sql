-- Device connections table
-- Tracks which 3rd-party fitness platforms a user has linked.

CREATE TABLE IF NOT EXISTS public.device_connections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_type   TEXT NOT NULL CHECK (device_type IN ('apple_health', 'garmin', 'coros', 'polar')),
  status        TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  last_sync_at  TIMESTAMPTZ,
  error_message TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, device_type)
);

-- RLS
ALTER TABLE public.device_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON public.device_connections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS device_connections_user_idx ON public.device_connections (user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_device_connection()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER device_connections_updated_at
  BEFORE UPDATE ON public.device_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_device_connection();

-- ── Device activity payloads ───────────────────────────────────────────────────
-- Normalised activities received from webhooks / manual sync
CREATE TABLE IF NOT EXISTS public.device_activities (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_type      TEXT        NOT NULL,
  external_id      TEXT        NOT NULL,
  activity_type    TEXT,        -- 'running' | 'cycling' | 'walking' | etc.
  started_at       TIMESTAMPTZ,
  duration_sec     INT,
  distance_m       NUMERIC,
  avg_hr           INT,
  max_hr           INT,
  avg_cadence      INT,          -- steps/min for running
  elevation_gain_m NUMERIC,
  hrv_ms           NUMERIC,      -- RMSSD in ms
  calories_kcal    INT,
  raw_payload      JSONB,
  run_id           UUID REFERENCES public.runs(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (device_type, external_id)
);

ALTER TABLE public.device_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON public.device_activities
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS device_activities_user_idx ON public.device_activities(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS device_activities_run_idx  ON public.device_activities(run_id) WHERE run_id IS NOT NULL;

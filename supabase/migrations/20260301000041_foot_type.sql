-- ── Foot arch type (from foot scan) ──────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS foot_type      TEXT,   -- 'flat' | 'neutral' | 'high'
  ADD COLUMN IF NOT EXISTS foot_scan_at   TIMESTAMPTZ;  -- when scan was done

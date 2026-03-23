-- ── Shoe tracking ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shoes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand        TEXT        NOT NULL,
  model        TEXT        NOT NULL,
  nickname     TEXT,
  category     TEXT        NOT NULL DEFAULT 'road',  -- road | trail | track | casual
  purchased_at DATE,
  max_km       NUMERIC     NOT NULL DEFAULT 700,
  is_retired   BOOLEAN     NOT NULL DEFAULT FALSE,
  is_default   BOOLEAN     NOT NULL DEFAULT FALSE,
  color        TEXT,                                 -- hex colour, e.g. '#FF6B35'
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link each run to the shoe used
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS shoe_id UUID REFERENCES public.shoes(id) ON DELETE SET NULL;

-- Materialised view: km per shoe (computed from runs)
CREATE OR REPLACE VIEW public.shoe_stats AS
SELECT
  s.id,
  s.user_id,
  s.brand,
  s.model,
  s.nickname,
  s.max_km,
  s.is_retired,
  s.is_default,
  s.color,
  COALESCE(SUM(r.distance_m) / 1000.0, 0) AS total_km,
  COUNT(r.id)                              AS total_runs,
  MAX(r.started_at)                        AS last_used_at
FROM public.shoes s
LEFT JOIN public.runs r ON r.shoe_id = s.id AND r.user_id = s.user_id
GROUP BY s.id;

-- RLS
ALTER TABLE public.shoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON public.shoes
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS shoes_user_idx ON public.shoes(user_id);

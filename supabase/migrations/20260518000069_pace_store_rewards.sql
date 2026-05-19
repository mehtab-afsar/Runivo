-- PACE Store rewards — managed via Admin CMS, read by mobile app
CREATE TABLE IF NOT EXISTS public.pace_store_rewards (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand         TEXT        NOT NULL,
  title         TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  pace_cost     INT         NOT NULL CHECK (pace_cost > 0),
  tier          TEXT        NOT NULL DEFAULT 'entry'
                  CHECK (tier IN ('entry', 'mid', 'premium')),
  brand_color   TEXT        NOT NULL DEFAULT '#534AB7',
  brand_initial TEXT        NOT NULL DEFAULT '?',
  value_label   TEXT        NOT NULL,
  category      TEXT        NOT NULL DEFAULT 'gear'
                  CHECK (category IN ('gear', 'nutrition', 'tech', 'events')),
  status        TEXT        NOT NULL DEFAULT 'available'
                  CHECK (status IN ('available', 'coming_soon', 'sold_out', 'hidden')),
  sort_order    INT         NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pace_store_rewards ENABLE ROW LEVEL SECURITY;

-- Anyone can read non-hidden rewards
CREATE POLICY "rewards_public_read" ON public.pace_store_rewards
  FOR SELECT USING (status != 'hidden');

-- Admin users can write (INSERT / UPDATE / DELETE)
CREATE POLICY "rewards_admin_all" ON public.pace_store_rewards
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND subscription_tier = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND subscription_tier = 'admin')
  );

CREATE TRIGGER rewards_updated_at
  BEFORE UPDATE ON public.pace_store_rewards
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed from current HARDCODED_REWARDS
INSERT INTO public.pace_store_rewards
  (brand, title, description, pace_cost, tier, brand_color, brand_initial, value_label, category, status, sort_order)
VALUES
  ('Brooks', '20% off Brooks Running',
   'Redeem for 20% off your next Brooks Running order. Valid on full-price items.',
   75, 'entry', '#0084D6', 'B', '20% off', 'gear', 'available', 1);

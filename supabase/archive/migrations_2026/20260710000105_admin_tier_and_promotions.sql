-- ============================================================
-- M27 (schema half): admin CMS is fully non-functional
-- ============================================================
-- apps/web/app/admin/page.tsx documents granting access via
-- `update profiles set subscription_tier = 'admin' ...`, and pace_store_rewards'
-- RLS policy (20260518000069) already checks for subscription_tier = 'admin' —
-- but the CHECK constraint (20260301000042) only allows ('free','premium'), so
-- no profile row can ever actually be 'admin' (confirmed in
-- 20260701000073_pace_ledger_diagnostic's own comment). Every admin-gated write
-- was therefore RLS-denied unconditionally. Also: `events` has SELECT (anyone)
-- and INSERT (premium) policies (20260301000028) but no UPDATE/DELETE policy at
-- all, so the admin page's event edit/delete/toggle silently no-ops. And the
-- `promotions` table the admin page manages exists in no migration — it was
-- meant to be created ad hoc per the page's own header comment.

-- ── Widen subscription_tier to allow 'admin' ─────────────────────────────────
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'premium', 'admin'));

-- ── Events: admins can update/delete any event ───────────────────────────────
DROP POLICY IF EXISTS "events: admin update" ON public.events;
CREATE POLICY "events: admin update"
  ON public.events FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND subscription_tier = 'admin')
  );

DROP POLICY IF EXISTS "events: admin delete" ON public.events;
CREATE POLICY "events: admin delete"
  ON public.events FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND subscription_tier = 'admin')
  );

-- ── Promotions table (matches apps/web/app/admin/page.tsx's PromotionsSection) ─
CREATE TABLE IF NOT EXISTS public.promotions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  subtitle     TEXT,
  image_url    TEXT,
  cta_label    TEXT,
  cta_url      TEXT,
  placement    TEXT NOT NULL DEFAULT 'home_banner',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  active_from  TIMESTAMPTZ,
  active_until TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promotions: anyone can read" ON public.promotions;
CREATE POLICY "promotions: anyone can read"
  ON public.promotions FOR SELECT USING (true);

DROP POLICY IF EXISTS "promotions: admin full access" ON public.promotions;
CREATE POLICY "promotions: admin full access"
  ON public.promotions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND subscription_tier = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND subscription_tier = 'admin')
  );

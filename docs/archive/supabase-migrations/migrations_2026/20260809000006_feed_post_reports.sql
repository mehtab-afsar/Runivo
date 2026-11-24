-- ============================================================
-- Post reporting
-- ============================================================
-- The feed's Discover tab shows strangers' posts by design, and there was no
-- way to flag one — no table, no RPC, no UI. One report per (post, reporter)
-- is enough to surface a problem; RLS deliberately grants no SELECT policy
-- to authenticated users, since reports are moderation input, not something
-- a reporter or the reported poster should be able to read back.
-- ============================================================

CREATE TABLE public.post_reports (
  id          uuid        primary key default gen_random_uuid(),
  post_id     uuid        not null references public.feed_posts(id) on delete cascade,
  reporter_id uuid        not null references public.profiles(id) on delete cascade,
  reason      text        not null check (char_length(reason) between 1 and 300),
  created_at  timestamptz not null default now(),
  unique (post_id, reporter_id)
);

CREATE INDEX post_reports_post_id_idx ON public.post_reports(post_id);

COMMENT ON TABLE public.post_reports IS 'User-filed reports on feed posts. Moderation input only — no client SELECT policy.';

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_reports: self can file"
  ON public.post_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Idempotent report — a repeat tap just no-ops instead of erroring the UI.
CREATE OR REPLACE FUNCTION public.report_post(p_post_id UUID, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.post_reports (post_id, reporter_id, reason)
  VALUES (p_post_id, auth.uid(), trim(p_reason))
  ON CONFLICT (post_id, reporter_id) DO NOTHING;
END;
$$;

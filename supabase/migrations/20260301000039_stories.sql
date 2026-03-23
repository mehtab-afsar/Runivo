-- Stories: 24-hour ephemeral run story cards
CREATE TABLE IF NOT EXISTS public.stories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  run_id      TEXT,
  image_url   TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS stories_user_id_idx  ON public.stories (user_id);
CREATE INDEX IF NOT EXISTS stories_expires_at_idx ON public.stories (expires_at);

-- Automatic cleanup: remove rows past their expiry (run via pg_cron or manual purge)
-- For now, RLS enforces visibility; stale rows can be purged periodically.

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may read non-expired stories
CREATE POLICY "stories_select" ON public.stories
  FOR SELECT TO authenticated
  USING (expires_at > NOW());

-- Users may only insert their own story rows
CREATE POLICY "stories_insert" ON public.stories
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users may only delete their own story rows
CREATE POLICY "stories_delete" ON public.stories
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ── Storage bucket ───────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('stories', 'stories', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Anyone (including unauthenticated) can view story images (public bucket)
CREATE POLICY "stories_storage_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'stories');

-- Authenticated users may upload to their own folder only
CREATE POLICY "stories_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Authenticated users may delete their own story images
CREATE POLICY "stories_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Club profile picture and cover banner.
--
-- Files live in a public bucket `club-media` at <club id>/avatar.<ext> and
-- <club id>/banner.<ext>. Anyone may view them (club pages are public); only
-- the club's owner or an admin may write, replace or remove them. The public
-- URLs are kept on the club row (avatar_url, banner_url), which the owner
-- already may update. No listing for anyone (same rule as the other buckets,
-- 20261115000019): files are reached by their URL only.

ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS clubs_image_urls_https;
ALTER TABLE public.clubs ADD CONSTRAINT clubs_image_urls_https CHECK (
  (avatar_url IS NULL OR avatar_url ~ '^https://') AND (banner_url IS NULL OR banner_url ~ '^https://')
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('club-media', 'club-media', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_edit_club_media(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN (storage.foldername(p_name))[1] !~ '^[0-9a-f-]{36}$' THEN false
    ELSE EXISTS (
      SELECT 1 FROM clubs c
       WHERE c.id = ((storage.foldername(p_name))[1])::uuid
         AND (c.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = c.id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')))
    )
  END;
$$;
REVOKE ALL ON FUNCTION public.can_edit_club_media(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_club_media(text) TO authenticated;

DROP POLICY IF EXISTS "club-media: admins write"  ON storage.objects;
DROP POLICY IF EXISTS "club-media: admins update" ON storage.objects;
DROP POLICY IF EXISTS "club-media: admins delete" ON storage.objects;
CREATE POLICY "club-media: admins write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'club-media' AND public.can_edit_club_media(name));
CREATE POLICY "club-media: admins update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'club-media' AND public.can_edit_club_media(name))
  WITH CHECK (bucket_id = 'club-media' AND public.can_edit_club_media(name));
CREATE POLICY "club-media: admins delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'club-media' AND public.can_edit_club_media(name));
-- Upsert (replace a picture) reads the existing object first.
DROP POLICY IF EXISTS "club-media: admins read own" ON storage.objects;
CREATE POLICY "club-media: admins read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'club-media' AND public.can_edit_club_media(name));

-- Activity photos are private (security audit H5).
--
-- The `feed` bucket was public and listable: anyone with the project URL could
-- list every runner's folder and download every activity photo, including
-- photos on "Only you" and "Followers" activities. Now:
--   • the bucket is private; the app reads photos through short-lived signed
--     links (signPhotoUrls), and storage signs a link only when this policy
--     lets the viewer read the object;
--   • a photo at {owner}/{run}/{name} is readable by its owner, and by anyone
--     who may see that run's post (can_view_post: audience, follows, blocks).
-- The app also strips GPS and camera data from every photo before upload.
--
-- `stories` had the same public read; the story reel was removed (F7), so it is
-- owner-only until stories return.
--
-- `user-media` (gear photos) was used by the app but never created, so shoe
-- photos never saved. Created here: public read (a shoe photo carries no
-- location once stripped), writes only inside the runner's own folder.

UPDATE storage.buckets SET public = false WHERE id IN ('feed', 'stories');

DROP POLICY IF EXISTS "feed: public read" ON storage.objects;
DROP POLICY IF EXISTS "feed: readable with the post" ON storage.objects;
CREATE POLICY "feed: readable with the post" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'feed'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.feed_posts fp
        WHERE fp.run_id::text = (storage.foldername(name))[2]
          AND fp.user_id::text = (storage.foldername(name))[1]
          AND public.can_view_post(auth.uid(), fp.user_id, fp.visibility)
      )
    )
  );

DROP POLICY IF EXISTS "stories_storage_select" ON storage.objects;
CREATE POLICY "stories_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-media', 'user-media', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "user-media: public read" ON storage.objects;
CREATE POLICY "user-media: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'user-media');
DROP POLICY IF EXISTS "user-media: owner write" ON storage.objects;
CREATE POLICY "user-media: owner write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "user-media: owner update" ON storage.objects;
CREATE POLICY "user-media: owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "user-media: owner delete" ON storage.objects;
CREATE POLICY "user-media: owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);

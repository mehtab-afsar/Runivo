-- ============================================================
-- Stop the photo buckets being listable by anyone (audit H5, first part).
--
-- `avatars`, `feed` and `stories` are public buckets: a file is served to anyone
-- who has its URL, and that is how the app shows them (getPublicUrl), so serving
-- is not governed by these policies. But the SELECT policies were `using
-- (bucket_id = ...)` with no role, which also let ANYONE (including signed-out
-- callers with only the public anon key) list the bucket through the storage
-- API and read every runner's user id, run id and file name. Listing is now limited
-- to a runner's own folder, which is also all the app's own upload, replace and
-- delete calls need.
--
-- NOT fixed here, and still open: a photo on a private or followers-only activity
-- is readable by anyone who obtains its URL. File names are random and nothing
-- lists them any more, so the URL is not guessable, but it is not access-checked
-- either. Closing that means private buckets with signed URLs checked against post
-- visibility, which changes how every photo is displayed; see docs/AUDIT_2026-11.md.
-- ============================================================

DROP POLICY IF EXISTS "avatars: public read"      ON storage.objects;
DROP POLICY IF EXISTS "feed: public read"         ON storage.objects;
DROP POLICY IF EXISTS "stories_storage_select"    ON storage.objects;

CREATE POLICY "avatars: owner can list" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "feed: owner can list" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'feed' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "stories: owner can list" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

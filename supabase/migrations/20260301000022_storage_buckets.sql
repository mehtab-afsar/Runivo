-- ============================================================
-- Migration 022: Storage Buckets
-- ============================================================
-- Creates Supabase Storage buckets for user-uploaded media.
-- avatars  — public, profile pictures
-- feed     — public, run post photos
-- ============================================================

-- Create buckets (idempotent)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true,  5242880,  array['image/jpeg','image/png','image/webp','image/gif']),
  ('feed',    'feed',    true,  10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

-- ----------------------------------------------------------------
-- RLS: avatars bucket
-- ----------------------------------------------------------------
-- Anyone can read (public bucket)
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Only the owner can upload/replace their own avatar
create policy "avatars: owner upload"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: owner update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ----------------------------------------------------------------
-- RLS: feed bucket
-- ----------------------------------------------------------------
create policy "feed: public read"
  on storage.objects for select
  using (bucket_id = 'feed');

create policy "feed: owner upload"
  on storage.objects for insert
  with check (
    bucket_id = 'feed'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "feed: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'feed'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

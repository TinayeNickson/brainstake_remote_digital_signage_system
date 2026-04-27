-- ============================================================================
-- v14: Fix fallback-media storage policies
--
-- v4 policies called current_role_v() inside storage RLS, which is unreliable.
-- Replace with auth.role() = 'authenticated' checks matching the ad-media pattern.
-- Admin role check uses current_role_v() only on the table row policies (fine),
-- but for storage we check authenticated + role via a subquery that is stable.
-- ============================================================================

drop policy if exists "fallback-media public read"  on storage.objects;
drop policy if exists "fallback-media admin write"  on storage.objects;
drop policy if exists "fallback-media admin delete" on storage.objects;

-- Anyone can read (bucket is public, content is non-sensitive)
create policy "fallback-media public read" on storage.objects
  for select using (bucket_id = 'fallback-media');

-- Only authenticated admins can upload
create policy "fallback-media admin write" on storage.objects
  for insert with check (
    bucket_id = 'fallback-media'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Only authenticated admins can update
create policy "fallback-media admin update" on storage.objects
  for update using (
    bucket_id = 'fallback-media'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Only authenticated admins can delete
create policy "fallback-media admin delete" on storage.objects
  for delete using (
    bucket_id = 'fallback-media'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

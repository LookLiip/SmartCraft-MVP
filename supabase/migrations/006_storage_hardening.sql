-- Migration 006: Storage Hardening and Enhanced RLS for Photos
-- This migration ensures high-resolution images are secure and accessible to the right roles.

-- 1. Ensure Storage Buckets exist (Safe to run multiple times if using upsert logic or checking)
-- Note: In a real Supabase environment, these are often created via the dashboard or a setup script.
-- Here we define the RLS policies for them.

-- 2. Storage RLS Policies for 'photos-internal'
-- Path: {org_id}/reports/{report_id}/photos/internal/{photo_id}.jpg

CREATE POLICY "Admins can do everything in internal photos"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'photos-internal' AND
  (storage.foldername(name))[1] = (SELECT organization_id::text FROM public.users WHERE id = auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('admin', 'owner')
  )
);

CREATE POLICY "Workers can upload to internal photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos-internal' AND
  (storage.foldername(name))[1] = (SELECT organization_id::text FROM public.users WHERE id = auth.uid())
);

CREATE POLICY "Workers can view their own internal photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'photos-internal' AND
  (storage.foldername(name))[1] = (SELECT organization_id::text FROM public.users WHERE id = auth.uid()) AND
  owner = auth.uid()
);

-- 3. Storage RLS Policies for 'photos-client-facing'
-- Path: {org_id}/reports/{report_id}/photos/client_facing/{photo_id}.jpg

CREATE POLICY "Org users can view client-facing photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'photos-client-facing' AND
  (storage.foldername(name))[1] = (SELECT organization_id::text FROM public.users WHERE id = auth.uid())
);

CREATE POLICY "Org users can upload client-facing photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos-client-facing' AND
  (storage.foldername(name))[1] = (SELECT organization_id::text FROM public.users WHERE id = auth.uid())
);

-- 4. Fix Database RLS for 'photos' table
-- The previous policy in 002 was too restrictive for workers during drafting.

DROP POLICY IF EXISTS "photos_client_facing_all_org" ON photos;
DROP POLICY IF EXISTS "photos_internal_admin_only" ON photos;

-- SELECT: Admins see all, Workers see client_facing OR their own
CREATE POLICY "photos_select_policy" ON photos
  FOR SELECT USING (
    auth.uid() IN (
      SELECT u.id FROM users u
      JOIN reports r ON r.organization_id = u.organization_id
      WHERE photos.report_id = r.id
      AND (
        u.role IN ('admin', 'owner') OR 
        photos.visibility = 'client_facing' OR
        photos.created_by = auth.uid()
      )
    )
  );

-- INSERT: Anyone in org can insert if report belongs to org
CREATE POLICY "photos_insert_policy" ON photos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM reports r
      JOIN users u ON u.organization_id = r.organization_id
      WHERE r.id = photos.report_id AND u.id = auth.uid()
    )
  );

-- UPDATE/DELETE: Admins or Creator
CREATE POLICY "photos_update_delete_policy" ON photos
  FOR ALL USING (
    auth.uid() IN (
      SELECT u.id FROM users u
      JOIN reports r ON r.organization_id = u.organization_id
      WHERE photos.report_id = r.id
      AND (u.role IN ('admin', 'owner') OR photos.created_by = auth.uid())
    )
  );

-- 5. Optimization: Add indexes for better performance on large datasets
CREATE INDEX IF NOT EXISTS idx_photos_visibility ON photos(visibility);
CREATE INDEX IF NOT EXISTS idx_photos_created_by ON photos(created_by);

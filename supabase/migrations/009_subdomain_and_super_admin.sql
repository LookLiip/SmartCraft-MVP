-- Migration 009: Subdomain Multi-Tenancy & Super Admin
-- This migration adds tenant slugs, super admin roles, and updates RLS for isolation.

-- 1. Add slug to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- 2. Add is_super_admin to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- 3. Elevation: Make the first 'owner' a super admin
UPDATE users 
SET is_super_admin = true 
WHERE role = 'owner' 
AND created_at = (SELECT MIN(created_at) FROM users WHERE role = 'owner');

-- 4. New helper function for Super Admin check
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND is_super_admin = true
    AND deleted_at IS NULL
  );
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update RLS Policies to respect Super Admin bypass and organization isolation

-- Organizations
DROP POLICY IF EXISTS "org_users_full_access" ON organizations;
DROP POLICY IF EXISTS "org_users_full_access_v2" ON organizations;
CREATE POLICY "org_access_policy" ON organizations
  FOR ALL USING (
    is_super_admin() OR 
    id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Users
DROP POLICY IF EXISTS "users_select_self" ON users;
DROP POLICY IF EXISTS "users_select_org" ON users;
DROP POLICY IF EXISTS "users_insert_admin" ON users;
DROP POLICY IF EXISTS "users_update_admin" ON users;
DROP POLICY IF EXISTS "users_update_self" ON users;
DROP POLICY IF EXISTS "org_users_access" ON users;

CREATE POLICY "users_all_policy" ON users
  FOR ALL USING (
    is_super_admin() OR 
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Reports
DROP POLICY IF EXISTS "org_users_reports_access" ON reports;
CREATE POLICY "reports_all_policy" ON reports
  FOR ALL USING (
    is_super_admin() OR 
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Report Entries
DROP POLICY IF EXISTS "org_users_entries_access" ON report_entries;
CREATE POLICY "report_entries_all_policy" ON report_entries
  FOR ALL USING (
    is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM reports r
      WHERE r.id = report_entries.report_id
      AND r.organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

-- Photos
DROP POLICY IF EXISTS "org_users_photos_access" ON photos;
CREATE POLICY "photos_all_policy" ON photos
  FOR ALL USING (
    is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM reports r
      WHERE r.id = photos.report_id
      AND r.organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

-- Materials
DROP POLICY IF EXISTS "org_users_materials_access" ON materials;
CREATE POLICY "materials_all_policy" ON materials
  FOR ALL USING (
    is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM reports r
      WHERE r.id = materials.report_id
      AND r.organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

-- Signatures
DROP POLICY IF EXISTS "org_users_signatures_access" ON signatures;
CREATE POLICY "signatures_all_policy" ON signatures
  FOR ALL USING (
    is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM reports r
      WHERE r.id = signatures.report_id
      AND r.organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

-- Invitations
DROP POLICY IF EXISTS "invitations_select_admin" ON user_invitations;
DROP POLICY IF EXISTS "invitations_insert_admin" ON user_invitations;
DROP POLICY IF EXISTS "invitations_delete_admin" ON user_invitations;
CREATE POLICY "invitations_all_policy" ON user_invitations
  FOR ALL USING (
    is_super_admin() OR 
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

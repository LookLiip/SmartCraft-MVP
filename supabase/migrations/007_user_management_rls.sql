-- Migration 007: User Management Security & Admin Helpers
-- This migration secures the 'users' table and provides helper functions for management.

-- 1. Add deleted_at for soft deletion (GDPR compliance)
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Create Invitations Table
CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('worker', 'admin', 'owner')),
  invited_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(organization_id, email)
);

-- Enable RLS on Invitations
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- 3. Refine helper functions (ensure they handle deleted_at)
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM users 
  WHERE id = auth.uid() 
  AND deleted_at IS NULL 
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'owner')
    AND deleted_at IS NULL
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. Update Users RLS Policies
DROP POLICY IF EXISTS "users_view_self" ON users;
DROP POLICY IF EXISTS "users_view_org" ON users;
DROP POLICY IF EXISTS "users_view_org_v2" ON users;
DROP POLICY IF EXISTS "org_users_access" ON users;

CREATE POLICY "users_select_self" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_select_org" ON users
  FOR SELECT USING (
    organization_id = get_user_org_id() AND 
    deleted_at IS NULL
  );

CREATE POLICY "users_insert_admin" ON users
  FOR INSERT WITH CHECK (
    is_admin() AND 
    organization_id = get_user_org_id()
  );

CREATE POLICY "users_update_admin" ON users
  FOR UPDATE USING (
    is_admin() AND 
    organization_id = get_user_org_id() AND
    deleted_at IS NULL
  )
  WITH CHECK (
    organization_id = get_user_org_id()
  );

CREATE POLICY "users_update_self" ON users
  FOR UPDATE USING (auth.uid() = id AND deleted_at IS NULL)
  WITH CHECK (
    auth.uid() = id AND 
    role = role AND 
    organization_id = organization_id
  );

-- 5. Invitations Policies
CREATE POLICY "invitations_select_admin" ON user_invitations
  FOR SELECT USING (is_admin() AND organization_id = get_user_org_id());

CREATE POLICY "invitations_insert_admin" ON user_invitations
  FOR INSERT WITH CHECK (is_admin() AND organization_id = get_user_org_id());

CREATE POLICY "invitations_delete_admin" ON user_invitations
  FOR DELETE USING (is_admin() AND organization_id = get_user_org_id());

-- 6. Secure the handle_new_user trigger & Handle Invitations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invite_org_id UUID;
  invite_role TEXT;
BEGIN
  -- Check if there is a pending invitation for this email
  SELECT organization_id, role INTO invite_org_id, invite_role
  FROM user_invitations
  WHERE email = NEW.email AND accepted_at IS NULL
  LIMIT 1;

  INSERT INTO public.users (id, email, full_name, role, organization_id)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 
    COALESCE(invite_role, 'worker'),
    invite_org_id
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    organization_id = COALESCE(invite_org_id, users.organization_id),
    role = COALESCE(invite_role, users.role);

  -- Mark invitation as accepted
  IF invite_org_id IS NOT NULL THEN
    UPDATE user_invitations SET accepted_at = now() WHERE email = NEW.email;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Update Organizations Policy to use get_user_org_id()
DROP POLICY IF EXISTS "org_users_full_access" ON organizations;
CREATE POLICY "org_users_full_access_v2" ON organizations
  FOR ALL USING (id = get_user_org_id());

-- Migration 005: Organization Settings for Letterhead
-- Add fields for custom letterhead and margins

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS letterhead_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS margin_top DECIMAL(5,2) DEFAULT 20.00;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS margin_bottom DECIMAL(5,2) DEFAULT 20.00;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS margin_left DECIMAL(5,2) DEFAULT 20.00;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS margin_right DECIMAL(5,2) DEFAULT 20.00;

-- Update RLS policy for organizations to use the helper function
-- This ensures that users can only access their own organization's settings
DROP POLICY IF EXISTS "org_users_full_access" ON organizations;
CREATE POLICY "org_organizations_access_v3" ON organizations
  FOR ALL USING (id = get_user_org_id());

-- Document: Create 'letterheads' bucket in Supabase Storage
-- bucket_id: 'letterheads'
-- public: true (or false with proper RLS)

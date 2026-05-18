-- Migration 004: Fix RLS Recursion and User Sync
-- This migration fixes the 500 errors caused by recursive RLS policies

-- 1. Fix Users Table Policies (Avoid Recursion)
DROP POLICY IF EXISTS "org_users_access" ON users;

CREATE POLICY "users_view_self" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_view_org" ON users
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid() LIMIT 1)
  );
-- Note: Subqueries in USING are generally safe from recursion in Postgres if they refer to the same table 
-- but only if they don't trigger the same policy. However, Supabase/PostgREST can sometimes struggle.
-- A better way is using a function.

-- 2. Create helper function for organization access
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

DROP POLICY IF EXISTS "users_view_org" ON users;
CREATE POLICY "users_view_org_v2" ON users
  FOR SELECT USING (organization_id = get_user_org_id());

-- 3. Fix Reports Table Policies
DROP POLICY IF EXISTS "org_users_reports_active" ON reports;
DROP POLICY IF EXISTS "org_users_reports_access" ON reports;

CREATE POLICY "reports_org_access_v2" ON reports
  FOR ALL USING (
    deleted_at IS NULL AND 
    organization_id = get_user_org_id()
  );

-- 4. Fix Report Entries Table Policies
DROP POLICY IF EXISTS "org_users_entries_access" ON report_entries;
CREATE POLICY "entries_org_access_v2" ON report_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM reports 
      WHERE reports.id = report_entries.report_id 
      AND reports.organization_id = get_user_org_id()
    )
  );

-- 5. User Sync Trigger (GDPR compliance - ensure every auth user has a public profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'worker')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 010_fix_rls_infinite_recursion.sql
-- Fixes "infinite recursion detected in policy for relation users" (Postgres error 42P17).
--
-- Root cause: several tables carried an "*_all_policy" whose USING expression contained a
-- self-referential subquery over `users`:
--   (SELECT users.organization_id FROM users WHERE users.id = auth.uid())
-- Because `users` itself had RLS enabled and a policy (`users_all_policy`) that also
-- subqueries `users`, evaluating any of these policies recursed infinitely and made every
-- client-side (RLS-governed) request return HTTP 500.
--
-- Fix: drop the recursive "*_all_policy" policies and replace the ones that would otherwise
-- leave a table unreadable, using the SECURITY DEFINER helper get_user_org_id() instead of a
-- raw subquery on `users`. Helper functions get_user_org_id(), is_admin(), is_super_admin()
-- are all SECURITY DEFINER and therefore do NOT recurse.

-- Drop the recursive self/cross-referential policies.
DROP POLICY IF EXISTS "users_all_policy" ON public.users;
DROP POLICY IF EXISTS "reports_all_policy" ON public.reports;
DROP POLICY IF EXISTS "materials_all_policy" ON public.materials;
DROP POLICY IF EXISTS "report_entries_all_policy" ON public.report_entries;
DROP POLICY IF EXISTS "photos_all_policy" ON public.photos;
DROP POLICY IF EXISTS "signatures_all_policy" ON public.signatures;
DROP POLICY IF EXISTS "invitations_all_policy" ON public.user_invitations;
DROP POLICY IF EXISTS "org_access_policy" ON public.organizations;

-- Replacements for tables that had no other usable (non-recursive) policy.
CREATE POLICY "materials_org_access" ON public.materials FOR ALL
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = materials.report_id
      AND r.organization_id = get_user_org_id()
  ))
  WITH CHECK (is_super_admin() OR EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = materials.report_id
      AND r.organization_id = get_user_org_id()
  ));

CREATE POLICY "signatures_org_access" ON public.signatures FOR ALL
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = signatures.report_id
      AND r.organization_id = get_user_org_id()
  ))
  WITH CHECK (is_super_admin() OR EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = signatures.report_id
      AND r.organization_id = get_user_org_id()
  ));

CREATE POLICY "invitations_org_access" ON public.user_invitations FOR ALL
  USING (is_super_admin() OR organization_id = get_user_org_id())
  WITH CHECK (is_super_admin() OR organization_id = get_user_org_id());

CREATE POLICY "organizations_org_access" ON public.organizations FOR ALL
  USING (is_super_admin() OR id = get_user_org_id())
  WITH CHECK (is_super_admin() OR id = get_user_org_id());

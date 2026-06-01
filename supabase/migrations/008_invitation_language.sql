-- Migration 008: Add native_language to invitations
-- This migration adds native_language to the user_invitations table and updates the handle_new_user trigger.

-- 1. Add native_language to user_invitations
ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS native_language TEXT DEFAULT 'de';

-- 2. Update the handle_new_user trigger to include native_language
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invite_org_id UUID;
  invite_role TEXT;
  invite_lang TEXT;
BEGIN
  -- Check if there is a pending invitation for this email
  SELECT organization_id, role, native_language INTO invite_org_id, invite_role, invite_lang
  FROM user_invitations
  WHERE email = NEW.email AND accepted_at IS NULL
  LIMIT 1;

  INSERT INTO public.users (id, email, full_name, role, organization_id, native_language)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 
    COALESCE(invite_role, NEW.raw_user_meta_data->>'role', 'worker'),
    COALESCE(invite_org_id, (NEW.raw_user_meta_data->>'organization_id')::UUID),
    COALESCE(invite_lang, NEW.raw_user_meta_data->>'native_language', 'de')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    organization_id = COALESCE(invite_org_id, (NEW.raw_user_meta_data->>'organization_id')::UUID, users.organization_id),
    role = COALESCE(invite_role, NEW.raw_user_meta_data->>'role', users.role),
    native_language = COALESCE(invite_lang, NEW.raw_user_meta_data->>'native_language', EXCLUDED.native_language, users.native_language);

  -- Mark invitation as accepted
  IF invite_org_id IS NOT NULL THEN
    UPDATE user_invitations SET accepted_at = now() WHERE email = NEW.email;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

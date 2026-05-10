-- Migration 002: GDPR Remediation
-- Adds deleted_at columns, IP hashing, enhanced RLS, and audit trail

-- 1. Add deleted_at to all personal-data tables (soft delete for GDPR erasure)
ALTER TABLE signatures ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE photos ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN deleted_at TIMESTAMPTZ;

-- 2. Create audit log for data access (GDPR accountability)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,  -- 'read', 'create', 'update', 'delete', 'export'
  table_name TEXT NOT NULL,
  record_id UUID,
  ip_address_hash TEXT,  -- SHA-256 hash, never raw IP
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
CREATE INDEX idx_audit_log_table ON audit_log(table_name);

-- 3. Replace raw IP storage with hashed IP (signature_ip_hash)
-- Drop old column and add new hashed one
ALTER TABLE signatures DROP COLUMN IF EXISTS ip_address;
ALTER TABLE signatures ADD COLUMN signature_ip_hash TEXT;  -- SHA-256 of IP

-- 4. Enhanced RLS: Add role-based filter for internal photos
-- Workers can only see client_facing photos; admins can see all
DROP POLICY IF EXISTS "org_users_photos_access" ON photos;
CREATE POLICY "photos_client_facing_all_org" ON photos
  FOR SELECT USING (
    visibility = 'client_facing'
    AND auth.uid() IN (
      SELECT id FROM users u
      JOIN reports r ON r.organization_id = u.organization_id
      WHERE photos.report_id = r.id
    )
  );

CREATE POLICY "photos_internal_admin_only" ON photos
  FOR ALL USING (
    visibility = 'internal'
    AND auth.uid() IN (
      SELECT id FROM users u
      JOIN reports r ON r.organization_id = u.organization_id
      WHERE photos.report_id = r.id
      AND u.role IN ('admin', 'owner')
    )
  );

-- 5. Signatures: admins and owner only (no workers)
DROP POLICY IF EXISTS "org_users_signatures_access" ON signatures;
CREATE POLICY "signatures_admin_only" ON signatures
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM users u
      JOIN reports r ON r.organization_id = u.organization_id
      WHERE signatures.report_id = r.id
      AND u.role IN ('admin', 'owner')
    )
  );

-- 6. Soft-delete trigger for signatures
CREATE OR REPLACE FUNCTION soft_delete_record()
RETURNS TRIGGER AS $$
BEGIN
  NEW.deleted_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER soft_delete_signatures
  BEFORE UPDATE ON signatures
  FOR EACH ROW EXECUTE FUNCTION soft_delete_record();

-- 7. Add is_deleted filter to existing RLS policies (reports)
DROP POLICY IF EXISTS "org_users_reports_access" ON reports;
CREATE POLICY "org_users_reports_active" ON reports
  FOR ALL USING (
    deleted_at IS NULL
    AND auth.uid() IN (SELECT id FROM users WHERE organization_id = reports.organization_id)
  );

-- 8. Add retention policy function (GDPR: 30-day after deletion)
CREATE OR REPLACE FUNCTION purge_expired_records()
RETURNS void AS $$
BEGIN
  -- Hard delete records soft-deleted more than 30 days ago
  DELETE FROM signatures WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM photos WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM reports WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  -- Users/organizations: only hard-delete if no active reports remain
  DELETE FROM users u
  WHERE u.deleted_at IS NOT NULL
    AND u.deleted_at < now() - interval '30 days'
    AND NOT EXISTS (SELECT 1 FROM reports WHERE created_by = u.id AND deleted_at IS NULL);
  DELETE FROM organizations o
  WHERE o.deleted_at IS NOT NULL
    AND o.deleted_at < now() - interval '30 days'
    AND NOT EXISTS (SELECT 1 FROM users WHERE organization_id = o.id);
END;
$$ language 'plpgsql';

-- 9. Consent log table for voice recording consent tracking
CREATE TABLE IF NOT EXISTS consent_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('voice_recording', 'photo_capture', 'data_processing')),
  granted BOOLEAN NOT NULL DEFAULT true,
  ip_address_hash TEXT,  -- SHA-256 hash
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_consent_log_user ON consent_log(user_id);
CREATE INDEX idx_consent_log_type ON consent_log(consent_type);

-- 10. Storage lifecycle policy comment (run in Supabase Dashboard > Storage)
-- This is documentation only - lifecycle policies must be set via Supabase Dashboard or API
-- For audio bucket: set lifecycle rule to delete objects older than 24 hours
COMMENT ON TABLE signatures IS 'Biometric data (signature). deleted_at enables GDPR right-to-erasure soft-delete. IP stored as SHA-256 hash only.';
COMMENT ON TABLE photos IS 'Work site photos. visibility column separates internal proof from client-facing. deleted_at enables GDPR erasure.';
COMMENT ON TABLE consent_log IS 'Tracks user consent for voice recording, photo capture, and general data processing per GDPR Article 7.';
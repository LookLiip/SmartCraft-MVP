-- SmartCraft Database Schema
-- Supabase PostgreSQL Migration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  business_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('worker', 'admin', 'owner')),
  native_language TEXT NOT NULL DEFAULT 'de',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  site_name TEXT NOT NULL,
  site_address TEXT,
  client_name TEXT,
  client_email TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'approved', 'exported')),
  original_transcription TEXT,
  translated_text TEXT,
  refined_text TEXT,
  work_date DATE NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Report Entries (line items within a report)
CREATE TABLE report_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  sequence_order INT NOT NULL DEFAULT 0,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('work_done', 'issue', 'note', 'material_used')),
  original_text TEXT NOT NULL,
  translated_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Photos
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('internal', 'client_facing')),
  caption_original TEXT,
  caption_translated TEXT,
  file_size_bytes INT,
  width INT,
  height INT,
  taken_at TIMESTAMPTZ DEFAULT now(),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- Materials
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  name_original TEXT NOT NULL,
  name_translated TEXT,
  quantity DECIMAL(10,2),
  unit TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Signatures
CREATE TABLE signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  signer_role TEXT NOT NULL CHECK (signer_role IN ('worker', 'client')),
  signer_name TEXT NOT NULL,
  signature_data TEXT NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);

-- Indexes
CREATE INDEX idx_reports_organization ON reports(organization_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_by ON reports(created_by);
CREATE INDEX idx_report_entries_report ON report_entries(report_id);
CREATE INDEX idx_photos_report ON photos(report_id);
CREATE INDEX idx_materials_report ON materials(report_id);
CREATE INDEX idx_signatures_report ON signatures(report_id);

-- Row-Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;

-- Policies: All data scoped to organization
CREATE POLICY "org_users_full_access" ON organizations
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE organization_id = organizations.id));

CREATE POLICY "org_users_access" ON users
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE organization_id = users.organization_id));

CREATE POLICY "org_users_reports_access" ON reports
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE organization_id = reports.organization_id));

CREATE POLICY "org_users_entries_access" ON report_entries
  FOR ALL USING (auth.uid() IN (
    SELECT id FROM users u 
    JOIN reports r ON r.organization_id = u.organization_id 
    WHERE report_entries.report_id = r.id
  ));

CREATE POLICY "org_users_photos_access" ON photos
  FOR ALL USING (auth.uid() IN (
    SELECT id FROM users u 
    JOIN reports r ON r.organization_id = u.organization_id 
    WHERE photos.report_id = r.id
  ));

CREATE POLICY "org_users_materials_access" ON materials
  FOR ALL USING (auth.uid() IN (
    SELECT id FROM users u 
    JOIN reports r ON r.organization_id = u.organization_id 
    WHERE materials.report_id = r.id
  ));

CREATE POLICY "org_users_signatures_access" ON signatures
  FOR ALL USING (auth.uid() IN (
    SELECT id FROM users u 
    JOIN reports r ON r.organization_id = u.organization_id 
    WHERE signatures.report_id = r.id
  ));

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage buckets (run via Supabase dashboard or CLI)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
-- VALUES ('photos-internal', 'photos-internal', false, 10485760, NULL);
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
-- VALUES ('photos-client-facing', 'photos-client-facing', false, 10485760, NULL);
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
-- VALUES ('signatures', 'signatures', false, 1048576, NULL);
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
-- VALUES ('audio', 'audio', false, 10485760, NULL);
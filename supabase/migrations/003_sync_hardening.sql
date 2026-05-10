-- Migration 003: Sync Engine Hardening
-- Adds versioning and updated_at for conflict resolution

-- 1. Add version column to all synced tables
ALTER TABLE reports ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE report_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE report_entries ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE materials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE materials ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE photos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE photos ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE signatures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- 2. Add triggers for auto-updating updated_at
CREATE TRIGGER update_report_entries_updated_at BEFORE UPDATE ON report_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_photos_updated_at BEFORE UPDATE ON photos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_signatures_updated_at BEFORE UPDATE ON signatures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Add function to increment version on update
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER increment_reports_version BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION increment_version();

CREATE TRIGGER increment_report_entries_version BEFORE UPDATE ON report_entries
  FOR EACH ROW EXECUTE FUNCTION increment_version();

CREATE TRIGGER increment_materials_version BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION increment_version();

CREATE TRIGGER increment_photos_version BEFORE UPDATE ON photos
  FOR EACH ROW EXECUTE FUNCTION increment_version();

CREATE TRIGGER increment_signatures_version BEFORE UPDATE ON signatures
  FOR EACH ROW EXECUTE FUNCTION increment_version();

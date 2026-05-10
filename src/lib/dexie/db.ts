import Dexie, { type Table } from 'dexie';

export interface OfflineReport {
  id: string;
  organization_id: string;
  created_by: string;
  site_name: string;
  site_address?: string;
  client_name?: string;
  client_email?: string;
  status: 'draft' | 'pending_review' | 'approved' | 'exported';
  work_date: string;
  started_at: string;
  created_at: string;
  updated_at: string; // server-side
  local_updated_at: string; // LOCAL
  version: number;
  is_synced: number;
  // GDPR: soft-delete for offline records
  deleted_at?: string;
}

export interface OfflinePhoto {
  id: string;
  report_id: string;
  file: Blob;
  visibility: 'internal' | 'client_facing';
  caption?: string;
  taken_at: string;
  updated_at: string;
  version: number;
  is_synced: number;
  // GDPR: soft-delete for offline records
  deleted_at?: string;
}

export interface OfflineSignature {
  id: string;
  report_id: string;
  signature_data: string;
  signer_role: 'worker' | 'client';
  signer_name: string;
  signed_at: string;
  updated_at: string;
  version: number;
  is_synced: number;
  // GDPR: soft-delete for offline records (biometric data)
  deleted_at?: string;
}

export interface OfflineEntry {
  id: string;
  report_id: string;
  sequence_order: number;
  entry_type: 'work_done' | 'issue' | 'note' | 'material_used';
  original_text: string;
  translated_text?: string;
  created_at: string;
  updated_at: string;
  local_updated_at: string; // LOCAL
  version: number;
  is_synced: number;
  deleted_at?: string;
}

export interface OfflineMaterial {
  id: string;
  report_id: string;
  name_original: string;
  name_translated?: string;
  quantity: number;
  unit?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  local_updated_at: string; // LOCAL
  version: number;
  is_synced: number;
  deleted_at?: string;
}

// Audit log for offline sync events
export interface OfflineAuditEntry {
  id: string;
  action: 'sync_success' | 'sync_failure' | 'sync_skipped' | 'conflict_server_kept' | 'deletion_success' | 'deletion_failed' | 'delete';
  table_name: string;
  record_id: string;
  synced_at: string;
  error_message?: string;
  metadata?: any;
}

// Queue for failed deletions (G-10)
export interface PendingDeletion {
  id: string;
  bucket: string;
  path: string;
  created_at: string;
  retry_count: number;
}

export class SmartCraftDB extends Dexie {
  reports!: Table<OfflineReport>;
  photos!: Table<OfflinePhoto>;
  signatures!: Table<OfflineSignature>;
  entries!: Table<OfflineEntry>;
  materials!: Table<OfflineMaterial>;
  audit_log!: Table<OfflineAuditEntry>;
  pending_deletions!: Table<PendingDeletion>;

  constructor() {
    super('SmartCraftDB');
    this.version(4).stores({
      reports: 'id, organization_id, status, is_synced, local_updated_at, deleted_at',
      photos: 'id, report_id, is_synced, deleted_at',
      signatures: 'id, report_id, is_synced, deleted_at',
      entries: 'id, report_id, is_synced, local_updated_at, deleted_at',
      materials: 'id, report_id, is_synced, local_updated_at, deleted_at',
      audit_log: 'id, table_name, synced_at',
      pending_deletions: 'id, bucket, created_at',
    });
  }
}

export const db = new SmartCraftDB();

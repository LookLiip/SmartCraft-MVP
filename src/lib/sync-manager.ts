import { createClient } from './supabase/client';
import { db, type OfflineReport, type OfflineEntry, type OfflineMaterial } from './dexie/db';

type ConflictStrategy = 'server_wins' | 'client_wins';

export class SyncManager {
  private static instance: SyncManager;
  private syncing = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.sync());
    }
  }

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  public async sync() {
    if (this.syncing || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    this.syncing = true;
    console.log('Starting sync...');
    
    try {
      await this.processPendingDeletions();
      await this.syncReports();
      await this.syncEntries();
      await this.syncMaterials();
      await this.syncPhotos();
      await this.syncSignatures();
      await this.cleanup();
      console.log('Sync completed successfully.');
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.syncing = false;
    }
  }

  /**
   * GDPR Data Minimization & Cleanup
   */
  private async cleanup() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const isoString = sevenDaysAgo.toISOString();

    try {
      // Delete records soft-deleted more than 7 days ago
      await db.reports.where('deleted_at').below(isoString).delete();
      await db.photos.where('deleted_at').below(isoString).delete();
      await db.signatures.where('deleted_at').below(isoString).delete();

      // Delete old synced records
      const syncedReports = await db.reports.where('is_synced').equals(1).toArray();
      for (const r of syncedReports) {
        if (r.local_updated_at < isoString) await db.reports.delete(r.id);
      }
      
      const syncedEntries = await db.entries.where('is_synced').equals(1).toArray();
      for (const e of syncedEntries) {
        if (e.local_updated_at < isoString) await db.entries.delete(e.id);
      }

      const syncedMaterials = await db.materials.where('is_synced').equals(1).toArray();
      for (const m of syncedMaterials) {
        if (m.local_updated_at < isoString) await db.materials.delete(m.id);
      }
      
      console.log('Cleanup of old records completed.');
    } catch (err) {
      console.error('Cleanup failed:', err);
    }
  }

  /**
   * Queue a file for deletion from Supabase Storage (Issue G-10)
   */
  public async queueDeletion(bucket: string, path: string) {
    await db.pending_deletions.add({
      id: crypto.randomUUID(),
      bucket,
      path,
      created_at: new Date().toISOString(),
      retry_count: 0
    });
    // Try processing immediately
    this.processPendingDeletions();
  }

  private async processPendingDeletions() {
    const pending = await db.pending_deletions.toArray();
    if (pending.length === 0) return;

    const supabase = createClient();
    for (const item of pending) {
      if (item.retry_count >= 3) {
        await this.logAudit('deletion_failed', item.bucket, item.path, 'Max retries exceeded');
        await db.pending_deletions.delete(item.id);
        continue;
      }

      try {
        const { error } = await supabase.storage.from(item.bucket).remove([item.path]);
        if (!error || error.message?.includes('not found')) {
          await db.pending_deletions.delete(item.id);
          await this.logAudit('deletion_success', item.bucket, item.path);
        } else {
          await db.pending_deletions.update(item.id, { retry_count: item.retry_count + 1 });
        }
      } catch (err) {
        await db.pending_deletions.update(item.id, { retry_count: item.retry_count + 1 });
      }
    }
  }

  private async syncReports() {
    const pendingReports = await db.reports.where('is_synced').equals(0).toArray();
    const supabase = createClient();

    for (const local of pendingReports) {
      const { data: serverRecord, error: fetchError } = await supabase
        .from('reports')
        .select('updated_at, deleted_at, version')
        .eq('id', local.id)
        .maybeSingle();

      if (serverRecord?.deleted_at) {
        await this.logAudit('sync_skipped', 'reports', local.id, 'Server record soft-deleted');
        await db.reports.update(local.id, { is_synced: 1 });
        continue;
      }

      if (serverRecord && new Date(serverRecord.updated_at).getTime() > new Date(local.local_updated_at).getTime()) {
        // CONFLICT
        console.warn(`Sync Conflict (Reports): Server wins for ${local.id}`);
        const { data: fullRemote } = await supabase.from('reports').select('*').eq('id', local.id).single();
        if (fullRemote) {
          await db.reports.put({ 
            ...fullRemote, 
            is_synced: 1, 
            local_updated_at: fullRemote.updated_at 
          });
          await this.logAudit('conflict_server_kept', 'reports', local.id, `Server won. Server ${serverRecord.updated_at} > Local ${local.local_updated_at}`);
          continue;
        }
      }

      // Push to server
      const { error: syncError } = await supabase.from('reports').upsert({
        id: local.id, organization_id: local.organization_id, created_by: local.created_by,
        site_name: local.site_name, site_address: local.site_address, client_name: local.client_name,
        client_email: local.client_email, status: local.status, work_date: local.work_date,
        started_at: local.started_at, created_at: local.created_at, updated_at: local.local_updated_at,
        version: local.version
      });

      if (!syncError) {
        await db.reports.update(local.id, { is_synced: 1, updated_at: local.local_updated_at });
        await this.logAudit('sync_success', 'reports', local.id);
      } else {
        await this.logAudit('sync_failure', 'reports', local.id, syncError.message);
      }
    }
  }

  private async syncEntries() {
    const pendingEntries = await db.entries.where('is_synced').equals(0).toArray();
    const supabase = createClient();

    for (const local of pendingEntries) {
      const { data: serverRecord, error: fetchError } = await supabase
        .from('report_entries')
        .select('updated_at')
        .eq('id', local.id)
        .maybeSingle();

      if (serverRecord && new Date(serverRecord.updated_at).getTime() > new Date(local.local_updated_at).getTime()) {
        const { data: fullRemote } = await supabase.from('report_entries').select('*').eq('id', local.id).single();
        if (fullRemote) {
          await db.entries.put({ ...fullRemote, is_synced: 1, local_updated_at: fullRemote.updated_at });
          await this.logAudit('conflict_server_kept', 'report_entries', local.id);
          continue;
        }
      }

      const { error: syncError } = await supabase.from('report_entries').upsert({
        id: local.id, report_id: local.report_id, sequence_order: local.sequence_order,
        entry_type: local.entry_type, original_text: local.original_text, translated_text: local.translated_text,
        created_at: local.created_at, updated_at: local.local_updated_at, version: local.version
      });

      if (!syncError) {
        await db.entries.update(local.id, { is_synced: 1, updated_at: local.local_updated_at });
        await this.logAudit('sync_success', 'report_entries', local.id);
      }
    }
  }

  private async syncMaterials() {
    const pendingMaterials = await db.materials.where('is_synced').equals(0).toArray();
    const supabase = createClient();

    for (const local of pendingMaterials) {
      const { data: serverRecord, error: fetchError } = await supabase
        .from('materials')
        .select('updated_at')
        .eq('id', local.id)
        .maybeSingle();

      if (serverRecord && new Date(serverRecord.updated_at).getTime() > new Date(local.local_updated_at).getTime()) {
        const { data: fullRemote } = await supabase.from('materials').select('*').eq('id', local.id).single();
        if (fullRemote) {
          await db.materials.put({ ...fullRemote, is_synced: 1, local_updated_at: fullRemote.updated_at });
          await this.logAudit('conflict_server_kept', 'materials', local.id);
          continue;
        }
      }

      const { error: syncError } = await supabase.from('materials').upsert({
        id: local.id, report_id: local.report_id, name_original: local.name_original,
        name_translated: local.name_translated, quantity: local.quantity, unit: local.unit, 
        notes: local.notes, created_at: local.created_at, updated_at: local.local_updated_at, version: local.version
      });

      if (!syncError) {
        await db.materials.update(local.id, { is_synced: 1, updated_at: local.local_updated_at });
        await this.logAudit('sync_success', 'materials', local.id);
      }
    }
  }

  private async syncPhotos() {
    const pendingPhotos = await db.photos.where('is_synced').equals(0).toArray();
    const supabase = createClient();

    for (const photo of pendingPhotos) {
      const report = await db.reports.get(photo.report_id);
      if (!report) continue;

      const bucket = photo.visibility === 'client_facing' ? 'photos-client-facing' : 'photos-internal';
      const path = `${report.organization_id}/reports/${photo.report_id}/photos/${photo.visibility}/${photo.id}.jpg`;
      
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, photo.file, { 
        contentType: 'image/jpeg', 
        upsert: true 
      });

      if (uploadError) continue;

      const { error: dbError } = await supabase.from('photos').upsert({
        id: photo.id, report_id: photo.report_id, storage_path: path, visibility: photo.visibility,
        caption_original: photo.caption, taken_at: photo.taken_at, updated_at: photo.updated_at,
        version: photo.version, created_by: report.created_by
      });

      if (!dbError) {
        await db.photos.update(photo.id, { is_synced: 1 });
        await this.logAudit('sync_success', 'photos', photo.id);
      }
    }
  }

  private async syncSignatures() {
    const pendingSignatures = await db.signatures.where('is_synced').equals(0).toArray();
    const supabase = createClient();

    for (const sig of pendingSignatures) {
      const report = await db.reports.get(sig.report_id);
      if (!report) continue;

      const blob = await fetch(sig.signature_data).then(res => res.blob());
      const path = `${report.organization_id}/reports/${sig.report_id}/signatures/${sig.id}.png`;
      
      const { error: uploadError } = await supabase.storage.from('signatures').upload(path, blob, { 
        contentType: 'image/png', 
        upsert: true 
      });

      if (uploadError) continue;

      const { error: dbError } = await supabase.from('signatures').upsert({
        id: sig.id, report_id: sig.report_id, signer_role: sig.signer_role, signer_name: sig.signer_name,
        signature_data: sig.signature_data, signed_at: sig.signed_at, updated_at: sig.updated_at,
        version: sig.version
      });

      if (!dbError) {
        await db.signatures.update(sig.id, { is_synced: 1 });
        await this.logAudit('sync_success', 'signatures', sig.id);
      }
    }
  }

  private async logAudit(
    action: 'sync_success' | 'sync_failure' | 'sync_skipped' | 'conflict_server_kept' | 'deletion_success' | 'deletion_failed',
    tableName: string,
    recordId: string,
    details?: string
  ) {
    await db.audit_log.add({
      id: crypto.randomUUID(),
      action,
      table_name: tableName,
      record_id: recordId,
      synced_at: new Date().toISOString(),
      error_message: details
    });
  }
}

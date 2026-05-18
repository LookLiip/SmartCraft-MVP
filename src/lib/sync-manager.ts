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

  private isValidUUID(id: string): boolean {
    if (!id) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  private isRecordSyncable(record: any, tableName: string): boolean {
    // Basic UUID validation for primary and foreign keys
    if (!this.isValidUUID(record.id)) return false;
    
    if (tableName === 'report_entries' || tableName === 'materials' || tableName === 'photos' || tableName === 'signatures') {
      if (!this.isValidUUID(record.report_id)) return false;
    }
    
    if (tableName === 'reports') {
      if (!this.isValidUUID(record.organization_id)) return false;
      // created_by is optional in schema but if present should be UUID
      if (record.created_by && !this.isValidUUID(record.created_by)) return false;
    }
    
    return true;
  }

  public async sync() {
    if (this.syncing || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('Sync skipped: No active session. Data will remain local until login.');
      return;
    }

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
      console.error('Sync process crashed:', error);
    } finally {
      this.syncing = false;
    }
  }

  public async queueDeletion(bucket: string, path: string) {
    await db.pending_deletions.add({
      id: crypto.randomUUID(),
      bucket,
      path,
      created_at: new Date().toISOString(),
      retry_count: 0
    });
    // Trigger sync to process it immediately if online
    this.sync();
  }

  private async processPendingDeletions() {
    const deletions = await db.pending_deletions.toArray();
    const supabase = createClient();

    for (const del of deletions) {
      try {
        const { error } = await supabase.storage.from(del.bucket).remove([del.path]);
        // If error is "Object not found", we consider it a success because the goal was to remove it
        if (!error || error.message?.includes('Object not found') || (error as any).status === 404) {
          await db.pending_deletions.delete(del.id);
          await this.logAudit('deletion_success', 'storage', del.id, `Deleted ${del.path} from ${del.bucket}`);
        } else {
           await db.pending_deletions.update(del.id, { retry_count: del.retry_count + 1 });
           console.error(`Failed to delete storage object ${del.path}:`, error);
        }
      } catch (err) {
        console.error(`Unexpected error processing deletion ${del.id}:`, err);
      }
    }
  }

  private async cleanup() {
    // Purge audit logs older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    await db.audit_log.where('synced_at').below(sevenDaysAgo.toISOString()).delete();
  }

  private async syncReports() {
    const pendingReports = await db.reports
      .where('is_synced').equals(0)
      .limit(50) // Process in batches
      .toArray();
      
    const supabase = createClient();

    for (const local of pendingReports) {
      try {
        if (!this.isRecordSyncable(local, 'reports')) {
          console.warn(`Skipping un-syncable report (invalid UUIDs): ${local.id}`);
          await db.reports.update(local.id, { is_synced: -1 }); // Mark as permanent failure
          continue;
        }

        const { data: serverRecord, error: fetchError } = await supabase
          .from('reports')
          .select('updated_at, deleted_at, version')
          .eq('id', local.id)
          .maybeSingle();

        if (fetchError) {
          console.error(`Error fetching report ${local.id}:`, fetchError);
          continue;
        }

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
          id: local.id, 
          organization_id: local.organization_id, 
          created_by: local.created_by === '00000000-0000-0000-0000-000000000000' ? null : local.created_by,
          site_name: local.site_name, 
          site_address: local.site_address, 
          client_name: local.client_name,
          client_email: local.client_email, 
          status: local.status, 
          work_date: local.work_date,
          started_at: local.started_at, 
          created_at: local.created_at, 
          updated_at: local.local_updated_at,
          version: local.version
        });

        if (!syncError) {
          await db.reports.update(local.id, { is_synced: 1, updated_at: local.local_updated_at });
          await this.logAudit('sync_success', 'reports', local.id);
        } else {
          console.error(`Sync failure for report ${local.id}:`, syncError);
          await this.logAudit('sync_failure', 'reports', local.id, syncError.message);
          // If it's a 400 error, mark it as permanent failure to stop the loop
          if (syncError.code === '22P02' || syncError.code === '23503' || (syncError as any).status === 400) {
             await db.reports.update(local.id, { is_synced: -1 });
          }
        }
      } catch (err) {
        console.error(`Unexpected error syncing report ${local.id}:`, err);
      }
    }
  }

  private async syncEntries() {
    const pendingEntries = await db.entries
      .where('is_synced').equals(0)
      .limit(100)
      .toArray();
      
    const supabase = createClient();

    for (const local of pendingEntries) {
      try {
        if (!this.isRecordSyncable(local, 'report_entries')) {
          console.warn(`Skipping un-syncable entry: ${local.id}`);
          await db.entries.update(local.id, { is_synced: -1 });
          continue;
        }

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
          id: local.id, 
          report_id: local.report_id, 
          sequence_order: local.sequence_order,
          entry_type: local.entry_type, 
          original_text: local.original_text, 
          translated_text: local.translated_text,
          created_at: local.created_at, 
          updated_at: local.local_updated_at, 
          version: local.version
        });

        if (!syncError) {
          await db.entries.update(local.id, { is_synced: 1, updated_at: local.local_updated_at });
          await this.logAudit('sync_success', 'report_entries', local.id);
        } else {
          console.error(`Sync failure for entry ${local.id}:`, syncError);
          if ((syncError as any).status === 400) {
            await db.entries.update(local.id, { is_synced: -1 });
          }
        }
      } catch (err) {
        console.error(`Unexpected error syncing entry ${local.id}:`, err);
      }
    }
  }

  private async syncMaterials() {
    const pendingMaterials = await db.materials
      .where('is_synced').equals(0)
      .limit(100)
      .toArray();
      
    const supabase = createClient();

    for (const local of pendingMaterials) {
      try {
        if (!this.isRecordSyncable(local, 'materials')) {
          await db.materials.update(local.id, { is_synced: -1 });
          continue;
        }

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
          id: local.id, 
          report_id: local.report_id, 
          name_original: local.name_original,
          name_translated: local.name_translated, 
          quantity: local.quantity, 
          unit: local.unit, 
          notes: local.notes, 
          created_at: local.created_at, 
          updated_at: local.local_updated_at, 
          version: local.version
        });

        if (!syncError) {
          await db.materials.update(local.id, { is_synced: 1, updated_at: local.local_updated_at });
          await this.logAudit('sync_success', 'materials', local.id);
        } else {
          console.error(`Sync failure for material ${local.id}:`, syncError);
          if ((syncError as any).status === 400) {
            await db.materials.update(local.id, { is_synced: -1 });
          }
        }
      } catch (err) {
        console.error(`Unexpected error syncing material ${local.id}:`, err);
      }
    }
  }

  private async syncPhotos() {
    const pendingPhotos = await db.photos
      .where('is_synced').equals(0)
      .limit(20) // Smaller batch for files
      .toArray();
      
    const supabase = createClient();

    for (const photo of pendingPhotos) {
      try {
        if (!this.isRecordSyncable(photo, 'photos')) {
          await db.photos.update(photo.id, { is_synced: -1 });
          continue;
        }

        const report = await db.reports.get(photo.report_id);
        if (!report || !this.isValidUUID(report.organization_id)) {
          console.warn(`Cannot sync photo ${photo.id}: Missing or invalid report/org`);
          continue;
        }

        const bucket = photo.visibility === 'client_facing' ? 'photos-client-facing' : 'photos-internal';
        const path = `${report.organization_id}/reports/${photo.report_id}/photos/${photo.visibility}/${photo.id}.jpg`;
        
        const { error: uploadError } = await supabase.storage.from(bucket).upload(path, photo.file, { 
          contentType: 'image/jpeg', 
          upsert: true 
        });

        if (uploadError) {
          console.error(`Storage upload error for photo ${photo.id}:`, uploadError);
          continue;
        }

        const { error: dbError } = await supabase.from('photos').upsert({
          id: photo.id, 
          report_id: photo.report_id, 
          storage_path: path, 
          visibility: photo.visibility,
          caption_original: photo.caption, 
          taken_at: photo.taken_at, 
          updated_at: photo.updated_at,
          version: photo.version, 
          created_by: this.isValidUUID(report.created_by) ? report.created_by : null
        });

        if (!dbError) {
          await db.photos.update(photo.id, { is_synced: 1 });
          await this.logAudit('sync_success', 'photos', photo.id);
        } else {
          console.error(`DB upsert error for photo ${photo.id}:`, dbError);
          if ((dbError as any).status === 400) {
            await db.photos.update(photo.id, { is_synced: -1 });
          }
        }
      } catch (err) {
        console.error(`Unexpected error syncing photo ${photo.id}:`, err);
      }
    }
  }

  private async syncSignatures() {
    const pendingSignatures = await db.signatures
      .where('is_synced').equals(0)
      .limit(20)
      .toArray();
      
    const supabase = createClient();

    for (const sig of pendingSignatures) {
      try {
        if (!this.isRecordSyncable(sig, 'signatures')) {
          await db.signatures.update(sig.id, { is_synced: -1 });
          continue;
        }

        const report = await db.reports.get(sig.report_id);
        if (!report || !this.isValidUUID(report.organization_id)) continue;

        const blob = await fetch(sig.signature_data).then(res => res.blob());
        const path = `${report.organization_id}/reports/${sig.report_id}/signatures/${sig.id}.png`;
        
        const { error: uploadError } = await supabase.storage.from('signatures').upload(path, blob, { 
          contentType: 'image/png', 
          upsert: true 
        });

        if (uploadError) {
          console.error(`Storage upload error for signature ${sig.id}:`, uploadError);
          continue;
        }

        const { error: dbError } = await supabase.from('signatures').upsert({
          id: sig.id, 
          report_id: sig.report_id, 
          signer_role: sig.signer_role, 
          signer_name: sig.signer_name,
          signature_data: sig.signature_data, 
          signed_at: sig.signed_at, 
          updated_at: sig.updated_at,
          version: sig.version
        });

        if (!dbError) {
          await db.signatures.update(sig.id, { is_synced: 1 });
          await this.logAudit('sync_success', 'signatures', sig.id);
        } else {
          console.error(`DB upsert error for signature ${sig.id}:`, dbError);
          if ((dbError as any).status === 400) {
            await db.signatures.update(sig.id, { is_synced: -1 });
          }
        }
      } catch (err) {
        console.error(`Unexpected error syncing signature ${sig.id}:`, err);
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

'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, FileSearch, CheckCircle2, Clock, Download, AlertCircle, FileText, User, Calendar, MapPin, X } from 'lucide-react';
import Link from 'next/link';
import { db, type OfflineReport, type OfflineEntry } from '@/lib/dexie/db';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useRouter } from 'next/navigation';

export function ReportsList() {
  const router = useRouter();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const reports = useLiveQuery(() => 
    db.reports.orderBy('local_updated_at').reverse().toArray()
  );

  const handleViewDetails = (id: string) => {
    router.push(`/admin/reports/${id}`);
  };

  if (!reports) return <div className="p-8 text-center text-slate-500">Lade Berichte...</div>;

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Baustelle / Kunde</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Datum</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reports.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                  Keine Berichte gefunden. Starten Sie einen neuen Bericht im Home-Tab.
                </td>
              </tr>
            ) : (
              reports.map((report) => (
                <tr 
                  key={report.id} 
                  className="hover:bg-slate-50 transition-colors group cursor-pointer"
                  onClick={() => handleViewDetails(report.id)}
                >
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900 group-hover:text-blue-600">
                      {report.site_name}
                    </p>
                    <p className="text-sm text-slate-500">{report.client_name || 'Kein Kunde'}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(report.work_date).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col space-y-1">
                      <StatusBadge status={report.status} />
                      {report.is_synced === 0 && (
                        <span className="text-[10px] text-amber-600 flex items-center">
                          <AlertCircle className="w-2 h-2 mr-1" /> Nur Lokal
                        </span>
                      )}
                      {report.is_synced === 1 && (
                        <span className="text-[10px] text-green-600 flex items-center">
                          ✓ Synchronisiert
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-400 hover:text-blue-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(report.id);
                        }}
                      >
                        <FileSearch className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ReportDetailModal 
        reportId={selectedReportId} 
        isOpen={isDetailOpen} 
        onClose={() => setIsDetailOpen(false)} 
      />
    </div>
  );
}

function ReportDetailModal({ reportId, isOpen, onClose }: { reportId: string | null, isOpen: boolean, onClose: () => void }) {
  const report = useLiveQuery(
    async () => {
      if (!reportId) return undefined;
      return await db.reports.get(reportId);
    },
    [reportId]
  );

  const entries = useLiveQuery(
    async () => {
      if (!reportId) return [];
      return await db.entries.where('report_id').equals(reportId).sortBy('sequence_order');
    },
    [reportId]
  );

  if (!report && isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Bericht Details
          </DialogTitle>
        </DialogHeader>

        {report && (
          <div className="space-y-6 py-4">
            {/* Header Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase">Baustelle</p>
                <p className="font-medium text-slate-900">{report.site_name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase">Kunde</p>
                <p className="font-medium text-slate-900">{report.client_name || 'N/A'}</p>
              </div>
              <div className="space-y-1 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Datum</p>
                  <p className="text-sm">{new Date(report.work_date).toLocaleDateString('de-DE')}</p>
                </div>
              </div>
              <div className="space-y-1 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Adresse</p>
                  <p className="text-sm">{report.site_address || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Transcription Content */}
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2 border-b pb-2">
                <FileText className="w-4 h-4" />
                Arbeitsbeschreibung
              </h3>
              
              {entries && entries.length > 0 ? (
                <div className="space-y-4">
                  {entries.map((entry) => (
                    <div key={entry.id} className="bg-white border rounded-md p-3 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter bg-blue-50 px-1.5 py-0.5 rounded">
                          {entry.entry_type === 'work_done' ? 'Arbeit' : 'Hinweis'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(entry.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-800 leading-relaxed italic mb-2 border-l-2 pl-3 border-slate-200">
                        &quot;{entry.original_text}&quot;
                      </p>
                      <p className="text-sm text-slate-900 font-medium">
                        {entry.translated_text}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 rounded-md border border-dashed">
                  <p className="text-sm text-slate-500">Noch keine Texte erfasst.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={onClose} variant="outline">Schließen</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'approved':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Genehmigt
        </span>
      );
    case 'pending_review':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          <Clock className="w-3 h-3 mr-1" />
          Review nötig
        </span>
      );
    case 'draft':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
          Entwurf
        </span>
      );
    case 'exported':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Download className="w-3 h-3 mr-1" />
          Exportiert
        </span>
      );
    default:
      return null;
  }
}

'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, FileSearch, CheckCircle2, Clock, Download, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/dexie/db';
import { useLiveQuery } from 'dexie-react-hooks';

export function ReportsList() {
  const reports = useLiveQuery(() => 
    db.reports.orderBy('local_updated_at').reverse().toArray()
  );

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
                <tr key={report.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600">
                        <FileSearch className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
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
    </div>
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

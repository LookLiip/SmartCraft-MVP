import React from 'react';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, FileSearch, CheckCircle2, Clock, Download } from 'lucide-react';
import Link from 'next/link';

// Mock Data for UI Rebuild
const reports = [
  {
    id: '1',
    site_name: 'EFH Müller - Elektroinstallation',
    client_name: 'Hans Müller',
    worker: 'John Doe',
    date: '07.05.2024',
    status: 'pending_review',
  },
  {
    id: '2',
    site_name: 'Bürokomplex City - Wartung',
    client_name: 'City Management GmbH',
    worker: 'Jane Smith',
    date: '06.05.2024',
    status: 'approved',
  },
  {
    id: '3',
    site_name: 'MFH Neubau - Sanitär',
    client_name: 'Bau AG',
    worker: 'Mike Miller',
    date: '05.05.2024',
    status: 'draft',
  }
];

export function ReportsList() {
  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Baustelle / Kunde</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Mitarbeiter</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Datum</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reports.map((report) => (
              <tr key={report.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4">
                  <Link href={`/admin/reports/${report.id}`}>
                    <p className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors cursor-pointer">
                      {report.site_name}
                    </p>
                  </Link>
                  <p className="text-sm text-slate-500">{report.client_name}</p>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{report.worker}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{report.date}</td>
                <td className="px-6 py-4">
                  <StatusBadge status={report.status} />
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <Link href={`/admin/reports/${report.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600">
                        <FileSearch className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
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

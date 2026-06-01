'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  FileSearch, 
  CheckCircle2, 
  Clock, 
  Download, 
  AlertCircle, 
  FileText, 
  Calendar, 
  MapPin, 
  Search,
  Filter,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { StatusBadge } from './reports-list'; // Reusing the badge

interface Report {
  id: string;
  site_name: string;
  client_name: string;
  work_date: string;
  status: 'draft' | 'pending_review' | 'approved' | 'exported';
  created_at: string;
  users?: {
    full_name: string;
  };
}

export function AdminReportsList() {
  const router = useRouter();
  const supabase = createClient();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('reports')
        .select(`
          *,
          users:created_by (full_name)
        `)
        .order('work_date', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(report => 
    report.site_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (report.client_name && report.client_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleViewDetails = (id: string) => {
    router.push(`/admin/reports/${id}`);
  };

  return (
    <div className="space-y-4">
      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Nach Baustelle oder Kunde suchen..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-500" />
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex h-10 w-full md:w-[180px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="all">Alle Status</option>
            <option value="draft">Entwurf</option>
            <option value="pending_review">Review nötig</option>
            <option value="approved">Genehmigt</option>
            <option value="exported">Exportiert</option>
          </select>
          <Button variant="outline" size="icon" onClick={() => fetchReports()} title="Aktualisieren">
            <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
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
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                    Berichte werden geladen...
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Keine Berichte gefunden.
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => (
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
                      {report.users?.full_name || 'Unbekannt'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(report.work_date).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(report.id);
                        }}
                      >
                        Prüfen
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

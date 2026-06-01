import { AdminShell } from '@/components/admin-shell';
import { AdminReportsList } from '@/components/admin-reports-list';
import { DashboardStats } from '@/components/dashboard-stats';
import { Suspense } from 'react';

export default function AdminDashboard() {
  return (
    <AdminShell>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-slate-500">Willkommen zurück.</p>
        </div>

        {/* Stats Grid */}
        <DashboardStats />

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-900">Letzte Eingänge</h3>
          </div>
          <AdminReportsList />
        </div>
      </div>
    </AdminShell>
  );
}

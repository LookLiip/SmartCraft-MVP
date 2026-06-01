import { AdminShell } from '@/components/admin-shell';
import { AdminReportsList } from '@/components/admin-reports-list';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function AdminReportsPage() {
  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Arbeitsberichte</h2>
            <p className="text-slate-500 text-sm">Verwalten und prüfen Sie alle eingegangenen Berichte.</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Neuer Bericht
            </Button>
          </div>
        </div>

        <AdminReportsList />
      </div>
    </AdminShell>
  );
}

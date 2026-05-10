import { AdminShell } from '@/components/admin-shell';
import { ReportsList } from '@/components/reports-list';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Clock, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

export default function AdminDashboard() {
  return (
    <AdminShell>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-slate-500">Willkommen zurück.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Offene Berichte" 
            value="12" 
            icon={<Clock className="w-6 h-6 text-amber-500" />} 
            description="Warten auf Review"
          />
          <StatCard 
            title="Freigegeben" 
            value="48" 
            icon={<CheckCircle2 className="w-6 h-6 text-green-500" />} 
            description="Diesen Monat"
          />
          <StatCard 
            title="Probleme" 
            value="2" 
            icon={<AlertCircle className="w-6 h-6 text-red-500" />} 
            description="Nacharbeit erforderlich"
          />
          <StatCard 
            title="Gesamtberichte" 
            value="1,284" 
            icon={<FileText className="w-6 h-6 text-blue-500" />} 
            description="Seit Gründung"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-900">Letzte Eingänge</h3>
          </div>
          <ReportsList />
        </div>
      </div>
    </AdminShell>
  );
}

function StatCard({ title, value, icon, description }: { title: string, value: string, icon: React.ReactNode, description: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          {icon}
        </div>
        <div className="flex items-baseline space-x-2">
          <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        </div>
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

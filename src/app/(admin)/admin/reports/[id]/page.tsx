import { AdminShell } from '@/components/admin-shell';
import { ReportReview } from '@/components/report-review';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Calendar, MapPin, User } from 'lucide-react';
import Link from 'next/link';

export default function ReportReviewPage() {
  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link 
              href="/admin/reports" 
              className="flex items-center text-sm text-slate-500 hover:text-blue-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Zurück zur Übersicht
            </Link>
            <h2 className="text-3xl font-bold text-slate-900">EFH Müller - Elektroinstallation</h2>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 pt-1">
              <span className="flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                07. Mai 2024
              </span>
              <span className="flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                Dorfstraße 4, 80331 München
              </span>
              <span className="flex items-center">
                <User className="w-4 h-4 mr-2" />
                Erstellt von: John Doe
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline">Entwurf speichern</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">Review abschließen</Button>
          </div>
        </div>

        <ReportReview />
      </div>
    </AdminShell>
  );
}

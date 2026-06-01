import { AdminShell } from '@/components/admin-shell';
import { ReportReview } from '@/components/report-review';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Calendar, MapPin, User } from 'lucide-react';
import Link from 'next/link';

export default function ReportReviewPage({ params }: { params: { id: string } }) {
  const id = params.id;

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
            <h2 className="text-3xl font-bold text-slate-900">Bericht Review</h2>
          </div>
        </div>

        <ReportReview reportId={id} />
      </div>
    </AdminShell>
  );
}

import { AdminShell } from '@/components/admin-shell';
import { UserManagement } from '@/components/user-management';

export default function AdminUsersPage() {
  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Mitarbeiterverwaltung</h2>
          <p className="text-slate-500 text-sm">Verwalten Sie Ihre Teammitglieder, Rollen und Spracheinstellungen.</p>
        </div>

        <UserManagement />
      </div>
    </AdminShell>
  );
}

import { AdminShell } from '@/components/admin-shell';
import { OrgSettings } from '@/components/org-settings';

export default function SettingsPage() {
  return (
    <AdminShell>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Einstellungen</h2>
          <p className="text-slate-500">Verwalten Sie Ihre Firmen-Einstellungen und das Berichts-Layout.</p>
        </div>

        <OrgSettings />
      </div>
    </AdminShell>
  );
}

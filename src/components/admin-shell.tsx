'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Settings, 
  LogOut,
  Search,
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserNav } from './user-nav';
import { createClient } from '@/lib/supabase/client';
import { logoutAction } from '@/lib/actions/auth';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = React.useState<{
    email: string | null,
    name: string | null,
    role: 'worker' | 'admin' | 'owner' | null,
    isSuperAdmin: boolean
  } | null>(null);

  const supabase = createClient();

  React.useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        let role: 'worker' | 'admin' | 'owner' | null = null;
        let isSuperAdmin = false;

        const { data: profile } = await supabase
          .from('users')
          .select('role, is_super_admin')
          .eq('id', user.id)
          .single();

        if (profile) {
          role = profile.role;
          isSuperAdmin = profile.is_super_admin ?? false;
        }

        setUser({
          email: user.email || null,
          name: user.user_metadata?.full_name || null,
          role,
          isSuperAdmin
        });
      }
    });
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-400">SmartCraft</h1>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold">Admin Panel</p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          <SidebarLink href="/admin" icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" active={pathname === '/admin'} />
          <SidebarLink href="/admin/reports" icon={<FileText className="w-5 h-5" />} label="Berichte" active={pathname?.startsWith('/admin/reports')} />
          <SidebarLink href="/admin/users" icon={<Users className="w-5 h-5" />} label="Mitarbeiter" active={pathname === '/admin/users'} />
          <SidebarLink href="/admin/settings" icon={<Settings className="w-5 h-5" />} label="Einstellungen" active={pathname === '/admin/settings'} />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => logoutAction()}
            className="flex items-center space-x-3 text-slate-400 hover:text-white px-2 py-2 transition-colors w-full"
          >
            <LogOut className="w-5 h-5" />
            <span>Abmelden</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b px-8 flex items-center justify-between">
          <div className="max-w-md w-full relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Suche nach Berichten, Kunden..." 
              className="pl-10 bg-slate-50 border-none h-10 w-full"
            />
          </div>

          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-slate-600" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </Button>
            <div className="flex items-center space-x-3 border-l pl-4">
              <UserNav email={user?.email} name={user?.name} role={user?.role} isSuperAdmin={user?.isSuperAdmin} />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarLink({ href, icon, label, active = false }: { href: string, icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <Link 
      href={href}
      className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
        active 
          ? 'bg-blue-600 text-white' 
          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </Link>
  );
}

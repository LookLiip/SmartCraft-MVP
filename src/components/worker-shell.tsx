'use client';

import React, { useState, useEffect } from 'react';
import { NavLink } from './nav-link';
import { Home, FileText, Camera, PenTool, Settings, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SyncManager } from '@/lib/sync-manager';
import { UserNav } from './user-nav';
import { createClient } from '@/lib/supabase/client';

export function WorkerShell({ 
  children,
  activeTab,
  onTabChange
}: { 
  children: React.ReactNode,
  activeTab?: string,
  onTabChange?: (tab: string) => void
}) {
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [user, setUser] = useState<{
    email: string | null,
    name: string | null,
    role: 'worker' | 'admin' | 'owner' | null,
    isSuperAdmin: boolean
  } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Fetch user info + profile (role / is_super_admin)
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

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    await SyncManager.getInstance().sync();
    setSyncing(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Top Bar */}
      <header className="sticky top-0 z-10 bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-bold text-blue-600">SmartCraft</h1>
          <div className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Worker App
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleSync}
            disabled={syncing || !isOnline}
            className={syncing ? 'animate-spin' : ''}
          >
            <RefreshCw className="w-5 h-5 text-slate-400" />
          </Button>
          
          <div className="flex items-center px-2 py-1 rounded-full bg-slate-50 border text-xs font-medium text-slate-600">
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 text-green-500 mr-1.5" />
                Online
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-red-500 mr-1.5" />
                Offline
              </>
            )}
          </div>
          
          <UserNav email={user?.email} name={user?.name} role={user?.role} isSuperAdmin={user?.isSuperAdmin} />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-24">
        <div className="max-w-4xl mx-auto p-4">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-2 py-2 flex justify-around items-center shadow-lg z-20">
        <NavLink 
          icon={<Home className="w-6 h-6" />} 
          label="Home" 
          active={activeTab === 'info' || activeTab === 'voice'} 
          onClick={() => onTabChange?.('info')} 
        />
        <NavLink 
          icon={<FileText className="w-6 h-6" />} 
          label="Berichte" 
          active={activeTab === 'list'} 
          onClick={() => onTabChange?.('list')} 
        />
        <NavLink 
          icon={<Camera className="w-6 h-6" />} 
          label="Fotos" 
          active={activeTab === 'photos'} 
          onClick={() => onTabChange?.('photos')} 
        />
        <NavLink 
          icon={<PenTool className="w-6 h-6" />} 
          label="Unterschrift" 
          active={activeTab === 'sign'} 
          onClick={() => onTabChange?.('sign')} 
        />
        <NavLink 
          icon={<Settings className="w-6 h-6" />} 
          label="Einst." 
          active={activeTab === 'settings'} 
          onClick={() => onTabChange?.('settings')} 
        />
      </nav>
    </div>
  );
}

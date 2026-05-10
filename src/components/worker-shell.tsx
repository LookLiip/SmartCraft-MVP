'use client';

import React, { useState, useEffect } from 'react';
import { NavLink } from './nav-link';
import { Home, FileText, Camera, PenTool, Settings, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SyncManager } from '@/lib/sync-manager';

export function WorkerShell({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

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
          
          <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center">
            <span className="text-xs font-bold text-blue-700">MM</span>
          </div>
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
        <NavLink href="/worker" icon={<Home className="w-6 h-6" />} label="Home" />
        <NavLink href="/worker" icon={<FileText className="w-6 h-6" />} label="Berichte" />
        <NavLink href="/worker" icon={<Camera className="w-6 h-6" />} label="Fotos" />
        <NavLink href="/worker" icon={<PenTool className="w-6 h-6" />} label="Unterschrift" />
        <NavLink href="/worker" icon={<Settings className="w-6 h-6" />} label="Einst." />
      </nav>
    </div>
  );
}

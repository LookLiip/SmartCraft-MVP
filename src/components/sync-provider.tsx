"use client";

import React, { useEffect } from 'react';
import { SyncManager } from '@/lib/sync-manager';

export function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initial sync on mount
    const syncManager = SyncManager.getInstance();
    syncManager.sync();

    // Setup periodic sync every 5 minutes
    const interval = setInterval(() => {
      syncManager.sync();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return <>{children}</>;
}

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, CheckCircle2, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Stats {
  open: number;
  approved: number;
  problems: number;
  total: number;
}

export function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      const [openRes, approvedRes, totalRes] = await Promise.all([
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
        supabase.from('reports').select('*', { count: 'exact', head: true }).in('status', ['approved', 'exported']).gte('work_date', firstDayOfMonth),
        supabase.from('reports').select('*', { count: 'exact', head: true })
      ]);

      setStats({
        open: openRes.count || 0,
        approved: approvedRes.count || 0,
        problems: 0, 
        total: totalRes.count || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6 h-32 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-slate-200 animate-spin" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard 
        title="Offene Berichte" 
        value={stats?.open.toString() || '0'} 
        icon={<Clock className="w-6 h-6 text-amber-500" />} 
        description="Warten auf Review"
      />
      <StatCard 
        title="Freigegeben" 
        value={stats?.approved.toString() || '0'} 
        icon={<CheckCircle2 className="w-6 h-6 text-green-500" />} 
        description="Diesen Monat"
      />
      <StatCard 
        title="Probleme" 
        value={stats?.problems.toString() || '0'} 
        icon={<AlertCircle className="w-6 h-6 text-red-500" />} 
        description="Nacharbeit erforderlich"
      />
      <StatCard 
        title="Gesamtberichte" 
        value={stats?.total.toLocaleString('de-DE') || '0'} 
        icon={<FileText className="w-6 h-6 text-blue-500" />} 
        description="Seit Gründung"
      />
    </div>
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

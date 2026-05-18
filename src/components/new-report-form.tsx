'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/dexie/db';
import { useReportStore } from '@/stores/report-store';
import { CheckCircle2, Loader2 } from 'lucide-react';

export function NewReportForm({ onReportStarted }: { onReportStarted?: () => void }) {
  const setCurrentReportId = useReportStore((state) => state.setCurrentReportId);
  const currentReportId = useReportStore((state) => state.currentReportId);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    workDate: new Date().toISOString().split('T')[0],
    siteName: '',
    address: '',
    clientName: '',
    clientEmail: ''
  });

  const handleStartReport = async () => {
    if (!formData.siteName) return;
    
    setLoading(true);
    try {
      const reportId = crypto.randomUUID();
      
      const now = new Date().toISOString();
      await db.reports.add({
        id: reportId,
        organization_id: 'ce9c1474-9c0f-48af-9e9b-62f53d517c18', // Updated to valid Dev Org ID
        created_by: '00000000-0000-0000-0000-000000000000', // Placeholder valid UUID
        site_name: formData.siteName,
        site_address: formData.address,
        client_name: formData.clientName,
        client_email: formData.clientEmail,
        status: 'draft',
        work_date: formData.workDate,
        started_at: now,
        created_at: now,
        updated_at: now,
        local_updated_at: now,
        version: 1,
        is_synced: 0
      });
      
      setCurrentReportId(reportId);
      setSuccess(true);
      if (onReportStarted) onReportStarted();
    } catch (error) {
      console.error('Failed to create report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (success || currentReportId) {
    return (
      <Card className="w-full border-green-200 bg-green-50">
        <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-green-900">Bericht Aktiv</h3>
            <p className="text-sm text-green-700">
              Sie arbeiten an: <strong>{formData.siteName || 'Aktuellem Projekt'}</strong>
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setSuccess(false);
              setCurrentReportId(null);
            }}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            Bericht beenden / Neuen starten
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Neuer Arbeitsbericht</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="workDate">Datum</Label>
            <Input 
              id="workDate" 
              type="date" 
              value={formData.workDate}
              onChange={(e) => setFormData({...formData, workDate: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="siteName">Baustelle (Bezeichnung)</Label>
            <Input 
              id="siteName" 
              placeholder="z.B. Neubau EFH Müller" 
              value={formData.siteName}
              onChange={(e) => setFormData({...formData, siteName: e.target.value})}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Adresse</Label>
          <Input 
            id="address" 
            placeholder="Straße, PLZ, Ort" 
            value={formData.address}
            onChange={(e) => setFormData({...formData, address: e.target.value})}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="clientName">Kunde / Ansprechpartner</Label>
            <Input 
              id="clientName" 
              placeholder="Name des Kunden" 
              value={formData.clientName}
              onChange={(e) => setFormData({...formData, clientName: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientEmail">E-Mail für Berichtskopie</Label>
            <Input 
              id="clientEmail" 
              type="email" 
              placeholder="kunde@beispiel.de" 
              value={formData.clientEmail}
              onChange={(e) => setFormData({...formData, clientEmail: e.target.value})}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full bg-blue-600 hover:bg-blue-700" 
          onClick={handleStartReport}
          disabled={loading || !formData.siteName}
        >
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Erstelle...</>
          ) : (
            'Bericht starten'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

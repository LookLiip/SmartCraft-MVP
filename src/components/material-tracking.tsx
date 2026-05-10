'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/dexie/db';
import { useReportStore } from '@/stores/report-store';
import { useLiveQuery } from 'dexie-react-hooks';

export function MaterialTracking() {
  const currentReportId = useReportStore((state) => state.currentReportId);
  const materials = useLiveQuery(
    () => db.materials.where('report_id').equals(currentReportId || '').toArray(),
    [currentReportId]
  ) || [];

  const [newMaterial, setNewMaterial] = useState({
    name: '',
    quantity: '',
    unit: '',
    notes: ''
  });

  const addMaterial = async () => {
    if (!currentReportId || !newMaterial.name || !newMaterial.quantity) return;
    
    const now = new Date().toISOString();
    await db.materials.add({
      id: crypto.randomUUID(),
      report_id: currentReportId,
      name_original: newMaterial.name,
      quantity: parseFloat(newMaterial.quantity),
      unit: newMaterial.unit,
      notes: newMaterial.notes,
      created_at: now,
      updated_at: now,
      local_updated_at: now,
      version: 1,
      is_synced: 0
    });
    
    setNewMaterial({ name: '', quantity: '', unit: '', notes: '' });
  };

  const removeMaterial = async (id: string) => {
    await db.materials.delete(id);
  };

  if (!currentReportId) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center text-slate-500">
          Bitte starten Sie zuerst einen Bericht unter "Info".
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Materialverbrauch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Form */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="mat-name">Bezeichnung</Label>
            <Input 
              id="mat-name" 
              placeholder="z.B. NYM-J 3x1.5" 
              value={newMaterial.name}
              onChange={(e) => setNewMaterial({...newMaterial, name: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mat-qty">Menge</Label>
            <Input 
              id="mat-qty" 
              type="number" 
              placeholder="0" 
              value={newMaterial.quantity}
              onChange={(e) => setNewMaterial({...newMaterial, quantity: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mat-unit">Einheit</Label>
            <Input 
              id="mat-unit" 
              placeholder="m, Stk, kg..." 
              value={newMaterial.unit}
              onChange={(e) => setNewMaterial({...newMaterial, unit: e.target.value})}
            />
          </div>
          <div className="space-y-2 md:col-span-4 flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="mat-notes">Notizen (optional)</Label>
              <Input 
                id="mat-notes" 
                placeholder="Hinweise zum Material" 
                value={newMaterial.notes}
                onChange={(e) => setNewMaterial({...newMaterial, notes: e.target.value})}
              />
            </div>
            <Button onClick={addMaterial} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Hinzufügen
            </Button>
          </div>
        </div>

        {/* Materials List */}
        <div className="space-y-2">
          {materials.length === 0 ? (
            <p className="text-center text-slate-400 py-4 italic">Kein Material erfasst</p>
          ) : (
            <div className="border rounded-md divide-y">
              {materials.map((m) => (
                <div key={m.id} className="p-3 flex items-center justify-between">
                  <div className="grid grid-cols-1 md:grid-cols-3 flex-1 gap-2">
                    <div className="font-medium">{m.name_original}</div>
                    <div className="text-slate-600">{m.quantity} {m.unit}</div>
                    <div className="text-slate-400 text-sm truncate">{m.notes}</div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-red-500"
                    onClick={() => removeMaterial(m.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

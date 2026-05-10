'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Camera, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { db } from '@/lib/dexie/db';
import { useReportStore } from '@/stores/report-store';
import imageCompression from 'browser-image-compression';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUserStore } from '@/stores/user-store';

export function PhotoDocumentation() {
  const currentReportId = useReportStore((state) => state.currentReportId);
  const { role } = useUserStore();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);
  
  const photos = useLiveQuery(
    () => db.photos.where('report_id').equals(currentReportId || '').toArray(),
    [currentReportId]
  ) || [];

  // Role-based visibility logic (GDPR Remediation G-09)
  const displayPhotos = photos.filter(photo => {
    // Admins and Owners see everything
    if (role === 'admin' || role === 'owner') return true;
    
    // Workers see client-facing photos always
    if (photo.visibility === 'client_facing') return true;
    
    // Workers see internal photos ONLY while they are drafting (not yet synced)
    // Once synced, internal photos are for back-office review only
    return photo.is_synced === 0;
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentReportId || !e.target.files?.[0]) return;
    
    const file = e.target.files[0];
    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true
      });

      const now = new Date().toISOString();
      await db.photos.add({
        id: crypto.randomUUID(),
        report_id: currentReportId,
        file: compressedFile,
        visibility: 'internal',
        taken_at: now,
        updated_at: now,
        version: 1,
        is_synced: 0
      });
    } catch (error) {
      console.error('Photo upload failed:', error);
    }
  };

  const toggleVisibility = async (id: string, current: string) => {
    const nextVisibility = current === 'client_facing' ? 'internal' : 'client_facing';
    await db.photos.update(id, { visibility: nextVisibility as any });
  };

  const updateCaption = async (id: string, caption: string) => {
    await db.photos.update(id, { caption });
  };

  const removePhoto = async (id: string) => {
    await db.photos.delete(id);
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

  if (!isHydrated) {
    return <Card className="w-full h-48 animate-pulse bg-slate-50" />;
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Fotodokumentation</CardTitle>
        <div className="flex space-x-2">
          <Input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            id="camera-upload"
            onChange={handleFileUpload}
          />
          <Label htmlFor="camera-upload" className="cursor-pointer">
            <Button variant="outline" size="sm" asChild>
              <span>
                <Camera className="w-4 h-4 mr-2" />
                Foto aufnehmen
              </span>
            </Button>
          </Label>
        </div>
      </CardHeader>
      <CardContent>
        {displayPhotos.length === 0 ? (
          <div className="border-2 border-dashed rounded-lg p-12 text-center text-slate-400">
            <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Noch keine Fotos hinzugefügt</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {displayPhotos.map((photo) => {
              const previewUrl = URL.createObjectURL(photo.file);
              return (
                <div key={photo.id} className="relative group border rounded-lg overflow-hidden bg-slate-50">
                  <img src={previewUrl} alt="Work documentation" className="w-full h-48 object-cover" />
                  
                  <div className="p-3 space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor={`caption-${photo.id}`} className="text-xs font-medium">Bezeichnung</Label>
                      <Input 
                        id={`caption-${photo.id}`} 
                        className="h-8 text-sm" 
                        placeholder="z.B. Defekte Leitung" 
                        value={photo.caption || ''}
                        onChange={(e) => updateCaption(photo.id, e.target.value)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id={`visibility-${photo.id}`} 
                          checked={photo.visibility === 'client_facing'}
                          onCheckedChange={() => toggleVisibility(photo.id, photo.visibility)}
                        />
                        <Label htmlFor={`visibility-${photo.id}`} className="text-[10px] font-bold uppercase tracking-wider">
                          {photo.visibility === 'client_facing' ? 'Kunden-Sichtbar' : 'Nur Intern'}
                        </Label>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removePhoto(photo.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

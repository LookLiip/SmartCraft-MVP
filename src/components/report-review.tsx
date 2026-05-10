'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Check, 
  X, 
  Download, 
  Share2, 
  History,
  MessageSquare,
  Image as ImageIcon,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface Photo {
  id: string;
  src: string;
  label: string;
  clientFacing: boolean;
}

export function ReportReview() {
  const [refinedText, setRefinedText] = useState(
    "Am heutigen Arbeitstag wurden die Elektroinstallationen im Erdgeschoss des Neubaus EFH Müller weitgehend abgeschlossen. \n\nFolgende Tätigkeiten wurden ausgeführt:\n1. Verlegung der Leitungen für die Küchenanschlüsse gemäß Plan.\n2. Installation der Unterputzdosen in den Schlafräumen.\n3. Vorbereitung des Verteilerkastens für den Anschluss der Hauptleitung.\n\nEs wurden keine besonderen Vorkommnisse oder Mängel festgestellt. Die Arbeiten verlaufen planmäßig."
  );

  const [photos, setPhotos] = useState<Photo[]>([
    {
      id: 'p1',
      src: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&h=300&fit=crop",
      label: "Küchenanschlüsse",
      clientFacing: true
    },
    {
      id: 'p2',
      src: "https://images.unsplash.com/photo-1558444479-2753ada3312c?w=400&h=300&fit=crop",
      label: "Verteilerkasten offen",
      clientFacing: false
    }
  ]);

  const togglePhotoVisibility = (id: string) => {
    setPhotos(photos.map(p => p.id === id ? { ...p, clientFacing: !p.clientFacing } : p));
  };

  const movePhoto = (id: string, direction: 'up' | 'down') => {
    const index = photos.findIndex(p => p.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === photos.length - 1) return;

    const newPhotos = [...photos];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newPhotos[index], newPhotos[targetIndex]] = [newPhotos[targetIndex], newPhotos[index]];
    setPhotos(newPhotos);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Editor */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader className="border-b bg-slate-50 flex flex-row items-center justify-between py-4">
            <div>
              <CardTitle className="text-lg">Bericht-Text (Deutsch)</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Automatisch übersetzt und bereit zur Verfeinerung</p>
            </div>
            <Button variant="outline" size="sm">
              <History className="w-4 h-4 mr-2" />
              Verlauf
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-md border border-blue-100 flex gap-3">
                <MessageSquare className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-blue-900 italic">Original-Transkription (Mitarbeiter):</p>
                  <p className="text-blue-800 mt-1 opacity-80">
                    "Bugün Müller'in evinde alt kattaki elektrik işlerini bitirdik. Mutfak kablolarını çektik, odalardaki kutuları taktık. Ana tabloyu hazırladık. Her şey yolunda."
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="refinedText" className="text-sm font-semibold">Abschlussbericht für den Kunden</Label>
                <Textarea 
                  id="refinedText"
                  className="min-h-[300px] leading-relaxed text-base"
                  value={refinedText}
                  onChange={(e) => setRefinedText(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Materialverbrauch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md divide-y">
              <div className="p-3 grid grid-cols-3 text-sm">
                <span className="font-medium">NYM-J 3x1.5</span>
                <span className="text-slate-600 text-center">50 m</span>
                <span className="text-slate-400 text-right">Standardkabel</span>
              </div>
              <div className="p-3 grid grid-cols-3 text-sm">
                <span className="font-medium">Hohlwanddosen</span>
                <span className="text-slate-600 text-center">12 Stk</span>
                <span className="text-slate-400 text-right">-</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Photos & Meta */}
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Dokumentation</CardTitle>
            <ImageIcon className="w-5 h-5 text-slate-400" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative rounded-md overflow-hidden border">
                  <img src={photo.src} alt={photo.label} className="w-full h-40 object-cover" />
                  <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => movePhoto(photo.id, 'up')}>
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => movePhoto(photo.id, 'down')}>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 p-3 text-white text-xs flex justify-between items-center translate-y-0 transition-transform">
                    <span className="truncate mr-2 font-medium">{photo.label}</span>
                    <button 
                      onClick={() => togglePhotoVisibility(photo.id)}
                      className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${photo.clientFacing ? 'bg-green-500' : 'bg-slate-500'}`}
                    >
                      {photo.clientFacing ? 'Kunde' : 'Intern'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full">
              Weitere Fotos hinzufügen
            </Button>
          </CardContent>
        </Card>

        <div className="bg-white border rounded-lg p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900">Aktionen</h3>
          <div className="space-y-2">
            <Button className="w-full bg-green-600 hover:bg-green-700">
              <Check className="w-4 h-4 mr-2" />
              Freigeben & Senden
            </Button>
            <Button variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              PDF Exportieren
            </Button>
            <Button variant="outline" className="w-full">
              <Share2 className="w-4 h-4 mr-2" />
              Link teilen
            </Button>
            <div className="pt-2">
              <Button variant="ghost" className="w-full text-red-500 hover:text-red-600 hover:bg-red-50">
                <X className="w-4 h-4 mr-2" />
                Ablehnen
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

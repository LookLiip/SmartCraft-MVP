'use client';

import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PenTool, RotateCcw, CheckCircle2 } from 'lucide-react';
import { db } from '@/lib/dexie/db';
import { useReportStore } from '@/stores/report-store';
import { useLiveQuery } from 'dexie-react-hooks';

export function SignaturePad() {
  const currentReportId = useReportStore((state) => state.currentReportId);
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [signerName, setSignerName] = useState('');
  const [open, setOpen] = useState(false);

  const signature = useLiveQuery(
    () => db.signatures.where('report_id').equals(currentReportId || '').first(),
    [currentReportId]
  );

  const clear = () => {
    sigCanvas.current?.clear();
  };

  const save = async () => {
    if (!currentReportId || sigCanvas.current?.isEmpty() || !signerName) return;
    
    const dataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
    if (dataUrl) {
      const now = new Date().toISOString();
      await db.signatures.add({
        id: crypto.randomUUID(),
        report_id: currentReportId,
        signature_data: dataUrl,
        signer_role: 'client',
        signer_name: signerName,
        signed_at: now,
        updated_at: now,
        version: 1,
        is_synced: 0
      });
      setOpen(false);
    }
  };

  const deleteSignature = async () => {
    if (signature) {
      await db.signatures.delete(signature.id);
    }
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
        <CardTitle>Abschluss & Unterschrift</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        {signature ? (
          <div className="border rounded-lg p-4 bg-green-50 w-full flex flex-col items-center border-green-200">
            <div className="flex items-center text-green-600 mb-4 font-medium">
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Bericht unterzeichnet
            </div>
            <div className="mb-2 text-sm font-medium text-slate-700">{signature.signer_name}</div>
            <img src={signature.signature_data} alt="Client Signature" className="max-h-32 mb-4 bg-white rounded border" />
            <Button variant="outline" size="sm" className="text-red-500" onClick={deleteSignature}>
              Unterschrift löschen
            </Button>
          </div>
        ) : (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full h-32 border-dashed border-2 flex flex-col space-y-2">
                <PenTool className="w-8 h-8 opacity-20" />
                <span className="text-slate-400 font-medium">Kunden-Unterschrift hier</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Bericht unterzeichnen</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signerName">Name des Unterzeichners</Label>
                  <Input 
                    id="signerName" 
                    placeholder="Vorname Nachname" 
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                  />
                </div>
                <div className="bg-slate-100 border rounded-md overflow-hidden">
                  <SignatureCanvas 
                    ref={sigCanvas}
                    penColor="black"
                    canvasProps={{
                      className: "signature-canvas w-full h-64 cursor-crosshair bg-white"
                    }}
                  />
                </div>
              </div>
              <DialogFooter className="flex justify-between sm:justify-between items-center w-full">
                <Button variant="ghost" onClick={clear}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Zurücksetzen
                </Button>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
                  <Button onClick={save} className="bg-blue-600 hover:bg-blue-700">Speichern</Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

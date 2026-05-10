'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Info } from 'lucide-react';

interface ConsentDialogProps {
  open: boolean;
  onAccept: () => void;
}

export function ConsentDialog({ open, onAccept }: ConsentDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
          </div>
          <DialogTitle className="text-center text-xl">Datenschutz-Einwilligung</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Um die Sprach-zu-Text-Funktion nutzen zu können, benötigen wir Ihre Einwilligung zur Verarbeitung Ihrer Audiodaten.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex gap-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border">
            <Info className="w-5 h-5 text-blue-500 shrink-0" />
            <ul className="list-disc pl-4 space-y-1">
              <li>Ihre Sprache wird aufgezeichnet und zur Transkription an Azure Whisper gesendet.</li>
              <li>Die Audiodaten werden <strong>sofort nach der Verarbeitung gelöscht</strong>.</li>
              <li>Es findet keine dauerhafte Speicherung der Audiodateien statt.</li>
              <li>Die Verarbeitung erfolgt ausschließlich auf Servern innerhalb der EU.</li>
            </ul>
          </div>
          <p className="text-xs text-slate-500">
            Sie können diese Einwilligung jederzeit in den Einstellungen widerrufen. Durch Klicken auf "Akzeptieren" erklären Sie sich mit der beschriebenen Verarbeitung einverstanden.
          </p>
        </div>

        <DialogFooter className="sm:justify-center">
          <Button onClick={onAccept} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
            Akzeptieren & Fortfahren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { WorkerShell } from '@/components/worker-shell';
import { NewReportForm } from '@/components/new-report-form';
import { PhotoDocumentation } from '@/components/photo-documentation';
import { MaterialTracking } from '@/components/material-tracking';
import { SignaturePad } from '@/components/signature-pad';
import { VoiceInput } from '@/components/voice-input/voice-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function WorkerPage() {
  return (
    <WorkerShell>
      <div className="space-y-6">
        <header>
          <h2 className="text-2xl font-bold text-slate-800">Neuer Arbeitsbericht</h2>
          <p className="text-slate-500 text-sm">Dokumentieren Sie Ihre Arbeit auf der Baustelle.</p>
        </header>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-12">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="voice">Sprache</TabsTrigger>
            <TabsTrigger value="materials">Material</TabsTrigger>
            <TabsTrigger value="photos">Fotos</TabsTrigger>
            <TabsTrigger value="sign">Abschluss</TabsTrigger>
          </TabsList>
          
          <TabsContent value="info" className="mt-4">
            <NewReportForm />
          </TabsContent>

          <TabsContent value="voice" className="mt-4">
            <VoiceInput />
          </TabsContent>

          <TabsContent value="materials" className="mt-4">
            <MaterialTracking />
          </TabsContent>
          
          <TabsContent value="photos" className="mt-4">
            <PhotoDocumentation />
          </TabsContent>
          
          <TabsContent value="sign" className="mt-4">
            <SignaturePad />
          </TabsContent>
        </Tabs>
      </div>
    </WorkerShell>
  );
}

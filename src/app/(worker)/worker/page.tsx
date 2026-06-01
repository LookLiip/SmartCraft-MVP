'use client';

import React, { useState } from 'react';
import { WorkerShell } from '@/components/worker-shell';
import { NewReportForm } from '@/components/new-report-form';
import { PhotoDocumentation } from '@/components/photo-documentation';
import { MaterialTracking } from '@/components/material-tracking';
import { SignaturePad } from '@/components/signature-pad';
import { VoiceInput } from '@/components/voice-input/voice-input';
import { ReportsList } from '@/components/reports-list';
import { OrgSettings } from '@/components/org-settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function WorkerPage() {
  const [activeTab, setActiveTab] = useState('info');

  return (
    <WorkerShell activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="space-y-6">
        <header>
          <h2 className="text-2xl font-bold text-slate-800">
            {activeTab === 'list' ? 'Meine Berichte' : 'Neuer Arbeitsbericht'}
          </h2>
          <p className="text-slate-500 text-sm">
            {activeTab === 'list' 
              ? 'Übersicht aller eingereichten und geplanten Berichte.' 
              : 'Dokumentieren Sie Ihre Arbeit auf der Baustelle.'}
          </p>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-12">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="voice">Sprache</TabsTrigger>
            <TabsTrigger value="materials">Material</TabsTrigger>
            <TabsTrigger value="photos">Fotos</TabsTrigger>
            <TabsTrigger value="sign">Abschluss</TabsTrigger>
          </TabsList>
          
          <TabsContent value="info" className="mt-4">
            <NewReportForm onReportStarted={() => setActiveTab('voice')} />
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
            <SignaturePad onComplete={() => setActiveTab('list')} />
          </TabsContent>

          <TabsContent value="list" className="mt-4">
            <ReportsList />
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <OrgSettings />
          </TabsContent>
        </Tabs>
      </div>
    </WorkerShell>
  );
}

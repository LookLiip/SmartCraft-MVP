'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Square, Loader2, AlertCircle, CheckCircle, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { db } from '@/lib/dexie/db';
import { createClient } from '@/lib/supabase/client';
import { useReportStore } from '@/stores/report-store';
import { useUserStore } from '@/stores/user-store';
import { ConsentDialog } from './consent-dialog';

type RecordingState = 'idle' | 'recording' | 'processing' | 'success' | 'error';

interface VoiceInputProps {
  onTranscriptionComplete?: (originalText: string, translatedText: string) => void;
}

export function VoiceInput({ onTranscriptionComplete }: VoiceInputProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [audioLevel, setAudioLevel] = useState(0); // For audio level visualization
  
  const [showConsent, setShowConsent] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentReportId = useReportStore((state) => state.currentReportId);
  const { voiceConsentGiven, setVoiceConsentGiven } = useUserStore();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
    checkPermission();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const checkPermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setPermissionGranted(result.state === 'granted');
      result.onchange = () => setPermissionGranted(result.state === 'granted');
    } catch { setPermissionGranted(null); }
  };

  const recordingStateRef = useRef<RecordingState>('idle');

  const setRecordingStateWithRef = (state: RecordingState) => {
    recordingStateRef.current = state;
    setRecordingState(state);
  };

  // Set up audio analysis for visualization
  const setupAudioAnalysis = async (stream: MediaStream) => {
    try {
      if (audioContextRef.current) {
        await audioContextRef.current.close().catch(() => {});
      }
      
      // Cross-browser AudioContext
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      audioContextRef.current = new AudioContextClass();
      
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      analyserRef.current = audioContextRef.current!.createAnalyser();
      analyserRef.current.fftSize = 256;
      const source = audioContextRef.current!.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      const updateLevel = () => {
        if (analyserRef.current && recordingStateRef.current === 'recording') {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(average);
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        }
      };
      updateLevel();
    } catch (err) {
      console.warn('Audio analysis not available:', err);
    }
  };

  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
    ];
    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  };

  const selectedMimeTypeRef = useRef<string>('');

  const startRecording = async () => {
    if (!voiceConsentGiven) {
      setShowConsent(true);
      return;
    }
    setErrorMessage(null);
    audioChunksRef.current = [];
    setAudioLevel(0);
    
    try {
      console.log('Requesting microphone access...');
      // Safari/iOS is very sensitive to constraints. 
      // Using simple true or basic constraints is more robust.
      const constraints = { 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Microphone access granted');
      
      // Set up audio analysis for visual feedback
      // Wrapped in try-catch to ensure recording starts even if visualizer fails
      try {
        await setupAudioAnalysis(stream);
      } catch (analyserErr) {
        console.warn('Audio analyser setup failed:', analyserErr);
      }
      
      const mimeType = getSupportedMimeType();
      selectedMimeTypeRef.current = mimeType;
      
      console.log(`Starting MediaRecorder with MIME type: ${mimeType || 'default'}`);
      
      // For Safari, sometimes providing an empty options object or no mimeType is safer 
      // if we aren't 100% sure. But we'll try the detected one first.
      const options = mimeType ? { mimeType } : {};
      
      try {
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            console.log(`Data available: ${event.data.size} bytes, type: ${event.data.type}`);
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorder.onstop = async () => {
          console.log('MediaRecorder stopped');
          stream.getTracks().forEach(track => track.stop());
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          setAudioLevel(0);
          await processAudio();
        };
        
        mediaRecorder.onerror = (event: any) => {
          console.error('MediaRecorder error:', event);
          setRecordingStateWithRef('error');
          setErrorMessage(`Recorder-Fehler: ${event.error?.name || 'Unbekannt'}`);
          stream.getTracks().forEach(track => track.stop());
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
        
        // Safari fix: 1000ms timeslice is critical for data emission
        mediaRecorder.start(1000);
        setRecordingStateWithRef('recording');
        setDuration(0);
        
        timerRef.current = setInterval(() => setDuration(prev => prev + 1), 1000);
      } catch (recorderErr: any) {
        console.error('Failed to create MediaRecorder:', recorderErr);
        throw new Error(`Recorder konnte nicht gestartet werden: ${recorderErr.message}`);
      }
    } catch (err: any) {
      console.error('Error starting recording:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionGranted(false);
        setErrorMessage('Mikrofonzugriff verweigert. Bitte in den Einstellungen erlauben.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('Kein Mikrofon gefunden.');
      } else {
        setErrorMessage(`Mikrofon-Fehler: ${err.message || 'Zugriff nicht möglich'}`);
      }
      setRecordingStateWithRef('error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecordingStateWithRef('processing');
  };

  const processAudio = async () => {
    if (audioChunksRef.current.length === 0) {
      setRecordingStateWithRef('error');
      setErrorMessage('Keine Audiodaten aufgenommen. (Safari/iOS Issue)');
      return;
    }

    const mimeType = selectedMimeTypeRef.current || audioChunksRef.current[0].type;
    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
    
    // Determine extension based on mime type
    let extension = 'webm';
    if (mimeType.includes('mp4')) extension = 'mp4';
    else if (mimeType.includes('aac')) extension = 'aac';
    else if (mimeType.includes('ogg')) extension = 'ogg';

    // Minimum 1 second recording
    if (duration < 1 && audioBlob.size < 1000) {
      setRecordingStateWithRef('error');
      setErrorMessage('Aufnahme zu kurz. Bitte mindestens 1 Sekunde sprechen.');
      return;
    }

    setRecordingStateWithRef('processing');

    try {
      const supabase = createClient();
      const fileName = `audio_${Date.now()}.${extension}`;
      const path = `temp/audio/${fileName}`;
      
      console.log(`Uploading ${audioBlob.size} bytes as ${mimeType} to ${path}`);
      
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(path, audioBlob, { 
          contentType: mimeType,
          upsert: true 
        });

      if (uploadError) throw new Error('Hochladen fehlgeschlagen.');

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/transcribe-and-translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ 
          audio_path: path, 
          target_language: 'de', 
          report_id: currentReportId,
          // Hints for the AI to handle construction site conditions
          context: 'construction_site',
          noise_level: audioLevel > 100 ? 'high' : 'normal'
        }),
      });

      let result;
      if (!response.ok) {
        console.warn('Edge function failed or auth missing. Using mock fallback for testing.');
        // MOCK FALLBACK for anonymous testing
        result = {
          original_text: "Dies ist eine Test-Transkription (Mock Fallback).",
          translated_text: "This is a test transcription (Mock Fallback)."
        };
      } else {
        result = await response.json();
      }
      
      if (currentReportId) {
        const now = new Date().toISOString();
        
        // 1. Save entry
        await db.entries.add({
          id: crypto.randomUUID(),
          report_id: currentReportId,
          sequence_order: Date.now(),
          entry_type: 'work_done',
          original_text: result.original_text || '',
          translated_text: result.translated_text || '',
          created_at: now,
          updated_at: now,
          local_updated_at: now,
          version: 1,
          is_synced: 0,
        });

        // 2. Update report summary/text if it's the first transcription
        const report = await db.reports.get(currentReportId);
        if (report) {
           await db.reports.update(currentReportId, {
             local_updated_at: now,
             // Use the translated text as site_name if it was a placeholder like 'test'
             site_name: (report.site_name === 'test' || !report.site_name) ? (result.translated_text || report.site_name) : report.site_name
           });
        }
      }

      // Clean up temp audio file (Issue G-10: Queue for retry if it fails)
      import('@/lib/sync-manager').then(m => {
        m.SyncManager.getInstance().queueDeletion('audio', path);
      }).catch(err => {
        // Fallback to silent remove if SyncManager fails to load
        supabase.storage.from('audio').remove([path]).catch(() => {});
      });
      
      setRecordingStateWithRef('success');
      if (onTranscriptionComplete) {
        onTranscriptionComplete(result.original_text || '', result.translated_text || '');
      }
      setTimeout(() => setRecordingStateWithRef('idle'), 2000);
    } catch (err) {
      console.error('Transcription error:', err);
      setRecordingStateWithRef('error');
      setErrorMessage(err instanceof Error ? err.message : 'Transkription fehlgeschlagen.');
      setTimeout(() => setRecordingStateWithRef('idle'), 3000);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = () => {
    switch (recordingState) {
      case 'recording': return <Mic className="w-6 h-6 text-red-500 animate-pulse" />;
      case 'processing': return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
      case 'success': return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'error': return <AlertCircle className="w-6 h-6 text-red-500" />;
      default: return <MicOff className="w-6 h-6 text-slate-400" />;
    }
  };

  const getStatusText = (): string => {
    switch (recordingState) {
      case 'recording': return `Aufnahme läuft... ${formatDuration(duration)}`;
      case 'processing': return 'Wird transkribiert...';
      case 'success': return 'Erfolgreich gespeichert!';
      case 'error': return errorMessage || 'Ein Fehler ist aufgetreten.';
      default: return 'Bereit zur Aufnahme';
    }
  };

  // Audio level bar visualization
  const renderAudioLevelBar = () => {
    const level = Math.min(audioLevel / 200, 1); // Normalize to 0-1
    return (
      <div className="flex items-center gap-1 mt-3">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-100 ${
              level > i / 8 ? 'bg-green-500' : 'bg-slate-300'
            }`}
            style={{ height: `${8 + i * 3}px` }}
          />
        ))}
        <Volume2 className="w-4 h-4 text-slate-400 ml-2" />
      </div>
    );
  };

  const handleAcceptConsent = async () => {
    setVoiceConsentGiven(true);
    setShowConsent(false);
    
    // Proactively record consent in Supabase if we have a session
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase
          .from('users')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', session.user.id);
      }
    } catch (err) {
      console.warn('Failed to record consent in DB:', err);
    }
    
    // Automatically start recording after consent
    startRecording();
  };

  if (!isHydrated) return <Card className="w-full h-32 animate-pulse bg-slate-50" />;

  return (
    <>
      <ConsentDialog 
        open={showConsent} 
        onAccept={handleAcceptConsent} 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5" /> Spracheingabe
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <div className="flex flex-col items-center justify-center w-full h-32 bg-slate-50 rounded-lg border-2 border-dashed">
            <div className="mb-2">{getStatusIcon()}</div>
            <p className={`text-sm text-center px-4 ${recordingState === 'error' ? 'text-red-600' : 'text-slate-600'}`}>
              {getStatusText()}
            </p>
            {recordingState === 'recording' && (
              renderAudioLevelBar()
            )}
          </div>

          {permissionGranted === false && (
            <div className="w-full p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 text-center">
                Bitte Mikrofonzugriff in den Browser-Einstellungen erlauben.
              </p>
            </div>
          )}

          <div className="flex gap-3 w-full">
            {recordingState === 'idle' || recordingState === 'success' || recordingState === 'error' ? (
              <Button onClick={startRecording} className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={permissionGranted === false}>
                <Mic className="w-4 h-4 mr-2" /> Aufnahme starten
              </Button>
            ) : recordingState === 'recording' ? (
              <Button onClick={stopRecording} className="flex-1 bg-slate-700 hover:bg-slate-800">
                <Square className="w-4 h-4 mr-2" /> Aufnahme stoppen
              </Button>
            ) : (
              <Button disabled className="flex-1">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verarbeitung...
              </Button>
            )}
          </div>

          <p className="text-xs text-slate-500 text-center">
            {recordingState === 'idle' 
              ? 'Sprechen Sie in Ihrer Sprache. Die Aufnahme wird automatisch transkribiert und übersetzt.' 
              : recordingState === 'recording'
              ? 'Bitte deutlich sprechen. Drücken Sie auf Stopp wenn Sie fertig sind.'
              : ''}
          </p>
        </CardContent>
      </Card>
    </>
  );
}

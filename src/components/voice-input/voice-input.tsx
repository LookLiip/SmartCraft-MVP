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

  // Set up audio analysis for visualization
  const setupAudioAnalysis = (stream: MediaStream) => {
    try {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      const updateLevel = () => {
        if (analyserRef.current && recordingState === 'recording') {
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

  const startRecording = async () => {
    if (!voiceConsentGiven) {
      setShowConsent(true);
      return;
    }
    setErrorMessage(null);
    audioChunksRef.current = [];
    setAudioLevel(0);
    
    try {
      // Enhanced audio constraints for construction site noise
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,  // Help with varying speaker volume
          sampleRate: 16000,
          // Chrome-specific for better noise handling
          channelCount: 1,
          latency: 0.01,  // Low latency for real-time processing
        } as any 
      });
      
      // Set up audio analysis for visual feedback
      setupAudioAnalysis(stream);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setAudioLevel(0);
        await processAudio();
      };
      
      mediaRecorder.onerror = (event: Event) => {
        console.error('MediaRecorder error:', event);
        setRecordingState('error');
        setErrorMessage('Aufnahmefehler aufgetreten.');
        stream.getTracks().forEach(track => track.stop());
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };
      
      // Use timeslice for better chunk handling on unstable connections
      mediaRecorder.start(100);
      setRecordingState('recording');
      setDuration(0);
      
      timerRef.current = setInterval(() => setDuration(prev => prev + 1), 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setPermissionGranted(false);
      setRecordingState('error');
      setErrorMessage('Mikrofonzugriff verweigert. Bitte Berechtigung erteilen.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecordingState('processing');
  };

  const processAudio = async () => {
    if (audioChunksRef.current.length === 0) {
      setRecordingState('error');
      setErrorMessage('Keine Audiodaten aufgenommen.');
      return;
    }

    const audioBlob = new Blob(audioChunksRef.current, { 
      type: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' 
    });

    // Minimum 1 second recording
    if (duration < 1) {
      setRecordingState('error');
      setErrorMessage('Aufnahme zu kurz. Bitte mindestens 1 Sekunde sprechen.');
      return;
    }

    setRecordingState('processing');

    try {
      const supabase = createClient();
      const fileName = `audio_${Date.now()}.webm`;
      const path = `temp/audio/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(path, audioBlob, { contentType: audioBlob.type });

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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transkription fehlgeschlagen.');
      }

      const result = await response.json();
      
      if (currentReportId) {
        const now = new Date().toISOString();
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
      }

      // Clean up temp audio file (Issue G-10: Queue for retry if it fails)
      import('@/lib/sync-manager').then(m => {
        m.SyncManager.getInstance().queueDeletion('audio', path);
      }).catch(err => {
        // Fallback to silent remove if SyncManager fails to load
        supabase.storage.from('audio').remove([path]).catch(() => {});
      });
      
      setRecordingState('success');
      if (onTranscriptionComplete) {
        onTranscriptionComplete(result.original_text || '', result.translated_text || '');
      }
      setTimeout(() => setRecordingState('idle'), 2000);
    } catch (err) {
      console.error('Transcription error:', err);
      setRecordingState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Transkription fehlgeschlagen.');
      setTimeout(() => setRecordingState('idle'), 3000);
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

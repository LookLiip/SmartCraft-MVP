// Supabase Edge Function: transcribe-and-translate
// Uses Azure OpenAI Whisper (Frankfurt) for transcription
// Uses Azure OpenAI GPT-4o (Frankfurt) for professional German translation
// Supports both Azure OpenAI and standard OpenAI API (for sk-proj- keys)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  'https://smartcraft.app',
  'https://www.smartcraft.app',
  'https://app.smartcraft.app',
  /\.vercel\.app$/,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && ALLOWED_ORIGINS.some(allowed =>
    typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
  );
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin! : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

interface TranscriptionRequest {
  audio_path: string;
  target_language?: string;
  report_id?: string;
  context?: string;
  noise_level?: 'high' | 'normal';
}

/**
 * Determine if API key is OpenAI format (sk-proj-) vs Azure format
 */
function isOpenAIKey(apiKey: string): boolean {
  return apiKey.startsWith('sk-proj-') || apiKey.startsWith('sk-');
}

/**
 * Call GPT translation with OpenAI API (standard endpoint)
 */
async function callOpenAI(messages: any[], apiKey: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${errorText}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content?.trim() || "";
}

/**
 * Call GPT translation with Azure OpenAI API
 */
async function callAzureOpenAI(messages: any[], endpoint: string, apiKey: string, deploymentName: string): Promise<string> {
  const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-06-01`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure OpenAI API error: ${errorText}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content?.trim() || "";
}

serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const azureWhisperEndpoint = Deno.env.get("AZURE_WHISPER_ENDPOINT")!;
    const azureWhisperApiKey = Deno.env.get("AZURE_WHISPER_API_KEY")!;
    const azureOpenAIEndpoint = Deno.env.get("AZURE_OPENAI_ENDPOINT")!;
    const azureOpenAIApiKey = Deno.env.get("AZURE_OPENAI_API_KEY")!;
    const azureOpenAIDeploymentName = Deno.env.get("AZURE_OPENAI_DEPLOYMENT_NAME") || "gpt-4o";
    
    // Check if we should use OpenAI API or Azure OpenAI
    const useOpenAI = isOpenAIKey(azureOpenAIApiKey);
    console.log(`Using ${useOpenAI ? 'OpenAI' : 'Azure OpenAI'} API for translation`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { audio_path, target_language = "de", report_id, context, noise_level }: TranscriptionRequest = await req.json();

    if (!audio_path) {
      return new Response(JSON.stringify({ error: "audio_path is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing audio: ${audio_path}, context: ${context}, noise: ${noise_level}`);

    // Step 1: Download audio from Supabase Storage
    const { data: audioData, error: downloadError } = await supabase.storage
      .from("audio")
      .download(audio_path);

    if (downloadError || !audioData) {
      console.error("Download error:", downloadError);
      return new Response(JSON.stringify({ error: "Failed to download audio file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Transcribe with Whisper
    // For OpenAI API, we need to use OpenAI's transcription endpoint
    // For Azure, we use Azure's Whisper endpoint
    let rawText = "";
    
    if (useOpenAI) {
      // Use OpenAI's audio transcription API
      const formData = new FormData();
      formData.append("file", audioData, "audio.webm");
      formData.append("model", "whisper");
      
      const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${azureWhisperApiKey}`,
        },
        body: formData,
      });
      
      if (!whisperResponse.ok) {
        const errorText = await whisperResponse.text();
        console.error("Whisper API error:", errorText);
        return new Response(JSON.stringify({ error: "Transcription failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const whisperResult = await whisperResponse.json();
      rawText = whisperResult.text?.trim() || "";
    } else {
      // Use Azure Whisper
      const formData = new FormData();
      formData.append("file", audioData, "audio.webm");
      formData.append("model", "whisper");

      const whisperResponse = await fetch(`${azureWhisperEndpoint}/openai/deployments/whisper/openai/completions?api-version=2024-06-01`, {
        method: "POST",
        headers: { "api-key": azureWhisperApiKey },
        body: formData,
      });

      if (!whisperResponse.ok) {
        const errorText = await whisperResponse.text();
        console.error("Whisper API error:", errorText);
        return new Response(JSON.stringify({ error: "Transcription failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const whisperResult = await whisperResponse.json();
      rawText = whisperResult.choices?.[0]?.text?.trim() || whisperResult.text?.trim() || "";
    }

    if (!rawText) {
      return new Response(JSON.stringify({ error: "No speech detected in audio" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2.5: Clean transcription artifacts
    const originalText = cleanTranscription(rawText);

    console.log(`Transcription: ${originalText.substring(0, 50)}...`);

    // Step 3: Detect language
    const detectedLanguage = detectLanguage(originalText);

    // Step 4: Translate to professional German using GPT-4o
    const systemPrompt = `You are a professional German technical writer specializing in construction reports.
Translate the following work report from ${getLanguageName(detectedLanguage)} to professional, formal German suitable for client-facing documentation.
Use industry-standard construction terminology.
${context === 'construction_site' ? 'This is a construction site report - the speaker may have a heavy accent and there may be background noise. Focus on extracting the clear, meaningful content.' : ''}
Preserve the exact meaning — do not add or omit information.
Structure the text clearly with proper punctuation.
When encountering unclear words that sound like construction terms (electrical, plumbing, carpentry), interpret them in that context.`;

    const userPrompt = buildTranslationPrompt(originalText, detectedLanguage, context);

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    let translatedText = "";
    
    try {
      if (useOpenAI) {
        translatedText = await callOpenAI(messages, azureOpenAIApiKey);
      } else {
        translatedText = await callAzureOpenAI(messages, azureOpenAIEndpoint, azureOpenAIApiKey, azureOpenAIDeploymentName);
      }
    } catch (translationError) {
      console.error("Translation error:", translationError);
      return new Response(JSON.stringify({
        error: `Translation failed: ${translationError.message}`,
        original_text: originalText,
        translated_text: ""
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Translation: ${translatedText.substring(0, 50)}...`);

    // Step 5: Update report with raw transcription if report_id provided
    if (report_id) {
      await supabase
        .from("reports")
        .update({
          original_transcription: originalText,
          updated_at: new Date().toISOString()
        })
        .eq("id", report_id);
    }

    // Return results
    return new Response(JSON.stringify({
      original_text: originalText,
      translated_text: translatedText,
      detected_language: detectedLanguage,
      success: true,
      api_mode: useOpenAI ? "openai" : "azure"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({
      error: error.message || "Internal server error",
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function cleanTranscription(text: string): string {
  let cleaned = text;

  const fillerPatterns = [
    /\b(?:äh|öhm|uhm|hm{1,3}|mm{1,3}|em|eh|ach|so{1,2}|ja{1,2}|okay|ok)\b/gi,
    /\s+/g,
  ];

  for (const pattern of fillerPatterns) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  cleaned = cleaned.replace(/\b(\w+)(\s+\1\b)+/gi, '$1');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if (cleaned.length > 0 && cleaned[0] === cleaned[0].toLowerCase()) {
    cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
  }

  if (cleaned.length > 0 && !/[.!?]$/.test(cleaned)) {
    cleaned = cleaned + '.';
  }

  return cleaned;
}

function detectLanguage(text: string): string {
  const lowerText = text.toLowerCase();

  const deWords = ["der", "die", "das", "und", "ist", "von", "mit", "für", "auf", "nicht", "ich", "wir", "sie", "ein", "eine", "zu", "den", "dem", "einen", "von", "bei", "mit"];
  const trWords = ["bir", "ve", "için", "bu", "da", "de", "ne", "var", "yok", "ben", "sen", "biz", "onlar", "daha", "çok", "kadar", "gibi"];
  const plWords = ["i", "w", "z", "na", "do", "nie", "się", "to", "jest", "być", "byłem", "my", "ty", "się", "tak", "nie", "ale"];
  const roWords = ["și", "de", "a", "în", "pe", "la", "un", "o", "nu", "eu", "tu", "noi", "voi", "ei", "ca", "cu", "sau"];
  const arWords = ["في", "من", "إلى", "على", "هذا", "ال", "أن", "كان", "ليس", "مع", "ما", "هل", "لا", "عن", "بعد"];

  const scores: Record<string, number> = { de: 0, tr: 0, pl: 0, ro: 0, ar: 0 };

  for (const word of deWords) { if (lowerText.includes(word)) scores.de += 2; }
  for (const word of trWords) { if (lowerText.includes(word)) scores.tr += 2; }
  for (const word of plWords) { if (lowerText.includes(word)) scores.pl += 2; }
  for (const word of roWords) { if (lowerText.includes(word)) scores.ro += 2; }
  for (const word of arWords) { if (lowerText.includes(word)) scores.ar += 2; }

  const maxLang = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b);
  if (maxLang[1] === 0) return "unknown";
  return maxLang[0];
}

function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    de: "German", tr: "Turkish", pl: "Polish", ro: "Romanian", ar: "Arabic", unknown: "the detected language"
  };
  return names[code] || "the detected language";
}

function buildTranslationPrompt(text: string, detectedLanguage: string, context?: string): string {
  const contextHint = context === 'construction_site'
    ? '\nNote: This recording may contain background construction noise and the speaker may have a heavy accent. Focus on meaningful content.'
    : '';

  return `Please translate the following work report entry to professional German.

Source language: ${getLanguageName(detectedLanguage)}${contextHint}

Original text:
"${text}"

Translation:`;
}
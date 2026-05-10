// Supabase Edge Function: translate-and-refine
// Refines/translates text via GPT-4o — supports both Azure OpenAI and standard OpenAI API
// GDPR-compliant EU-only processing

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

interface RefineRequest {
  text: string;
  source_language?: string;
  business_type?: string;
  report_id?: string;
  refine_level?: 'translate' | 'refine' | 'formalize';
}

function isOpenAIKey(apiKey: string): boolean {
  return apiKey.startsWith('sk-proj-') || apiKey.startsWith('sk-');
}

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
    const azureOpenAIEndpoint = Deno.env.get("AZURE_OPENAI_ENDPOINT")!;
    const azureOpenAIApiKey = Deno.env.get("AZURE_OPENAI_API_KEY")!;
    const azureOpenAIDeploymentName = Deno.env.get("AZURE_OPENAI_DEPLOYMENT_NAME") || "gpt-4o";

    const useOpenAI = isOpenAIKey(azureOpenAIApiKey);
    console.log(`Using ${useOpenAI ? 'OpenAI' : 'Azure OpenAI'} API for refinement`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { text, source_language = "unknown", business_type = "construction", report_id, refine_level = "translate" }: RefineRequest = await req.json();

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Refining text (${refine_level}): ${text.substring(0, 50)}...`);

    const systemPrompt = buildSystemPrompt(business_type, refine_level);
    const userPrompt = buildUserPrompt(text, source_language, refine_level);

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    let refinedText = "";

    try {
      if (useOpenAI) {
        refinedText = await callOpenAI(messages, azureOpenAIApiKey);
      } else {
        refinedText = await callAzureOpenAI(messages, azureOpenAIEndpoint, azureOpenAIApiKey, azureOpenAIDeploymentName);
      }
    } catch (translationError) {
      console.error("Refinement error:", translationError);
      return new Response(JSON.stringify({ 
        error: `Refinement failed: ${translationError.message}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (report_id && refinedText) {
      await supabase
        .from("reports")
        .update({
          refined_text: refinedText,
          updated_at: new Date().toISOString()
        })
        .eq("id", report_id);
    }

    return new Response(JSON.stringify({
      original_text: text,
      refined_text: refinedText,
      refine_level,
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

function buildSystemPrompt(business_type: string, refine_level: string): string {
  const businessTerms: Record<string, { terms: string; description: string }> = {
    electrical: {
      terms: "elektrotechnische Fachbegriffe (NEC, VDE, DIN Normen), Starkstrom, Schwachstrom, NYM-J, FI-Schutzschalter",
      description: "elektrischen Installationen"
    },
    plumbing: {
      terms: "SHK-Fachbegriffe (Heizung, Sanitär, Klima), Pressfitting, PE-Rohr, Kupferrohr, Wärmepumpe",
      description: "Heizungs- und Sanitärinstallationen"
    },
    carpentry: {
      terms: "Tischler- und Zimmerer-Fachbegriffe, KVH, BSH, OSB-Platte, Balken, Sparren",
      description: "Tischler- und Zimmererarbeiten"
    },
    general: {
      terms: "allgemeine Bauwesen-Fachbegriffe, Beton, Mauerwerk, Putz, Estrich",
      description: "allgemeinen Bauarbeiten"
    },
    construction: {
      terms: "allgemeine Bauwesen-Fachbegriffe, Beton, Mauerwerk, Putz, Estrich",
      description: "allgemeinen Bauarbeiten"
    }
  };

  const bt = businessTerms[business_type] || businessTerms.general;

  const basePrompt = `You are a professional German technical writer specializing in ${bt.description}.
You are working on a construction work report. Use ${bt.terms} terminology where appropriate.`;

  if (refine_level === "formalize") {
    return basePrompt + `
Your task is to formalize the text while preserving its exact meaning.
- Convert to formal "Sie" form if not already used
- Use proper German grammatical structure
- Apply professional salutations and closings where appropriate
- Maintain all technical details, measurements (m, cm, mm, m², kg), and specifications exactly as provided
- DO NOT invent or add any information not present in the original
- DO NOT guess technical terms - if a word is unclear, keep it in its original form`;
  } else if (refine_level === "refine") {
    return basePrompt + `
Your task is to improve the clarity and professionalism of the text.
- Fix any grammar or syntax issues while preserving meaning
- Use proper German punctuation (., ,, :, ;)
- Structure sentences for better readability
- Preserve the exact meaning — do not add or omit information
- Keep technical terms and measurements intact
- If you encounter non-German words that appear to be technical terms (from Turkish, Polish, Romanian, Arabic), either:
  * Keep them as-is if clearly recognizable technical terms
  * Replace with appropriate German technical equivalents where context is clear`;
  } else {
    return basePrompt + `
Your task is to translate the text to professional German.
- Use formal tone appropriate for client-facing documentation
- Apply industry-standard construction terminology
- Preserve the exact meaning — do not add or omit information
- Structure the text clearly with proper punctuation
- If working with accented or dialect-heavy speech, focus on capturing the semantic meaning
- Common accented patterns: Turkish-German often uses "yapmak" (machen), "var" (geben/sein), Polish-German uses consonant clusters differently`;
  }
}

function buildUserPrompt(text: string, source_language: string, refine_level: string): string {
  const action = refine_level === "formalize" ? "Formalize" : refine_level === "refine" ? "Refine" : "Translate";
  
  const sourceLangHint = source_language && source_language !== "unknown" 
    ? `Source language hint: ${source_language}\n` 
    : '';
    
  return `${action} the following work report text to professional German.

${sourceLangHint}The speaker may have a heavy accent or use non-standard German. Focus on extracting the meaning and converting it to proper German technical documentation.

Original text:
"${text}"

${action}ed text:`;
}
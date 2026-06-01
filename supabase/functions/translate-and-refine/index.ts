// Supabase Edge Function: translate-and-refine
// Refines/translates text via GPT-4o — supports both Azure OpenAI and standard OpenAI API
// GDPR-compliant EU-only processing

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  'https://smartcraft.app',
  'https://www.smartcraft.app',
  'https://app.smartcraft.app',
  'https://smartcraftmvp.netlify.app',
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
    const supabaseUrl = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const azureOpenAIEndpoint = Deno.env.get("AZURE_OPENAI_ENDPOINT") || "https://api.openai.com/v1";
    const azureOpenAIApiKey = Deno.env.get("AZURE_OPENAI_API_KEY") || Deno.env.get("OPENAI_API_KEY");
    const azureOpenAIDeploymentName = Deno.env.get("AZURE_OPENAI_DEPLOYMENT_NAME") || "gpt-4o";

    if (!supabaseUrl || !supabaseServiceKey || !azureOpenAIApiKey) {
      console.error("Missing required environment variables");
      return new Response(JSON.stringify({ error: "Configuration error: Missing API keys" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const useOpenAI = isOpenAIKey(azureOpenAIApiKey);
    console.log(`Using ${useOpenAI ? 'OpenAI' : 'Azure OpenAI'} API for refinement`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text, source_language = "unknown", business_type = "construction", report_id, refine_level = "translate" } = body;

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
  const businessTerms: Record<string, { terms: string; description: string; examples: string }> = {
    electrical: {
      terms: "NEC, VDE, DIN Normen, NYM-J Kabel, FI-Schutzschalter (Fehlerstrom-Schutzschalter), RCD (Residual Current Device), Verteiler, Schukosteckdose, CEE-Stecker, Drehstrom, Starkstrom, Schwachstrom, Potentialausgleich, Erdung, Blitzschutz",
      description: "elektrischen Installationen, Elektrotechnik und Gebäudetechnik",
      examples: "- \"Kabel verlegt\" → \"Kabelverlegung durchgeführt\"\n- \"Stecker angemacht\" → \"Steckdosen installiert\"\n- \"Sicherung reingemacht\" → \"Sicherungen eingesetzt\""
    },
    plumbing: {
      terms: "SHK (Sanitär-Heizung-Klima), Pressfitting, PE-Rohr (Polyethylen), Kupferrohr, Wärmepumpe, Fußbodenheizung, Heizkörper, Ventil, Druckprüfung, Wasseruhr, Abwasser, Trinkwasserinstallation, Kessel, Solaranlage",
      description: "Heizungs-, Sanitär- und Klimatechnik",
      examples: "- \"Rohr angerbracht\" → \"Rohrleitung verlegt\"\n- \"Heizung angeschlossen\" → \"Heizungsanschluss hergestellt\"\n- \"Kessel eingebaut\" → \"Wärmeerzeuger installiert\""
    },
    carpentry: {
      terms: "KVH (Konstruktionsvollholz), BSH (Brettschichtholz), OSB-Platte (Oriented Strand Board), Balken, Sparren, Pfette, Firstpfette, Keilzinkung, Nut-und-Feder-Verbindung, Beplankung, Dampfbremse, Dampfsperre",
      description: "Tischler- und Zimmererarbeiten",
      examples: "- \"Balken draufgemacht\" → \"Balkenlage montiert\"\n- \"Platte draufgeschraubt\" → \"Beplankung angebracht\"\n- \"Holz gestellt\" → \"Holzkonstruktion aufgestellt\""
    },
    general: {
      terms: "Beton, Mauerwerk, Putz, Estrich, Fliesen, Abdichtung, Schalung, Bewehrung, Fundament, Sohle, Wand, Decke, Stütze, Riegel, Mauerwerk, Schicht, Lage, Arbeitsfläche",
      description: "allgemeinen Bauarbeiten und Bauwesen",
      examples: "- \"Beton reingeschüttet\" → \"Betonage durchgeführt\"\n- \"Mauer gebaut\" → \"Mauerwerk hergestellt\"\n- \"Putz draufgemacht\" → \"Putzarbeiten ausgeführt\""
    },
    construction: {
      terms: "Beton, Mauerwerk, Putz, Estrich, Fliesen, Abdichtung, Schalung, Bewehrung, Fundament, Sohle, Wand, Decke, Stütze, Riegel, Mauerwerk, Schicht, Lage, Arbeitsfläche",
      description: "allgemeinen Bauarbeiten und Bauwesen",
      examples: "- \"Beton reingeschüttet\" → \"Betonage durchgeführt\"\n- \"Mauer gebaut\" → \"Mauerwerk hergestellt\"\n- \"Putz draufgemacht\" → \"Putzarbeiten ausgeführt\""
    }
  };

  const bt = businessTerms[business_type] || businessTerms.general;

  const basePrompt = `You are a professional German technical writer creating client-facing construction documentation for ${bt.description}.
Use this industry terminology: ${bt.terms}.

OUTPUT FORMAT - MANDATORY:
• Start with a clear heading: "Arbeitsbericht" or "Tätigkeitsbericht"
• Use short, professional paragraphs (2-4 sentences each)
• Include measurements and specifications in parentheses when provided: (z.B. "Länge: 12,5 m", "Fläche: 24 m²")
• End with a formal closing line appropriate for the business type

EXAMPLE OUTPUT STYLE:
${bt.examples}

IMPORTANT RULES:
• Use formal "Sie" form or neutral professional tone — NEVER colloquial
• German sentence structure: Verb at position 2, objects before verb when possible
• Technical nouns are capitalized: "Kabelverlegung", "Heizungsinstallation", "Mauerwerk"
• Measurements in German format: comma as decimal separator (12,5 m not 12.5 m)
• Preserve ALL original technical information (dimensions, quantities, materials)
• If a term is unclear, rewrite it using a standard German construction term based on context`;

  if (refine_level === "formalize") {
    return basePrompt + `

REFINE LEVEL: FORMALIZE (Final Polish)
• Convert any informal phrasing to formal German
• Ensure proper German salutation and formal closing
• Verify all technical terms use standard German terminology
• Add appropriate professional framing (date, project info reference)
• Check that the text reads as a natural German document, not a translation`;
  } else if (refine_level === "refine") {
    return basePrompt + `

REFINE LEVEL: CLARITY AND PROFESSIONALISM
• Fix any grammar, syntax, or punctuation issues
• Structure for readability — use paragraph breaks for separate topics
• Ensure technical terms are expressed in proper German technical vocabulary
• Remove any traces of accented speech patterns (filler words, broken syntax)
• Verify all numbers and measurements are correctly interpreted
• Apply proper German compound nouns where appropriate`;
  } else {
    return basePrompt + `

REFINE LEVEL: TRANSLATION FROM ACCENTED SPEECH
• Speaker may have heavy Turkish-German, Polish-German, Romanian-German, or Arabic-German accent
• Common accented patterns to recognize and correct:
  - Turkish-German: "yapmak"→machen/ausführen, "var"→vorhanden/geben, "yok"→nicht vorhanden
  - Polish-German: consonant clusters ( especially "sz", "cz" sounds), plural forms altered
  - Romanian-German: similar vowel substitutions, "se face"→wird gemacht
  - Arabic-German: transferred phrasings, emphasis patterns
• If a word is completely unclear, preserve the most likely meaning based on construction context
• DO NOT produce literal transcription artifacts — produce semantic meaning in proper German
• For heavy accents, prefer clarity over literal word-for-word translation
• Add clarifying context in parentheses if a technical term is ambiguous: (wahrscheinlich "Kabelkanal")`;
  }
}

function buildUserPrompt(text: string, source_language: string, refine_level: string): string {
  const action = refine_level === "formalize" ? "Formalize" : refine_level === "refine" ? "Refine" : "Translate";
  
  const langHint = source_language && source_language !== "unknown" 
    ? `Source language context: ${source_language} (heavy accent possible)\n` 
    : 'Source language: unknown (assume construction site accent)\n';
    
  const levelHint = refine_level === "translate" 
    ? "Focus on semantic meaning over literal words. The speaker may have a heavy non-native German accent.\n"
    : refine_level === "refine"
    ? "Ensure professional formatting and proper German compound nouns.\n"
    : "Apply final polish for client-facing formality.\n";

  return `${action} this work report text to professional German client documentation.

${langHint}${levelHint}IMPORTANT: Output must be in formal German suitable for presenting to a customer. Do NOT return the original text — return ONLY the refined German version.

Original text:
"${text}"

${action}d German version:`;
}
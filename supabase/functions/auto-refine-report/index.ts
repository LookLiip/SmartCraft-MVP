// Supabase Edge Function: auto-refine-report
// Processes all entries in a report and generates a cohesive refined_text via GPT-4o
// Supports both Azure OpenAI and standard OpenAI API — GDPR-compliant EU-only processing

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

interface AutoRefineRequest {
  report_id: string;
  business_type?: string;
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
      max_tokens: 4000,
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
      max_tokens: 4000,
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
    console.log(`Using ${useOpenAI ? 'OpenAI' : 'Azure OpenAI'} API for auto-refinement`);

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

    const { report_id, business_type = "construction" } = body;

    if (!report_id) {
      return new Response(JSON.stringify({ error: "report_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Auto-refining report: ${report_id}`);

    const { data: entries, error: entriesError } = await supabase
      .from("report_entries")
      .select("*")
      .eq("report_id", report_id)
      .order("sequence_order", { ascending: true });

    if (entriesError) {
      console.error("Failed to fetch entries:", entriesError);
      return new Response(JSON.stringify({ error: "Failed to fetch report entries" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ error: "No entries found for report" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const combinedEntries = entries.map((entry, index) =>
      `[${index + 1}] ${entry.original_text}${entry.translated_text ? `\nÜbersetzung: ${entry.translated_text}` : ''}`
    ).join("\n\n");

    const businessTerms: Record<string, { terms: string; description: string; sections: string }> = {
      electrical: {
        terms: "NEC, VDE, DIN Normen, NYM-J Kabel, FI-Schutzschalter, RCD, Verteiler, Schukosteckdose, CEE-Stecker, Drehstrom, Potentialausgleich, Erdung, Blitzschutz",
        description: "elektrischen Installationen und Elektrotechnik",
        sections: "## Elektroinstallation\n\n### Durchgeführte Arbeiten\n\n---\n\n## Abschluss"
      },
      plumbing: {
        terms: "SHK (Sanitär-Heizung-Klima), Pressfitting, PE-Rohr, Kupferrohr, Wärmepumpe, Fußbodenheizung, Heizkörper, Ventil, Druckprüfung, Trinkwasser, Abwasser, Solaranlage",
        description: "Heizungs-, Sanitär- und Klimatechnik",
        sections: "## HLS-Installation (Heizung, Lüftung, Sanitär)\n\n### Durchgeführte Arbeiten\n\n---\n\n## Abschluss"
      },
      carpentry: {
        terms: "KVH (Konstruktionsvollholz), BSH (Brettschichtholz), OSB-Platte, Balken, Sparren, Pfette, Keilzinkung, Nut-und-Feder, Beplankung, Dampfbremse",
        description: "Tischler- und Zimmererarbeiten",
        sections: "## Holzbauarbeiten\n\n### Durchgeführte Arbeiten\n\n---\n\n## Abschluss"
      },
      construction: {
        terms: "Beton, Mauerwerk, Putz, Estrich, Fliesen, Abdichtung, Schalung, Bewehrung, Fundament, Sohle, Wand, Decke",
        description: "allgemeinen Bauarbeiten und Bauwesen",
        sections: "## Bauarbeiten\n\n### Durchgeführte Arbeiten\n\n---\n\n## Abschluss"
      },
      general: {
        terms: "Beton, Mauerwerk, Putz, Estrich, Fliesen, Abdichtung, Schalung, Bewehrung, Fundament, Sohle, Wand, Decke",
        description: "allgemeinen Bauarbeiten und Bauwesen",
        sections: "## Bauarbeiten\n\n### Durchgeführte Arbeiten\n\n---\n\n## Abschluss"
      }
    };
    const bt = businessTerms[business_type] || businessTerms.general;

    const systemPrompt = `You are a professional German technical writer creating client-facing construction documentation.
You specialize in ${bt.description} and your output is presented directly to customers as an official work report.

INPUT CONTEXT:
- Multiple entries from construction site audio recordings
- Speakers may have heavy Turkish-German, Polish-German, Romanian-German, or Arabic-German accents
- Background construction noise may affect audio quality
- Content includes technical terms, measurements, and specifications

OUTPUT REQUIREMENTS - MANDATORY FORMAT:
${bt.sections}

TECHNICAL TERMINOLOGY TO USE:
${bt.terms}

QUALITY STANDARDS:
• German sentence structure: Verb at position 2, objects before verb
• Technical nouns capitalized: "Kabelverlegung", "Heizungsinstallation"
• Measurements: German format with comma (12,5 m, 24 m², 150 kg)
• Preserve ALL original technical data — do not simplify or omit
• Paragraphs: 2-4 sentences each for readability
• Use formal German appropriate for official documentation

ACCENT HANDLING:
• Turkish-German: "yapmak"→ausführen/machen, "var"→vorhanden, "yok"→nicht vorhanden
• Polish-German: consonant clusters, altered plurals
• Romanian-German: "se face"→wird gemacht
• If a word is completely unclear, use context-based interpretation with (wahrscheinlich "...") notation
• Never produce literal transcription artifacts — produce semantic meaning

COMMON TRANSLATION PATTERNS:
- "Ich habe gemacht" → "durchgeführt"
- "Kabeln" → "Kabel" (correct plural)
- "die Maßen" → "die Maße" (correct spelling)
- "gemacht" in construction context → "hergestellt" / "eingebaut" / "montiert" depending on context`;

    const userPrompt = `Compile the following work report entries into a single professional German document.

Entries:
${combinedEntries}

Professional German Report:`;

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
      console.error("Auto-refinement error:", translationError);
      return new Response(JSON.stringify({ error: `Auto-refinement failed: ${translationError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabase
      .from("reports")
      .update({
        refined_text: refinedText,
        status: "pending_review",
        updated_at: new Date().toISOString()
      })
      .eq("id", report_id);

    if (updateError) {
      console.error("Failed to update report:", updateError);
      return new Response(JSON.stringify({ error: "Failed to save refined text" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      report_id,
      refined_text: refinedText,
      entries_processed: entries.length,
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
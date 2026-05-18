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

    // Industry-specific terminology for construction
    const businessTerms: Record<string, string> = {
      electrical: "elektrotechnische Fachbegriffe (NEC, VDE, DIN Normen), Kabel, Leitungen, FI-Schutzschalter, Verteiler, NYM-J, Schukosteckdosen",
      plumbing: "SHK-Fachbegriffe, Rohrleitungen, Heizung, Sanitär, Ventile, Druckprüfung, PE-Rohr, Kupferrohr, Pressfitting",
      carpentry: "Tischler- und Zimmerer-Fachbegriffe, Holzarten, KVH, BSH, OSB-Platten, Balken, Sparren, Pfetten",
      construction: "allgemeine Bauwesen-Fachbegriffe, Mauerwerk, Beton, Putz, Estrich, Fliesen, Abdichtung",
      general: "allgemeine Bauwesen-Fachbegriffe, Mauerwerk, Beton, Putz, Estrich, Fliesen, Abdichtung"
    };
    const terms = businessTerms[business_type] || businessTerms.general;

    const systemPrompt = `You are a professional German technical writer specializing in construction reports.
Your task is to compile a complete, professional German work report from multiple entries recorded on a construction site.

IMPORTANT CONTEXT:
- Original entries were transcribed from audio recordings on construction sites
- Speakers may have heavy accents (Turkish, Polish, Romanian, Arabic backgrounds)
- There may be background construction noise affecting audio quality
- Focus on extracting meaningful technical content, not literal transcription artifacts

REPORT COMPILATION RULES:
- Combine all entries into a cohesive document
- Use formal German appropriate for client-facing documentation
- Apply industry-standard construction terminology (${terms})
- Preserve all technical details, measurements (m, cm, mm, m², kg), and specifications exactly as provided
- DO NOT invent or add any information not present in the entries
- DO NOT correct or change technical terms - keep professional terminology as-is
- Structure the report clearly with sections if multiple work types are mentioned
- Use proper German punctuation and grammar
- Clean up filler words or repetitions from accented speech but preserve meaning
- Common accented patterns: "yapmak"→machen/ausführen, measurements said in accented German`;

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
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { reportId } = await req.json()
    if (!reportId) throw new Error("reportId is required")

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const browserlessToken = Deno.env.get('BROWSERLESS_API_KEY')

    if (!browserlessToken) {
        throw new Error("BROWSERLESS_API_KEY not set in Edge Function secrets")
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Fetch Report Data
    const { data: report, error: reportError } = await supabaseClient
      .from('reports')
      .select('*, organizations(*)')
      .eq('id', reportId)
      .single()

    if (reportError) throw reportError

    // 2. Fetch Materials
    const { data: materials } = await supabaseClient
      .from('materials')
      .select('*')
      .eq('report_id', reportId)

    // 3. Fetch Photos
    const { data: photos } = await supabaseClient
      .from('photos')
      .select('*')
      .eq('report_id', reportId)
      .eq('visibility', 'client_facing')

    // 4. Fetch Signatures
    const { data: signatures } = await supabaseClient
      .from('signatures')
      .select('*')
      .eq('report_id', reportId)

    const org = report.organizations || {}
    
    // Get Signed URLs for photos and signatures
    const photosWithUrls = await Promise.all((photos || []).map(async (photo) => {
      const { data } = await supabaseClient.storage.from('photos-client-facing').createSignedUrl(photo.storage_path, 3600)
      return { ...photo, url: data?.signedUrl }
    }))

    const signaturesWithUrls = await Promise.all((signatures || []).map(async (sig) => {
      const { data } = await supabaseClient.storage.from('signatures').createSignedUrl(sig.storage_path, 3600)
      return { ...sig, url: data?.signedUrl }
    }))

    // 5. Generate HTML
    const html = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            color: #1e293b;
            line-height: 1.5;
            margin: 0;
            padding: 0;
        }
        .header {
            width: 100%;
            margin-bottom: 20px;
        }
        .letterhead {
            width: 100%;
            max-height: 150px;
            object-fit: contain;
        }
        .report-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 10px;
        }
        .report-info h1 {
            margin: 0;
            font-size: 24px;
            color: #0f172a;
        }
        .meta-grid {
            display: grid;
            grid-template-cols: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        .meta-item label {
            display: block;
            font-size: 10px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: bold;
        }
        .meta-item span {
            font-size: 14px;
            font-weight: 500;
        }
        .section {
            margin-bottom: 30px;
        }
        .section-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
            border-left: 4px solid #3b82f6;
            padding-left: 10px;
            color: #1e3a8a;
        }
        .refined-text {
            white-space: pre-wrap;
            font-size: 14px;
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th {
            text-align: left;
            font-size: 12px;
            color: #64748b;
            border-bottom: 1px solid #e2e8f0;
            padding: 8px 4px;
        }
        td {
            padding: 10px 4px;
            font-size: 13px;
            border-bottom: 1px solid #f1f5f9;
        }
        .photo-grid {
            display: grid;
            grid-template-cols: 1fr 1fr;
            gap: 15px;
        }
        .photo-card {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            overflow: hidden;
            break-inside: avoid;
        }
        .photo-img {
            width: 100%;
            height: 200px;
            object-fit: cover;
        }
        .photo-caption {
            padding: 8px;
            font-size: 11px;
            color: #475569;
            background: #fff;
        }
        .signature-grid {
            display: grid;
            grid-template-cols: 1fr 1fr;
            gap: 40px;
            margin-top: 50px;
        }
        .signature-box {
            text-align: center;
            border-top: 1px solid #cbd5e1;
            padding-top: 10px;
        }
        .signature-img {
            max-height: 80px;
            margin-bottom: 5px;
        }
        .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            font-size: 10px;
            color: #94a3b8;
            text-align: center;
        }
    </style>
</head>
<body>
    ${org.letterhead_url ? `
    <div class="header">
        <img src="${org.letterhead_url}" class="letterhead" />
    </div>
    ` : ''}

    <div class="report-info">
        <h1>Arbeitsbericht</h1>
        <div style="text-align: right">
            <div style="font-size: 12px; color: #64748b">Bericht-Nr: ${report.id.split('-')[0].toUpperCase()}</div>
            <div style="font-size: 14px; font-weight: bold">${new Date(report.work_date).toLocaleDateString('de-DE')}</div>
        </div>
    </div>

    <div class="meta-grid">
        <div class="meta-item">
            <label>Baustelle / Projekt</label>
            <span>${report.site_name || '-'}</span>
        </div>
        <div class="meta-item">
            <label>Kunde</label>
            <span>${report.client_name || '-'}</span>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Ausgeführte Arbeiten</div>
        <div class="refined-text">${report.refined_text || report.translated_text || report.original_transcription}</div>
    </div>

    ${materials && materials.length > 0 ? `
    <div class="section">
        <div class="section-title">Materialverbrauch</div>
        <table>
            <thead>
                <tr>
                    <th>Material</th>
                    <th>Menge</th>
                    <th>Notiz</th>
                </tr>
            </thead>
            <tbody>
                ${materials.map(m => `
                <tr>
                    <td>${m.name_translated || m.name_original}</td>
                    <td>${m.quantity} ${m.unit}</td>
                    <td>${m.notes || '-'}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    ${photosWithUrls && photosWithUrls.length > 0 ? `
    <div class="section">
        <div class="section-title">Fotodokumentation</div>
        <div class="photo-grid">
            ${photosWithUrls.map(p => `
            <div class="photo-card">
                <img src="${p.url}" class="photo-img" />
                <div class="photo-caption">${p.caption_original || 'Dokumentationsfoto'}</div>
            </div>
            `).join('')}
        </div>
    </div>
    ` : ''}

    <div class="signature-grid">
        ${signaturesWithUrls.map(s => `
        <div class="signature-box">
            <img src="${s.url}" class="signature-img" />
            <div style="font-size: 12px; font-weight: bold">${s.signer_name}</div>
            <div style="font-size: 10px; color: #64748b">${s.signer_role === 'client' ? 'Unterschrift Kunde' : 'Unterschrift Mitarbeiter'}</div>
            <div style="font-size: 10px; color: #94a3b8">${new Date(s.signed_at).toLocaleString('de-DE')}</div>
        </div>
        `).join('')}
    </div>

    <div class="footer">
        ${org.name} &bull; Erstellt mit SmartCraft MVP
    </div>
</body>
</html>
    `

    // 6. Connect to Browserless
    const browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}`,
    })
    
    const page = await browser.newPage()
    
    // Set viewport for better rendering
    await page.setViewport({ width: 1200, height: 1600 })
    
    await page.setContent(html, { waitUntil: 'networkidle0' })
    
    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: `${org.margin_top || 10}mm`,
        bottom: `${org.margin_bottom || 10}mm`,
        left: `${org.margin_left || 10}mm`,
        right: `${org.margin_right || 10}mm`,
      },
      printBackground: true,
    })

    await browser.close()

    return new Response(pdf, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
      },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

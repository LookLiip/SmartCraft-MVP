# Supabase Edge Functions Deployment Guide

## Project Info
- Project URL: https://dumrylcrjaienqvtkfss.supabase.co
- Project Ref: dumrylcrjaienqvtkfss

## Edge Functions to Deploy

1. **transcribe-and-translate** — Main voice transcription pipeline
2. **translate-and-refine** — Admin text refinement
3. **auto-refine-report** — Batch report compilation

## Required Environment Secrets

Set the following secrets in Supabase project:

```bash
supabase secrets set AZURE_OPENAI_API_KEY=your-new-openai-key
supabase secrets set AZURE_OPENAI_ENDPOINT=https://api.openai.com
supabase secrets set AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
supabase secrets set AZURE_OPENAI_REGION=germanynorth
supabase secrets set OPENAI_API_KEY=your-new-openai-key
```

Note: The Edge Functions now auto-detect `sk-proj-` keys and use OpenAI API directly, or fallback to Azure OpenAI for Azure-format keys.

## Deployment Commands

```bash
cd /home/team/shared/smartcraft-app

# Link to Supabase project
supabase link --project-ref dumrylcrjaienqvtkfss

# Deploy all edge functions
supabase functions deploy transcribe-and-translate
supabase functions deploy translate-and-refine
supabase functions deploy auto-refine-report

# Or deploy all at once
supabase functions deploy --no-verify-jwt
```

## Local Development Testing

To test locally without deploying:
```bash
supabase functions serve transcribe-and-translate --env-file .env.local
```

## Edge Function Files

Located at:
- `/home/team/shared/smartcraft-app/supabase/functions/transcribe-and-translate/index.ts`
- `/home/team/shared/smartcraft-app/supabase/functions/translate-and-refine/index.ts`
- `/home/team/shared/smartcraft-app/supabase/functions/auto-refine-report/index.ts`

## API Mode Detection

The Edge Functions automatically detect API key format:
- If `AZURE_OPENAI_API_KEY` starts with `sk-proj-` or `sk-` → uses OpenAI API (api.openai.com/v1)
- Otherwise → uses Azure OpenAI endpoints

This allows seamless switching between Azure and OpenAI keys without code changes.

## Verification

After deployment, verify with:
```bash
curl -X POST https://dumrylcrjaienqvtkfss.supabase.co/functions/v1/transcribe-and-translate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ANON_KEY" \
  -d '{"text":"test"}'
```

## Storage Bucket Required

Ensure `audio` bucket exists in Supabase Storage (private, 10MB limit).
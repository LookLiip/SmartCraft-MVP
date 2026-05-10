# SmartCraft AI Pipeline - Deployment Instructions

## Edge Functions

All three edge functions are located in `/home/team/shared/smartcraft-app/supabase/functions/`:

### 1. transcribe-and-translate
**Purpose:** Main voice transcription pipeline. Called by the Worker App after audio recording.
- Downloads audio from `audio` bucket
- Calls Azure Whisper (Frankfurt/westeurope) for transcription
- Auto-detects source language (DE, TR, PL, RO, AR via word heuristics)
- Translates to professional German via Azure OpenAI GPT-4o (Frankfurt/germanynorth)
- Updates `reports.original_transcription` field
- Returns: `{ original_text, translated_text, detected_language, success }`

**Deploy:** `supabase functions deploy transcribe-and-translate`

### 2. translate-and-refine
**Purpose:** Admin Dashboard post-editing. Refines/translates text at different levels.
- Input: `{ text, source_language, business_type, report_id, refine_level }`
- refine_level options: `translate` (default), `refine`, `formalize`
- Updates `reports.refined_text` if report_id provided
- Returns: `{ original_text, refined_text, refine_level, success }`

### 3. auto-refine-report
**Purpose:** Batch processing of all entries in a report into a single refined document.
- Fetches all `report_entries` for a report_id
- Combines into prompt and generates cohesive professional German document
- Updates `reports.refined_text` and sets status to `pending_review`
- Returns: `{ report_id, refined_text, entries_processed, success }`

## Required Environment Variables (Supabase Secrets)

```bash
supabase secrets set AZURE_WHISPER_ENDPOINT=https://your-resource.openai.azure.com
supabase secrets set AZURE_WHISPER_API_KEY=your-key
supabase secrets set AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
supabase secrets set AZURE_OPENAI_API_KEY=your-key
supabase secrets set AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
```

## Required Storage Buckets

Create these buckets in Supabase Storage (Dashboard > Storage):
- `audio` - private, 10MB limit, audio/webm and audio/mp4 allowed
- `photos-internal` - private, 10MB limit
- `photos-client-facing` - private, 10MB limit
- `signatures` - private, 1MB limit

## Database Schema

Migration file: `/home/team/shared/smartcraft-app/supabase/migrations/001_initial_schema.sql`

**Key tables:**
- `reports` - has `original_transcription`, `translated_text`, `refined_text` fields
- `report_entries` - has `original_text`, `translated_text` fields
- `photos`, `materials`, `signatures`, `organizations`, `users`

**Triggers included:**
- `update_updated_at_column()` function that auto-updates `updated_at` on row update
- Applied to: `organizations`, `users`, `reports`

## Frontend Components

**VoiceInput** (`src/components/voice-input/voice-input.tsx`):
- Uses MediaRecorder API with 16kHz sample rate, noise suppression, echo cancellation
- Records to webm/mp4 format, uploads to `audio` bucket
- Calls `transcribe-and-translate` edge function
- Saves resulting entry to local Dexie DB

## No Database Triggers Were Missed

The edge functions update tables directly via Supabase client. No database triggers are needed for the AI pipeline itself. The only triggers are the `updated_at` auto-update triggers defined in the migration.

## Business Type Terminology

When calling `translate-and-refine`, specify `business_type` for industry-appropriate terminology:
- `electrical` - elektrotechnische Fachbegriffe
- `plumbing` - SHK-Fachbegriffe (Heizung, Sanitär, Klima)
- `carpentry` - Tischler- und Zimmerer-Fachbegriffe
- `construction` (default) - allgemeine Bauwesen-Fachbegriffe
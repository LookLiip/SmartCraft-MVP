import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkMigration() {
  const { data, error } = await supabase
    .from('organizations')
    .select('letterhead_url')
    .limit(1);

  if (error) {
    if (error.message.includes('column "letterhead_url" does not exist')) {
      console.log('Migration 005 NOT applied: column "letterhead_url" does not exist.');
    } else {
      console.error('Error checking migration:', error.message);
    }
  } else {
    console.log('Migration 005 ALREADY applied: column "letterhead_url" exists.');
  }
}

checkMigration().catch(console.error);

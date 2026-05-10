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

async function checkTables() {
  const { data, error } = await supabase
    .from('reports')
    .select('id')
    .limit(1);

  if (error) {
    console.error('Error fetching reports:', error.message);
    if (error.message.includes('does not exist')) {
        console.log('Table "reports" does not exist. Migrations probably not applied.');
    }
  } else {
    console.log('Table "reports" exists. Migrations might have been applied.');
  }
}

checkTables().catch(console.error);

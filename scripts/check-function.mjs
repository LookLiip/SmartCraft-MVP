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

async function checkFunction() {
  const { data, error } = await supabase.rpc('get_user_org_id');

  if (error) {
    console.log('Function get_user_org_id check failed:', error.message);
  } else {
    console.log('Function get_user_org_id exists (or returned data).');
  }
}

checkFunction().catch(console.error);

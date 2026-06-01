const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching organizations:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Columns in organizations table:', Object.keys(data[0]));
  } else {
    console.log('No data in organizations table, checking table structure via RPC or another way...');
    // If no data, we can try to insert a dummy and rollback, or just use a query that fails if columns are missing
    const { error: columnError } = await supabase
      .from('organizations')
      .select('letterhead_url, margin_top')
      .limit(1);
    
    if (columnError) {
      console.log('Columns letterhead_url or margin_top do NOT exist.');
    } else {
      console.log('Columns letterhead_url and margin_top exist.');
    }
  }
}

checkSchema();

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkReports() {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching reports:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Columns in reports table:', Object.keys(data[0]));
  } else {
    console.log('No data in reports table.');
    const { error: columnError } = await supabase
      .from('reports')
      .select('status')
      .limit(1);
    if (columnError) {
      console.log('Table reports does NOT exist or status column missing.');
    } else {
      console.log('Table reports exists.');
    }
  }
}

checkReports();

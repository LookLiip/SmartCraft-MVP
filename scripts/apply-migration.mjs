import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration(filePath) {
  console.log(`Applying migration: ${filePath}`);
  const sql = fs.readFileSync(filePath, 'utf8');
  
  // We use a trick to run multiple SQL statements: 
  // Supabase doesn't have a direct 'query' method in the JS SDK for arbitrary SQL.
  // We usually have to use a wrapper RPC or the dashboard.
  // However, some environments have an 'exec_sql' or similar RPC.
  
  // Let's check if 'exec_sql' exists, if not we'll have to warn the user.
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  
  if (error) {
    if (error.message.includes('Could not find the function')) {
      console.error('Error: "exec_sql" RPC not found. Please apply the migration manually in the Supabase SQL Editor:');
      console.log('-----------------------------------');
      console.log(sql);
      console.log('-----------------------------------');
    } else {
      console.error('Migration failed:', error);
    }
    return false;
  }
  
  console.log('Migration applied successfully!');
  return true;
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Please provide a migration file path.');
  process.exit(1);
}

applyMigration(path.resolve(migrationFile));

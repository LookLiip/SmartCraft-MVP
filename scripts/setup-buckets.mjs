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

async function setupBuckets() {
  const buckets = [
    { name: 'audio', public: false, maxSize: 10485760 },
    { name: 'photos-internal', public: false, maxSize: 10485760 },
    { name: 'photos-client-facing', public: false, maxSize: 10485760 },
    { name: 'signatures', public: false, maxSize: 1048576 },
    { name: 'letterheads', public: true, maxSize: 5242880 }
  ];

  for (const b of buckets) {
    console.log(`Checking bucket: ${b.name}`);
    const { data, error } = await supabase.storage.getBucket(b.name);
    
    if (error && error.message.includes('not found')) {
      console.log(`Creating bucket: ${b.name}`);
      const { error: createError } = await supabase.storage.createBucket(b.name, {
        public: b.public,
        fileSizeLimit: b.maxSize
      });
      if (createError) console.error(`Error creating ${b.name}:`, createError.message);
      else console.log(`Bucket ${b.name} created successfully.`);
    } else if (error) {
      console.error(`Error fetching ${b.name}:`, error.message);
    } else {
      console.log(`Bucket ${b.name} already exists.`);
    }
  }
}

setupBuckets().catch(console.error);

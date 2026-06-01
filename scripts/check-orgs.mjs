import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '/home/team/shared/smartcraft-app/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkOrgs() {
  console.log('Starting checkOrgs...')
  const { data, error } = await supabase.from('organizations').select('*')
  if (error) {
    console.error('Error fetching organizations:', error)
    return
  }
  console.log('Organizations found:', data.length)
  console.log('Organizations:', data)
}

checkOrgs()

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '/home/team/shared/smartcraft-app/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function checkAuthUsers() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers()
  if (error) {
    console.error('Error fetching auth users:', error)
    return
  }
  console.log('Auth Users found:', users.length)
  users.forEach(u => {
    console.log(`User: ${u.email} (${u.id})`)
  })
}

checkAuthUsers()

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Optionally restrict the admin panel to admin/owner roles. Be lenient:
  // only redirect when we successfully read a profile that is NOT admin/owner.
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData && !['admin', 'owner'].includes(userData.role)) {
    redirect('/worker')
  }

  return <>{children}</>
}

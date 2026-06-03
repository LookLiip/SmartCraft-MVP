import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UserNav } from '@/components/user-nav'

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/worker')
  }
  
  const { data: userData } = await supabase
    .from('users')
    .select('is_super_admin, full_name')
    .eq('id', user.id)
    .single()
    
  if (!userData?.is_super_admin) {
    // If not super admin, check if they are regular admin/owner and send to /admin
    // but the user says they are trapped in worker app.
    // Let's at least allow them to logout if they are not super admin.
    // For now, let's keep the redirect but ensure the check is correct.
    console.log('Super admin check failed for user:', user.email, userData);
    redirect('/worker')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="font-bold text-xl tracking-tight">SmartCraft <span className="text-blue-600">SuperAdmin</span></div>
          <div className="flex items-center gap-4">
            <UserNav email={user.email} name={userData?.full_name} />
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}

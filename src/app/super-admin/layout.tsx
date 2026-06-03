import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
    .select('is_super_admin')
    .eq('id', user.id)
    .single()
    
  if (!userData?.is_super_admin) {
    redirect('/worker')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="font-bold text-xl tracking-tight">SmartCraft <span className="text-blue-600">SuperAdmin</span></div>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span>{user.email}</span>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}

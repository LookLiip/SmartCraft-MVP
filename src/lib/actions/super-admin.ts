'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function getTenantsAction() {
  const supabase = createClient()
  
  // Verify Super Admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  
  const { data: userData } = await supabase
    .from('users')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()
    
  if (!userData?.is_super_admin) return { error: 'Not authorized' }
  
  const { data: tenants, error } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false })
    
  if (error) return { error: error.message }
  return { tenants }
}

export async function createTenantAction(data: {
  name: string;
  slug: string;
  adminEmail: string;
  adminName: string;
}) {
  const supabase = createClient()
  const adminSupabase = createAdminClient()
  
  // 1. Verify Super Admin
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) return { error: 'Not authenticated' }
  
  const { data: userData } = await supabase
    .from('users')
    .select('is_super_admin')
    .eq('id', currentUser.id)
    .single()
    
  if (!userData?.is_super_admin) return { error: 'Not authorized' }
  
  try {
    // 2. Create Organization
    const { data: org, error: orgError } = await adminSupabase
      .from('organizations')
      .insert({
        name: data.name,
        slug: data.slug.toLowerCase().replace(/\s+/g, '-')
      })
      .select()
      .single()
      
    if (orgError) throw orgError
    
    // 3. Create Admin User Invitation/Account
    const { error: authError } = await adminSupabase.auth.admin.inviteUserByEmail(data.adminEmail, {
      data: {
        full_name: data.adminName,
        organization_id: org.id,
        role: 'owner'
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
    })
    
    if (authError) {
      // Rollback org creation if auth fails
      await adminSupabase.from('organizations').delete().eq('id', org.id)
      throw authError
    }
    
    // 4. Create Invitation record
    await adminSupabase.from('user_invitations').insert({
      organization_id: org.id,
      email: data.adminEmail,
      role: 'owner',
      invited_by: currentUser.id
    })

    revalidatePath('/super-admin')
    return { success: true, org }
  } catch (error: any) {
    console.error('Error in createTenantAction:', error)
    return { error: error.message || 'Failed to create tenant' }
  }
}

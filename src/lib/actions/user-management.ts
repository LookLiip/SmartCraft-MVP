'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/**
 * Server action to invite a new user or create a local account.
 */
export async function inviteUserAction(data: {
  email?: string;
  username?: string;
  password?: string;
  role: 'worker' | 'admin' | 'owner';
  full_name: string;
  native_language: string;
}) {
  const { email, username, password, role, full_name, native_language } = data

  if ((!email && !username) || !role || !full_name) {
    return { error: 'Name, Rolle und E-Mail (oder Benutzername) sind erforderlich.' }
  }

  try {
    const supabase = createClient()
    const adminSupabase = createAdminClient()
    
    // 1. Verify that the current user is an admin/owner
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { error: 'Nicht authentifiziert.' }

    const { data: userData } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('id', currentUser.id)
      .single()

    if (!userData || !['admin', 'owner'].includes(userData.role)) {
      return { error: 'Nicht autorisiert: Admin-Rechte erforderlich.' }
    }

    const organization_id = userData.organization_id
    if (!organization_id) {
      return { error: 'Benutzer gehört keiner Organisation an.' }
    }

    // CASE A: Create a local account (no real email)
    if (!email && username) {
      if (!password) return { error: 'Passwort ist für lokale Konten erforderlich.' }
      
      const dummyEmail = `${username.toLowerCase()}@smartcraft.local`
      
      const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email: dummyEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name,
          organization_id,
          role,
          native_language: native_language || 'de'
        }
      })

      if (authError) {
        console.error('Error creating local auth user:', authError)
        return { error: `Benutzer konnte nicht erstellt werden: ${authError.message}` }
      }

      revalidatePath('/admin/users')
      return { success: true }
    }

    // CASE B: Standard Invitation flow (email provided)
    if (email) {
      // 2. Create the invitation in the database first
      const { error: inviteError } = await supabase
        .from('user_invitations')
        .insert({
          email,
          role,
          organization_id,
          invited_by: currentUser.id,
          native_language: native_language || 'de'
        })

      if (inviteError) {
        console.error('Error creating invitation record:', inviteError)
        if (inviteError.code === '23505') {
          return { error: 'Dieser Benutzer wurde bereits eingeladen.' }
        }
        return { error: 'Fehler beim Erstellen der Einladung.' }
      }

      // 3. Trigger Supabase Auth invitation
      const { error: authError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
        data: { 
          full_name: full_name,
          organization_id,
          role,
          native_language: native_language || 'de'
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
      })

      if (authError) {
        console.error('Error sending auth invitation:', authError)
        await supabase.from('user_invitations').delete().eq('email', email).eq('organization_id', organization_id)
        return { error: `Einladungs-E-Mail konnte nicht gesendet werden: ${authError.message}` }
      }

      revalidatePath('/admin/users')
      return { success: true }
    }

    return { error: 'Ungültige Anfrage.' }
  } catch (error) {
    console.error('Unexpected error in inviteUserAction:', error)
    return { error: 'Ein unerwarteter Fehler ist aufgetreten.' }
  }
}

/**
 * Server action to toggle user active status (soft-delete).
 */
export async function toggleUserStatusAction(userId: string, isDeactivating: boolean) {
  try {
    const supabase = createClient()
    
    // 1. Verify admin permissions
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { error: 'Nicht authentifiziert.' }

    const { data: userData } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('id', currentUser.id)
      .single()

    if (!userData || !['admin', 'owner'].includes(userData.role)) {
      return { error: 'Nicht autorisiert.' }
    }

    // 2. Toggle status
    const { error } = await supabase
      .from('users')
      .update({ deleted_at: isDeactivating ? new Date().toISOString() : null })
      .eq('id', userId)
      .eq('organization_id', userData.organization_id) // Safety check: must be same org

    if (error) throw error

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    console.error('Error toggling user status:', error)
    return { error: 'Benutzerstatus konnte nicht geändert werden.' }
  }
}

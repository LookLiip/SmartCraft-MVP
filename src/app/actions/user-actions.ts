'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

/**
 * Server action to invite a new user to the organization.
 */
export async function inviteUserAction(formData: {
  email: string;
  full_name: string;
  role: 'worker' | 'admin' | 'owner';
  native_language: string;
  organization_id: string;
}) {
  const supabase = createClient();
  
  try {
    // 1. Verify that the current user is an admin/owner
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return { error: 'Nicht authentifiziert.' };

    const { data: userData } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('id', currentUser.id)
      .single();

    if (!userData || !['admin', 'owner'].includes(userData.role)) {
      return { error: 'Nicht autorisiert: Admin-Rechte erforderlich.' };
    }

    const organization_id = userData.organization_id;
    if (!organization_id) {
      return { error: 'Benutzer gehört keiner Organisation an.' };
    }

    // Safety: only allow inviting to own organization
    if (organization_id !== formData.organization_id) {
       return { error: 'Ungültige Organisation.' };
    }

    // 2. Create the invitation in the database first
    const { error: inviteError } = await supabase
      .from('user_invitations')
      .insert({
        email: formData.email,
        role: formData.role,
        organization_id,
        invited_by: currentUser.id,
        native_language: formData.native_language || 'de'
      });

    if (inviteError && inviteError.code !== '23505') {
      console.error('Error creating invitation record:', inviteError);
      return { error: 'Fehler beim Erstellen der Einladung in der Datenbank.' };
    }

    // 3. Use the Admin Client to trigger the Supabase Auth invitation
    const adminSupabase = createAdminClient();
    const { data: authData, error: authError } = await adminSupabase.auth.admin.inviteUserByEmail(
      formData.email,
      {
        data: { 
          full_name: formData.full_name,
          organization_id,
          role: formData.role,
          native_language: formData.native_language || 'de'
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
      }
    );

    if (authError) {
      console.error('Error sending auth invitation:', authError);
      // Rollback database invitation if needed
      return { error: `Einladungs-E-Mail konnte nicht gesendet werden: ${authError.message}` };
    }

    revalidatePath('/admin/users');
    return { success: true, user: authData.user };
  } catch (error) {
    console.error('Unexpected error in inviteUserAction:', error);
    return { error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

/**
 * Server action to toggle user active status (soft-delete).
 */
export async function toggleUserStatusAction(userId: string, isDeactivating: boolean) {
  try {
    const supabase = createClient();
    
    // 1. Verify admin permissions
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return { error: 'Nicht authentifiziert.' };

    const { data: userData } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('id', currentUser.id)
      .single();

    if (!userData || !['admin', 'owner'].includes(userData.role)) {
      return { error: 'Nicht autorisiert.' };
    }

    // 2. Toggle status
    const { error } = await supabase
      .from('users')
      .update({ deleted_at: isDeactivating ? new Date().toISOString() : null })
      .eq('id', userId)
      .eq('organization_id', userData.organization_id); // Safety check: must be same org

    if (error) throw error;

    revalidatePath('/admin/users');
    return { success: true };
  } catch (error) {
    console.error('Error toggling user status:', error);
    return { error: 'Benutzerstatus konnte nicht geändert werden.' };
  }
}


import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

export const updateInvitationStatus = async (
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<void> => {
  console.log('📊 Updating invitation status for user:', userId);
  
  try {
    const { error: updateError } = await supabase
      .from('user_invitations')
      .update({ 
        status: 'sent', 
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('❌ Error updating invitation status:', {
        userId,
        error: updateError.message,
        code: updateError.code
      });
      // No lanzamos error aquí porque el email ya se envió exitosamente
      return;
    }

    console.log('✅ Invitation status updated successfully for user:', userId);
  } catch (error: any) {
    console.error('💥 Exception updating invitation status:', {
      userId,
      error: error.message
    });
    // No lanzamos error aquí porque el email ya se envió exitosamente
  }
};


import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

export const updateInvitationStatus = async (
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<void> => {
  const { error: updateError } = await supabase
    .from('user_invitations')
    .update({ 
      status: 'sent', 
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (updateError) {
    console.error('Error updating invitation status:', updateError);
    // No lanzamos error aquí porque el email ya se envió
  }
};

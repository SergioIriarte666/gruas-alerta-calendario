import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteUserRequest {
  email: string;
  fullName: string;
  role: 'admin' | 'operator' | 'viewer' | 'client';
  clientId?: string | null;
  operatorId?: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('🚀 send-user-invitation function called');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !callerUser) {
      throw new Error('Invalid authentication');
    }

    // Check if caller is admin
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (callerProfile?.role !== 'admin') {
      throw new Error('Only admins can invite users');
    }

    const { email, fullName, role, clientId, operatorId }: InviteUserRequest = await req.json();

    console.log('📧 Processing invitation for:', { email, fullName, role, clientId, operatorId });

    // Validate email
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address');
    }

    // Get company data for redirect URL
    const { data: companyData } = await supabaseAdmin
      .from('company_data')
      .select('business_name')
      .single();

    const businessName = companyData?.business_name || 'TMS Grúas';

    // Build redirect URL - user will be redirected here after accepting invitation
    const origin = req.headers.get('origin') || 'https://gruas5norte.com';
    const redirectTo = `${origin}/auth?invited=true&setup_password=true`;

    console.log('🔗 Inviting user via Supabase Auth Admin API with redirect:', redirectTo);

    // Use Supabase Admin API to invite user
    // This creates the user in auth.users AND sends the invitation email via Supabase's built-in email system
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        full_name: fullName,
        role: role,
        invited: true
      }
    });

    if (inviteError) {
      console.error('❌ Error inviting user:', inviteError);
      
      // Handle specific error cases
      if (inviteError.message.includes('already been registered')) {
        throw new Error('Este email ya está registrado en el sistema');
      }
      
      throw new Error(`Error al invitar usuario: ${inviteError.message}`);
    }

    if (!inviteData.user) {
      throw new Error('No user returned from invite');
    }

    const newUserId = inviteData.user.id;
    console.log('✅ User invited successfully with ID:', newUserId);

    // Create profile with the same ID as the auth user
    console.log('📝 Creating profile for invited user...');
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUserId,
        email: email,
        full_name: fullName,
        role: role,
        client_id: clientId || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      console.error('❌ Error creating profile:', profileError);
      // Don't fail the whole operation, user is created
    } else {
      console.log('✅ Profile created successfully');
    }

    // If role is operator and operatorId provided, link the operator record
    if (role === 'operator' && operatorId) {
      console.log('🔗 Linking operator record:', operatorId, 'to user:', newUserId);
      const { error: linkError } = await supabaseAdmin
        .from('operators')
        .update({ user_id: newUserId })
        .eq('id', operatorId);

      if (linkError) {
        console.error('❌ Error linking operator:', linkError);
      } else {
        console.log('✅ Operator linked successfully');
      }
    }

    // Create/update invitation record for tracking
    console.log('📊 Creating invitation record...');
    const { error: invitationError } = await supabaseAdmin
      .from('user_invitations')
      .upsert({
        user_id: newUserId,
        email: email,
        status: 'sent',
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (invitationError) {
      console.error('❌ Error creating invitation record:', invitationError);
    } else {
      console.log('✅ Invitation record created');
    }

    const successResponse = {
      success: true,
      userId: newUserId,
      message: `Invitación enviada a ${email}`,
      timestamp: new Date().toISOString()
    };

    console.log('🎉 Function completed successfully:', successResponse);

    return new Response(
      JSON.stringify(successResponse),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("💥 Error in send-user-invitation function:", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Error enviando invitación',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

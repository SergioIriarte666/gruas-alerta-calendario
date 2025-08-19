
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "npm:resend@2.0.0";
import { UserInvitationRequest } from './types.ts';
import { translateRole } from './roleTranslator.ts';
import { generateRegistrationUrl } from './urlGenerator.ts';
import { generateEmailHtml } from './emailTemplate.ts';
import { fetchCompanyData } from './companyDataFetcher.ts';
import { sendInvitationEmail } from './emailSender.ts';
import { updateInvitationStatus } from './invitationUpdater.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const handler = async (req: Request): Promise<Response> => {
  console.log('🚀 send-user-invitation function called');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar que el API key de Resend esté configurado
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error('❌ RESEND_API_KEY not configured');
      throw new Error('API key de Resend no configurado');
    }

    console.log('✅ RESEND_API_KEY configured');
    const resend = new Resend(resendApiKey);

    const { userId, email, fullName, role, clientName }: UserInvitationRequest = await req.json();

    console.log('📧 Processing invitation for:', { 
      userId, 
      email, 
      fullName, 
      role, 
      clientName,
      timestamp: new Date().toISOString()
    });

    // Validar email
    if (!email || !email.includes('@')) {
      console.error('❌ Invalid email address:', email);
      throw new Error('Email inválido');
    }

    // Obtener datos de la empresa
    console.log('🏢 Fetching company data...');
    const companyData = await fetchCompanyData(supabase);
    const businessName = companyData.business_name || 'TMS Grúas';
    const supportEmail = companyData.email || 'soporte@gruas5norte.com';

    console.log('✅ Company data retrieved:', { businessName, supportEmail });

    // Traducir rol al español
    const roleLabel = translateRole(role);
    console.log('👤 Role translated:', { role, roleLabel });

    // Generar URL de registro
    const registerUrl = generateRegistrationUrl(req, email);
    console.log('🔗 Generated registration URL:', registerUrl);

    // Generar el HTML del email
    console.log('📝 Generating email HTML...');
    const emailHtml = generateEmailHtml({
      businessName,
      supportEmail,
      fullName,
      email,
      roleLabel,
      clientName,
      registerUrl,
      role,
      companyPhone: companyData.phone
    });

    console.log('✅ Email HTML generated successfully');

    // Configurar el payload del email
    const emailPayload = {
      from: `${businessName} <noreply@gruas5norte.com>`,
      to: [email],
      subject: `🎉 Invitación al sistema ${businessName} - Rol: ${roleLabel}`,
      html: emailHtml,
    };

    console.log('📬 Email payload configured:', {
      from: emailPayload.from,
      to: emailPayload.to,
      subject: emailPayload.subject
    });

    // Enviar el email
    console.log('📤 Attempting to send email via Resend...');
    const emailResponse = await sendInvitationEmail(resend, emailPayload);

    if (!emailResponse.data?.id) {
      console.error('❌ Email response missing ID:', emailResponse);
      throw new Error('Error enviando email: respuesta inválida');
    }

    console.log('✅ Email sent successfully:', {
      emailId: emailResponse.data.id,
      timestamp: new Date().toISOString()
    });

    // Actualizar el registro de invitación
    console.log('📊 Updating invitation status...');
    await updateInvitationStatus(supabase, userId);
    console.log('✅ Invitation status updated successfully');

    const successResponse = {
      success: true, 
      emailId: emailResponse.data.id,
      message: 'Invitación enviada correctamente',
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

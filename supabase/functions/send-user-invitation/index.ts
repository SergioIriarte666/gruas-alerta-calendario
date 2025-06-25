
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

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const handler = async (req: Request): Promise<Response> => {
  console.log('send-user-invitation function called');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, fullName, role, clientName }: UserInvitationRequest = await req.json();

    console.log('Processing invitation for:', { userId, email, fullName, role });

    // Obtener datos de la empresa
    const companyData = await fetchCompanyData(supabase);
    const businessName = companyData.business_name || 'TMS Grúas';
    const supportEmail = companyData.email || 'soporte@gruas5norte.com';

    // Traducir rol al español
    const roleLabel = translateRole(role);

    // Generar URL de registro
    const registerUrl = generateRegistrationUrl(req, email);
    console.log('Generated registration URL:', registerUrl);

    // Generar el HTML del email
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

    // Enviar el email
    const emailResponse = await sendInvitationEmail(resend, {
      from: `${businessName} <noreply@gruas5norte.com>`,
      to: [email],
      subject: `🎉 Invitación al sistema ${businessName} - Rol: ${roleLabel}`,
      html: emailHtml,
    });

    // Actualizar el registro de invitación
    await updateInvitationStatus(supabase, userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailResponse.data?.id,
        message: 'Invitación enviada correctamente'
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in send-user-invitation function:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Error enviando invitación'
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

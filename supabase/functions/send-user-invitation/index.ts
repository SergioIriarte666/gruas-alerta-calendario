
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserInvitationRequest {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  clientName?: string;
}

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

    // Obtener datos de la empresa para el email
    const { data: companyData } = await supabase
      .from('company_data')
      .select('business_name, email, phone')
      .single();

    const businessName = companyData?.business_name || 'TMS Grúas';
    const supportEmail = companyData?.email || 'soporte@gruas5norte.cl';

    // Traducir roles al español
    const roleLabels: Record<string, string> = {
      'admin': 'Administrador',
      'operator': 'Operador', 
      'viewer': 'Visualizador',
      'client': 'Cliente'
    };

    const roleLabel = roleLabels[role] || role;

    // Crear el enlace de registro - usar el dominio correcto
    const url = new URL(req.url);
    const origin = req.headers.get('origin') || 'https://gruas5norte.com';
    const registerUrl = `${origin}/auth?tab=register&email=${encodeURIComponent(email)}&invited=true`;

    console.log('Generated registration URL:', registerUrl);

    // Generar el HTML del email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Invitación al Sistema ${businessName}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .btn { 
              display: inline-block; 
              background: #10b981; 
              color: white; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 6px; 
              margin: 20px 0;
              font-weight: bold;
            }
            .info-box { background: #e0f2fe; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; }
            .warning-box { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>¡Bienvenido a ${businessName}!</h1>
            </div>
            
            <div class="content">
              <h2>Hola ${fullName},</h2>
              
              <p>Has sido invitado a formar parte del sistema de gestión de ${businessName}. Un administrador ha creado tu cuenta con los siguientes detalles:</p>
              
              <div class="info-box">
                <strong>📧 Email:</strong> ${email}<br>
                <strong>👤 Rol asignado:</strong> ${roleLabel}<br>
                ${clientName ? `<strong>🏢 Cliente asociado:</strong> ${clientName}<br>` : ''}
                <strong>📅 Fecha de invitación:</strong> ${new Date().toLocaleDateString('es-CL')}
              </div>
              
              <h3>¿Qué sigue?</h3>
              <p>Para completar tu registro y acceder al sistema, haz clic en el siguiente botón:</p>
              
              <div style="text-align: center;">
                <a href="${registerUrl}" class="btn">Completar Registro</a>
              </div>
              
              <div class="warning-box">
                <strong>⚠️ Importante:</strong> Si el botón no funciona, copia y pega esta URL en tu navegador:<br>
                <code>${registerUrl}</code>
              </div>
              
              <p><strong>Instrucciones:</strong></p>
              <ol>
                <li>Haz clic en el botón "Completar Registro" o usa la URL proporcionada</li>
                <li>Crea tu contraseña segura</li>
                <li>Confirma tu registro</li>
                <li>¡Ya podrás acceder al sistema con tu rol de ${roleLabel}!</li>
              </ol>
              
              <div class="info-box">
                <strong>📋 Acerca de tu rol (${roleLabel}):</strong><br>
                ${role === 'admin' ? 'Tendrás acceso completo al sistema, incluyendo gestión de usuarios, configuración y todos los módulos.' : 
                  role === 'operator' ? 'Podrás gestionar servicios, realizar inspecciones y acceder a las funciones operativas del sistema.' :
                  role === 'viewer' ? 'Tendrás acceso de solo lectura para consultar información del sistema.' :
                  role === 'client' ? 'Podrás acceder al portal de cliente para ver tus servicios, facturas y solicitar nuevos servicios.' : 
                  'Tu rol te permitirá acceder a funciones específicas del sistema según los permisos asignados.'}
              </div>
              
              <p>Si tienes alguna duda o necesitas ayuda, no dudes en contactarnos:</p>
              <p>📧 <a href="mailto:${supportEmail}">${supportEmail}</a></p>
              ${companyData?.phone ? `<p>📱 ${companyData.phone}</p>` : ''}
              
              <p>¡Esperamos verte pronto en el sistema!</p>
              
              <p>Saludos cordiales,<br>
              <strong>Equipo ${businessName}</strong></p>
            </div>
            
            <div class="footer">
              <p>Este es un email automático del sistema ${businessName}.</p>
              <p>Si no esperabas esta invitación, puedes ignorar este mensaje.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    console.log('Attempting to send email...');

    // Enviar el email usando el dominio verificado
    const emailResponse = await resend.emails.send({
      from: `${businessName} <noreply@gruas5norte.cl>`,
      to: [email],
      subject: `🎉 Invitación al sistema ${businessName} - Rol: ${roleLabel}`,
      html: emailHtml,
    });

    console.log('Email response:', emailResponse);

    // Verificar si hay error
    if (emailResponse.error) {
      console.error('Resend API error:', emailResponse.error);
      throw new Error(`Error enviando email: ${emailResponse.error.message}`);
    }

    console.log('Email sent successfully:', emailResponse.data);

    // Actualizar el registro de invitación en la base de datos
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

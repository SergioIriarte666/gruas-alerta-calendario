
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: "Email es requerido" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format to prevent abuse with invalid inputs
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim()) || email.trim().length > 254) {
      return new Response(
        JSON.stringify({ error: "Formato de email inválido" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use service role to generate a recovery link
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Generate recovery link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email.trim(),
    });

    if (linkError) {
      console.error("Error generating recovery link:", linkError);
      // Don't reveal if user exists or not
      return new Response(
        JSON.stringify({ success: true, message: "Si el email está registrado, recibirás un correo de recuperación." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build the redirect URL with the token
    const siteUrl = Deno.env.get('SITE_URL') || 'https://gruas5norte.com';
    const tokenHash = linkData.properties?.hashed_token;
    const resetUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?token=${tokenHash}&type=recovery&redirect_to=${encodeURIComponent(siteUrl + '/reset-password')}`;

    // Fetch company data for branding
    const { data: companyData } = await supabaseAdmin
      .from('company_data')
      .select('business_name, logo_url, phone, email')
      .limit(1)
      .single();

    const companyName = companyData?.business_name || 'Grúas 5 Norte';
    const companyPhone = companyData?.phone || '';
    const companyEmail = companyData?.email || '';
    const logoUrl = companyData?.logo_url || '';

    // Send branded email via Resend
    const emailResponse = await resend.emails.send({
      from: `${companyName} <noreply@gruas5norte.com>`,
      to: [email.trim()],
      subject: `Recuperación de contraseña - ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #1a1a2e; padding: 30px 40px; text-align: center;">
                      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 50px; margin-bottom: 10px;" />` : ''}
                      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">${companyName}</h1>
                    </td>
                  </tr>
                  
                  <!-- Body -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="color: #1a1a2e; margin: 0 0 16px 0; font-size: 20px;">Recuperación de Contraseña</h2>
                      <p style="color: #4a4a4a; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                        Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. 
                        Haz clic en el botón de abajo para crear una nueva contraseña.
                      </p>
                      
                      <!-- CTA Button -->
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="padding: 8px 0 32px 0;">
                            <a href="${resetUrl}" 
                               style="display: inline-block; background-color: #22c55e; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">
                              Restablecer Contraseña
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
                        Este enlace expirará en 1 hora por motivos de seguridad. Si no solicitaste este cambio, 
                        puedes ignorar este correo de manera segura.
                      </p>
                      
                      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                      
                      <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0;">
                        Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>
                        <a href="${resetUrl}" style="color: #22c55e; word-break: break-all;">${resetUrl}</a>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                      <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px 0;">${companyName}</p>
                      ${companyPhone ? `<p style="color: #9ca3af; font-size: 11px; margin: 0 0 4px 0;">Tel: ${companyPhone}</p>` : ''}
                      ${companyEmail ? `<p style="color: #9ca3af; font-size: 11px; margin: 0;">Email: ${companyEmail}</p>` : ''}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      console.error("Error sending email via Resend:", emailResponse.error);
      return new Response(
        JSON.stringify({ error: "Error al enviar el correo" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Password reset email sent successfully to:", email);

    return new Response(
      JSON.stringify({ success: true, message: "Correo de recuperación enviado exitosamente." }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-password-reset:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

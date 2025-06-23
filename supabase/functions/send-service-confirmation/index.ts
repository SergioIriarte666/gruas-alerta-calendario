
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ServiceConfirmationRequest {
  serviceId: string;
  clientEmail: string;
  folio: string;
  origin: string;
  destination: string;
  serviceDate: string;
  serviceTypeName: string;
  clientName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Iniciando proceso de envío de confirmación de servicio...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      serviceId, 
      clientEmail, 
      folio, 
      origin, 
      destination, 
      serviceDate, 
      serviceTypeName,
      clientName 
    }: ServiceConfirmationRequest = await req.json();

    console.log(`Procesando confirmación para: ${clientEmail}, Folio: ${folio}`);

    // Obtener datos de la empresa
    const { data: companyData } = await supabase
      .from('company_data')
      .select('business_name, phone, email, address')
      .single();

    const companyName = companyData?.business_name || 'Grúas 5 Norte';
    const companyPhone = companyData?.phone || '';
    const companyEmail = companyData?.email || 'contacto@gruas5norte.cl';
    const companyAddress = companyData?.address || '';

    // Formatear fecha
    const formattedDate = new Date(serviceDate).toLocaleDateString('es-CL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Confirmación de Solicitud de Servicio</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #22c55e; }
            .logo { font-size: 28px; font-weight: bold; color: #22c55e; margin-bottom: 10px; }
            .service-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .info-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
            .label { font-weight: bold; color: #333; }
            .value { color: #666; }
            .folio { font-size: 24px; font-weight: bold; color: #22c55e; text-align: center; margin: 20px 0; }
            .contact-info { background: #22c55e; color: white; padding: 20px; border-radius: 8px; margin-top: 30px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">${companyName}</div>
              <p style="color: #666; margin: 0;">Servicios de Grúa Profesional</p>
            </div>

            <h2 style="color: #333; text-align: center;">¡Solicitud Recibida Exitosamente!</h2>
            
            <p>Estimado/a <strong>${clientName}</strong>,</p>
            
            <p>Hemos recibido su solicitud de servicio de grúa. A continuación, encontrará los detalles de su solicitud:</p>

            <div class="folio">Folio: ${folio}</div>

            <div class="service-info">
              <h3 style="margin-top: 0; color: #333;">Detalles del Servicio</h3>
              <div class="info-row">
                <span class="label">Tipo de Servicio:</span>
                <span class="value">${serviceTypeName}</span>
              </div>
              <div class="info-row">
                <span class="label">Fecha Solicitada:</span>
                <span class="value">${formattedDate}</span>
              </div>
              <div class="info-row">
                <span class="label">Origen:</span>
                <span class="value">${origin}</span>
              </div>
              <div class="info-row">
                <span class="label">Destino:</span>
                <span class="value">${destination}</span>
              </div>
            </div>

            <p><strong>¿Qué sigue ahora?</strong></p>
            <ul>
              <li>Nuestro equipo revisará su solicitud en las próximas horas</li>
              <li>Nos pondremos en contacto con usted para confirmar los detalles</li>
              <li>Le proporcionaremos una cotización y programaremos el servicio</li>
            </ul>

            <div class="contact-info">
              <h3 style="margin-top: 0;">Información de Contacto</h3>
              <p><strong>Teléfono:</strong> ${companyPhone}</p>
              <p><strong>Email:</strong> ${companyEmail}</p>
              ${companyAddress ? `<p><strong>Dirección:</strong> ${companyAddress}</p>` : ''}
              <p style="margin-bottom: 0;"><strong>Horario de Atención:</strong> Lunes a Viernes 8:00 - 18:00, Sábados 8:00 - 14:00</p>
            </div>

            <div class="footer">
              <p>Este email fue enviado automáticamente. Por favor, no responda a este mensaje.</p>
              <p>Para consultas, contacte directamente a ${companyPhone} o ${companyEmail}</p>
              <p style="margin-top: 20px; font-size: 12px;">© 2025 ${companyName}. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Enviar email usando el dominio por defecto de Resend
    const emailResponse = await resend.emails.send({
      from: `${companyName} <onboarding@resend.dev>`,
      to: [clientEmail],
      subject: `Confirmación de Solicitud de Servicio - Folio ${folio}`,
      html: emailHtml,
    });

    console.log("Email de confirmación enviado exitosamente:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      emailResponse,
      message: "Email de confirmación enviado correctamente"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error enviando email de confirmación:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: "Error en el servicio de envío de emails"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

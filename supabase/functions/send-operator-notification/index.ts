
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OperatorNotificationRequest {
  operatorEmail: string;
  operatorName: string;
  serviceId: string;
  folio: string;
  clientName: string;
  serviceDate: string;
  origin: string;
  destination: string;
  serviceTypeName: string;
  craneLicensePlate: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Enviando notificación a operador...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      operatorEmail,
      operatorName,
      serviceId,
      folio, 
      clientName,
      serviceDate,
      origin, 
      destination, 
      serviceTypeName,
      craneLicensePlate
    }: OperatorNotificationRequest = await req.json();

    // Obtener datos de la empresa
    const { data: companyData } = await supabase
      .from('company_data')
      .select('business_name, phone, email')
      .single();

    const companyName = companyData?.business_name || 'Grúas 5 Norte';
    const companyPhone = companyData?.phone || '';
    const companyEmail = companyData?.email || 'contacto@gruas5norte.com';

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
          <title>Nuevo Servicio Asignado</title>
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
            .alert-box { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">${companyName}</div>
              <p style="color: #666; margin: 0;">Sistema de Gestión de Servicios</p>
            </div>

            <h2 style="color: #333; text-align: center;">🚛 Nuevo Servicio Asignado</h2>
            
            <p>Hola <strong>${operatorName}</strong>,</p>
            
            <p>Se te ha asignado un nuevo servicio de grúa. Por favor revisa los detalles y prepárate para el servicio programado:</p>

            <div class="folio">Folio: ${folio}</div>

            <div class="service-info">
              <h3 style="margin-top: 0; color: #333;">Detalles del Servicio</h3>
              <div class="info-row">
                <span class="label">Cliente:</span>
                <span class="value">${clientName}</span>
              </div>
              <div class="info-row">
                <span class="label">Tipo de Servicio:</span>
                <span class="value">${serviceTypeName}</span>
              </div>
              <div class="info-row">
                <span class="label">Fecha del Servicio:</span>
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
              <div class="info-row">
                <span class="label">Grúa Asignada:</span>
                <span class="value">${craneLicensePlate}</span>
              </div>
            </div>

            <div class="alert-box">
              <p><strong>⚠️ Recordatorios Importantes:</strong></p>
              <ul>
                <li>Revisa el estado de la grúa antes del servicio</li>
                <li>Confirma la ubicación del cliente antes de salir</li>
                <li>Lleva todos los documentos necesarios</li>
                <li>Contacta al cliente si hay algún retraso</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <p><strong>¿Preguntas o problemas?</strong></p>
              <p>Contacta a coordinación: ${companyPhone} | ${companyEmail}</p>
            </div>

            <div class="footer">
              <p>Este email fue enviado automáticamente desde el sistema TMS.</p>
              <p style="margin-top: 20px; font-size: 12px;">© 2025 ${companyName}. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: `${companyName} <operaciones@gruas5norte.com>`,
      to: [operatorEmail],
      subject: `🚛 Nuevo Servicio Asignado - Folio ${folio}`,
      html: emailHtml,
    });

    console.log("Email al operador enviado:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      emailResponse,
      message: "Notificación enviada al operador exitosamente"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error enviando notificación al operador:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: "Error en el servicio de notificación de operador"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

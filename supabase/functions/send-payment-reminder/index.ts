
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentReminderRequest {
  clientEmail: string;
  clientName: string;
  invoiceFolio: string;
  dueDate: string;
  total: number;
  daysOverdue?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Enviando recordatorio de pago...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      clientEmail,
      clientName,
      invoiceFolio,
      dueDate,
      total,
      daysOverdue
    }: PaymentReminderRequest = await req.json();

    // Obtener datos de la empresa
    const { data: companyData } = await supabase
      .from('company_data')
      .select('business_name, phone, email')
      .single();

    const companyName = companyData?.business_name || 'Grúas 5 Norte';
    const companyPhone = companyData?.phone || '';
    const companyEmail = companyData?.email || 'contacto@gruas5norte.cl';

    // Formatear fecha de vencimiento
    const formattedDueDate = new Date(dueDate).toLocaleDateString('es-CL');

    // Formatear total
    const formattedTotal = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(total);

    // Determinar el tipo de recordatorio
    const isOverdue = daysOverdue && daysOverdue > 0;
    const reminderType = isOverdue ? 'vencida' : 'próxima a vencer';
    const urgencyColor = isOverdue ? '#dc2626' : '#f59e0b';
    const urgencyIcon = isOverdue ? '🚨' : '⏰';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Recordatorio de Pago</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #22c55e; }
            .logo { font-size: 28px; font-weight: bold; color: #22c55e; margin-bottom: 10px; }
            .alert-box { background: ${isOverdue ? '#fee2e2' : '#fef3c7'}; border: 2px solid ${urgencyColor}; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .invoice-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .info-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
            .label { font-weight: bold; color: #333; }
            .value { color: #666; }
            .total-highlight { font-size: 24px; font-weight: bold; color: ${urgencyColor}; text-align: center; margin: 20px 0; }
            .payment-info { background: #22c55e; color: white; padding: 20px; border-radius: 8px; margin: 30px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">${companyName}</div>
              <p style="color: #666; margin: 0;">Servicios de Grúa Profesional</p>
            </div>

            <div class="alert-box">
              <h2 style="margin: 0; color: ${urgencyColor};">${urgencyIcon} Factura ${reminderType}</h2>
              ${isOverdue ? 
                `<p style="margin: 10px 0; font-weight: bold;">Esta factura lleva ${daysOverdue} días vencida</p>` :
                `<p style="margin: 10px 0;">Esta factura vence pronto, favor gestionar el pago</p>`
              }
            </div>
            
            <p>Estimado/a <strong>${clientName}</strong>,</p>
            
            <p>Le recordamos que tiene una factura ${reminderType} pendiente de pago:</p>

            <div class="invoice-info">
              <h3 style="margin-top: 0; color: #333;">Información de la Factura</h3>
              <div class="info-row">
                <span class="label">Factura N°:</span>
                <span class="value">${invoiceFolio}</span>
              </div>
              <div class="info-row">
                <span class="label">Fecha de Vencimiento:</span>
                <span class="value">${formattedDueDate}</span>
              </div>
              ${isOverdue ? 
                `<div class="info-row">
                  <span class="label" style="color: #dc2626;">Días de Atraso:</span>
                  <span class="value" style="color: #dc2626; font-weight: bold;">${daysOverdue} días</span>
                </div>` : ''
              }
            </div>

            <div class="total-highlight">
              Total Pendiente: ${formattedTotal}
            </div>

            ${isOverdue ? 
              `<div style="background: #fee2e2; border: 1px solid #dc2626; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #dc2626; margin: 0;"><strong>⚠️ IMPORTANTE:</strong> Esta factura está vencida. Para evitar inconvenientes, le solicitamos regularizar el pago a la brevedad.</p>
              </div>` : 
              `<div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #92400e; margin: 0;"><strong>💡 Recordatorio:</strong> Esta factura vence pronto. Agradecemos gestionar el pago antes de la fecha de vencimiento.</p>
              </div>`
            }

            <div class="payment-info">
              <h3 style="margin-top: 0;">💳 Formas de Pago</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Transferencia bancaria</li>
                <li>Efectivo en nuestras oficinas</li>
                <li>Cheque al día</li>
              </ul>
              <p style="margin: 15px 0 0 0;"><strong>Para coordinar el pago contacte:</strong><br>
              📞 ${companyPhone}<br>
              📧 ${companyEmail}</p>
            </div>

            <div class="footer">
              <p>Agradecemos su preferencia y esperamos su pronto pago.</p>
              <p style="margin-top: 20px; font-size: 12px;">© 2025 ${companyName}. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: `${companyName} <cobranzas@gruas5norte.cl>`,
      to: [clientEmail],
      subject: `${urgencyIcon} ${isOverdue ? 'Factura Vencida' : 'Recordatorio de Pago'} - Factura ${invoiceFolio}`,
      html: emailHtml,
    });

    console.log("Recordatorio de pago enviado:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      emailResponse,
      message: "Recordatorio de pago enviado exitosamente"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error enviando recordatorio de pago:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: "Error en el servicio de recordatorio de pago"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

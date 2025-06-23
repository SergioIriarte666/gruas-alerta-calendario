
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvoiceEmailRequest {
  invoiceId: string;
  clientEmail: string;
  clientName: string;
  folio: string;
  issueDate: string;
  dueDate: string;
  total: number;
  services: Array<{
    folio: string;
    serviceDate: string;
    serviceType: string;
    value: number;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Enviando factura por email...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      invoiceId,
      clientEmail,
      clientName,
      folio,
      issueDate,
      dueDate,
      total,
      services
    }: InvoiceEmailRequest = await req.json();

    // Obtener datos de la empresa
    const { data: companyData } = await supabase
      .from('company_data')
      .select('business_name, phone, email, address, rut')
      .single();

    const companyName = companyData?.business_name || 'Grúas 5 Norte';
    const companyPhone = companyData?.phone || '';
    const companyEmail = companyData?.email || 'contacto@gruas5norte.cl';
    const companyAddress = companyData?.address || '';
    const companyRut = companyData?.rut || '';

    // Formatear fechas
    const formattedIssueDate = new Date(issueDate).toLocaleDateString('es-CL');
    const formattedDueDate = new Date(dueDate).toLocaleDateString('es-CL');

    // Formatear total
    const formattedTotal = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(total);

    // Generar tabla de servicios
    const servicesTable = services.map(service => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${service.folio}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${new Date(service.serviceDate).toLocaleDateString('es-CL')}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${service.serviceType}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(service.value)}</td>
      </tr>
    `).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Factura ${folio}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #22c55e; }
            .logo { font-size: 28px; font-weight: bold; color: #22c55e; margin-bottom: 10px; }
            .invoice-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .info-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
            .label { font-weight: bold; color: #333; }
            .value { color: #666; }
            .folio { font-size: 24px; font-weight: bold; color: #22c55e; text-align: center; margin: 20px 0; }
            .services-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .services-table th { background: #22c55e; color: white; padding: 12px; text-align: left; }
            .total-box { background: #22c55e; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">${companyName}</div>
              <p style="color: #666; margin: 0;">RUT: ${companyRut}</p>
              <p style="color: #666; margin: 0;">${companyAddress}</p>
            </div>

            <h2 style="color: #333; text-align: center;">📄 Factura</h2>
            
            <div class="folio">Factura N° ${folio}</div>

            <div class="invoice-info">
              <h3 style="margin-top: 0; color: #333;">Información de Facturación</h3>
              <div class="info-row">
                <span class="label">Cliente:</span>
                <span class="value">${clientName}</span>
              </div>
              <div class="info-row">
                <span class="label">Fecha de Emisión:</span>
                <span class="value">${formattedIssueDate}</span>
              </div>
              <div class="info-row">
                <span class="label">Fecha de Vencimiento:</span>
                <span class="value">${formattedDueDate}</span>
              </div>
            </div>

            <h3 style="color: #333;">Detalle de Servicios</h3>
            <table class="services-table">
              <thead>
                <tr>
                  <th>Folio Servicio</th>
                  <th>Fecha</th>
                  <th>Tipo de Servicio</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                ${servicesTable}
              </tbody>
            </table>

            <div class="total-box">
              <h2 style="margin: 0;">Total a Pagar: ${formattedTotal}</h2>
            </div>

            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>💳 Formas de Pago:</strong></p>
              <ul>
                <li>Transferencia bancaria</li>
                <li>Efectivo</li>
                <li>Cheque al día</li>
              </ul>
              <p><strong>Para coordinar el pago contacte:</strong><br>
              📞 ${companyPhone}<br>
              📧 ${companyEmail}</p>
            </div>

            <div class="footer">
              <p>Gracias por preferirnos.</p>
              <p style="margin-top: 20px; font-size: 12px;">© 2025 ${companyName}. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: `${companyName} <facturacion@gruas5norte.cl>`,
      to: [clientEmail],
      subject: `📄 Factura ${folio} - ${companyName}`,
      html: emailHtml,
    });

    console.log("Factura enviada por email:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      emailResponse,
      message: "Factura enviada por email exitosamente"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error enviando factura por email:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: "Error en el servicio de envío de facturas"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

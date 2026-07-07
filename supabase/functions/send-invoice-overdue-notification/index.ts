import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { Resend } from "npm:resend@6";
import { getCorsHeaders } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Contacto de cobranza (independiente de company_data para no afectar otros módulos)
const CONTACT_PHONE = '+56 9 8769 6972';
const CONTACT_EMAIL = 'asistencia@gruas5norte.cl';
const FALLBACK_LOGO_URL = 'https://app.gruas5norte.cl/logo-gruas-5-norte.png';

const escapeHtml = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

interface OverdueNotificationRequest {
  invoiceId: string;
  folio: string;
  recipients?: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) }
      });
    }
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Usuario no autenticado' }), {
        status: 401, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) }
      });
    }

    const callerId = (claimsData.claims as any).sub as string;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: callerId, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Solo administradores pueden enviar notificaciones' }), {
        status: 403, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) }
      });
    }

    const { invoiceId, folio, recipients }: OverdueNotificationRequest = await req.json();

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: 'invoiceId es requerido' }), {
        status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) }
      });
    }

    // Derive invoice + client server-side
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('id, total, due_date, issue_date, client_id, numero_fiscal, clients:client_id(name, email)')
      .eq('id', invoiceId)
      .maybeSingle();
    if (invErr || !invoice?.clients?.email) {
      return new Response(JSON.stringify({ error: 'No se encontro email del cliente' }), {
        status: 404, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) }
      });
    }
    const clientEmail = invoice.clients.email as string;
    const clientName = invoice.clients.name as string;
    const total = Number(invoice.total ?? 0);
    const dueDate = invoice.due_date as string;
    const displayFolio = (invoice.numero_fiscal as string | null) || folio || '';

    // Destinatarios permitidos: email principal + contactos de cobranza activos
    const { data: billingContacts } = await supabase
      .from('client_billing_contacts')
      .select('email')
      .eq('client_id', invoice.client_id)
      .eq('is_active', true);

    const allowedEmails = new Set(
      [clientEmail, ...(billingContacts ?? []).map(c => c.email)]
        .map(e => e.toLowerCase().trim())
    );

    const requested = (Array.isArray(recipients) && recipients.length > 0)
      ? recipients.map(e => String(e).toLowerCase().trim())
      : [clientEmail.toLowerCase().trim()];

    const invalid = requested.filter(e => !allowedEmails.has(e));
    if (invalid.length > 0) {
      return new Response(JSON.stringify({
        error: 'Destinatarios no autorizados para este cliente',
        invalid,
      }), {
        status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) }
      });
    }
    const finalRecipients = [...new Set(requested)];

    // Calculate days overdue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

    // Company data
    const { data: companyData } = await supabase
      .from('company_data')
      .select('business_name, phone, email, address, rut, logo_url')
      .single();

    const companyName = companyData?.business_name || 'Gruas 5 Norte';
    const logoUrl = companyData?.logo_url || FALLBACK_LOGO_URL;
    const companyAddress = companyData?.address || '';
    const companyRut = companyData?.rut || '';

    const formattedDueDate = new Date(dueDate).toLocaleDateString('es-CL');
    const formattedTotal = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(total);

    const currentYear = new Date().getFullYear();

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Factura vencida ${escapeHtml(displayFolio)}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f1f5f9; color: #334155; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.06); }
            .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #1e293b; }
            .header img { max-height: 70px; margin-bottom: 12px; }
            .alert-banner { background: #f8fafc; border: 1px solid #cbd5e1; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .alert-banner h3 { color: #1e293b; margin: 0 0 4px 0; font-size: 18px; }
            .alert-banner p { color: #475569; margin: 0; font-size: 14px; }
            .total-box { background: #1e293b; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0; }
            .payment-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; margin: 20px 0; color: #334155; }
            .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="${logoUrl}" alt="${escapeHtml(companyName)}" width="110" height="110" style="display: block; margin: 0 auto 12px auto;">
              <p style="color: #475569; margin: 0;">RUT: ${escapeHtml(companyRut)}</p>
              <p style="color: #475569; margin: 0;">${escapeHtml(companyAddress)}</p>
            </div>

            <div class="alert-banner">
              <h3>Factura vencida</h3>
              <p>La factura N&deg; ${escapeHtml(displayFolio)} emitida a nombre de ${escapeHtml(clientName)} se encuentra vencida hace ${daysOverdue} dia(s).</p>
            </div>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">Cliente:</td>
                <td align="right" style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #475569;">${escapeHtml(clientName)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">Factura:</td>
                <td align="right" style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #475569;">${escapeHtml(displayFolio)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">Fecha de Vencimiento:</td>
                <td align="right" style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #475569;">${formattedDueDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">Dias vencida:</td>
                <td align="right" style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #b91c1c; font-weight: bold;">${daysOverdue} dia(s)</td>
              </tr>
            </table>

            <div class="total-box">
              <h2 style="margin: 0;">Total Pendiente: ${formattedTotal}</h2>
            </div>

            <div class="payment-box">
              <p><strong>Formas de Pago:</strong></p>
              <ul>
                <li>Transferencia bancaria</li>
                <li>Efectivo</li>
              </ul>
              <p style="margin-bottom: 6px;"><strong>Datos para transferencia:</strong></p>
              <p style="margin-top: 0; margin-bottom: 6px; line-height: 1.5;">
              Titular: Gr&uacute;as 5 Norte SpA<br>
              RUT: 76.769.841-0<br>
              Banco Santander &mdash; Cuenta Corriente<br>
              N&deg; de cuenta: 71851095<br>
              Enviar comprobante a: <a href="mailto:pagos@gruas5norte.cl" style="color: #1e293b;">pagos@gruas5norte.cl</a></p>
              <p><strong>Para coordinar el pago contacte:</strong><br>
              ${CONTACT_PHONE}<br>
              <a href="mailto:${CONTACT_EMAIL}" style="color: #1e293b;">${CONTACT_EMAIL}</a></p>
            </div>

            <div class="footer">
              <p>Gracias por preferirnos.</p>
              <p style="margin-top: 20px; font-size: 12px;">${currentYear} ${escapeHtml(companyName)}. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    let emailResponse: any = null;
    let sendError: string | null = null;
    try {
      emailResponse = await resend.emails.send({
        from: `${companyName} <facturacion@gruas5norte.cl>`,
        to: finalRecipients,
        subject: `Factura vencida ${displayFolio} - ${companyName}`,
        html: emailHtml,
      });
      if (emailResponse?.error) sendError = String(emailResponse.error?.message ?? emailResponse.error);
    } catch (e: any) {
      sendError = e?.message ?? 'Error desconocido al enviar';
    }

    // Registrar SIEMPRE el intento (exitoso o fallido)
    await supabase.from('invoice_email_log').insert({
      invoice_id: invoiceId,
      email_type: 'overdue_notification',
      recipients: finalRecipients,
      sent_by: callerId,
      resend_id: emailResponse?.data?.id ?? null,
      success: !sendError,
      error_message: sendError,
    });

    if (sendError) {
      return new Response(JSON.stringify({ error: sendError }), {
        status: 502, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) }
      });
    }

    console.log("Notificacion de factura vencida enviada:", emailResponse);

    return new Response(JSON.stringify({
      success: true,
      emailResponse,
      message: "Notificacion de factura vencida enviada exitosamente",
      daysOverdue,
      sentTo: finalRecipients,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  } catch (error: any) {
    console.error("Error enviando notificacion de factura vencida:", error);
    return new Response(
      JSON.stringify({ error: "Error en el servicio de envio de notificacion" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      }
    );
  }
};

serve(handler);

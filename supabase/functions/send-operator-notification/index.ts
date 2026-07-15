
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { Resend } from "npm:resend@6";
import { getCorsHeaders } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const escapeHtml = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

interface OperatorNotificationRequest {
  operatorId?: string;
  operatorEmail?: string;
  operatorName?: string;
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
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } });
    }
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Usuario no autenticado' }), { status: 401, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } });
    }
    const callerId = (claimsData.claims as any).sub as string;

    console.log('Enviando notificación a operador...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: callerId, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Solo administradores pueden enviar notificaciones de operador' }), {
        status: 403, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) }
      });
    }

    const { 
      operatorId,
      serviceId: _serviceId,
      folio, 
      clientName,
      serviceDate,
      origin, 
      destination, 
      serviceTypeName,
      craneLicensePlate
    }: OperatorNotificationRequest = await req.json();

    if (!operatorId) {
      return new Response(JSON.stringify({ error: 'operatorId es requerido' }), {
        status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) }
      });
    }

    // Derive operator name + email server-side
    const { data: operator, error: opErr } = await supabase
      .from('operators')
      .select('id, name, user_id')
      .eq('id', operatorId)
      .maybeSingle();
    if (opErr || !operator?.user_id) {
      return new Response(JSON.stringify({ error: 'Operador no encontrado o sin usuario vinculado' }), {
        status: 404, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) }
      });
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', operator.user_id)
      .maybeSingle();
    if (!profile?.email) {
      return new Response(JSON.stringify({ error: 'No se encontró email del operador' }), {
        status: 404, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) }
      });
    }
    const operatorEmail = profile.email as string;
    const operatorName = (operator.name || profile.full_name || 'Operador') as string;

    // Obtener datos de la empresa
    const { data: companyData } = await supabase
      .from('company_data')
      .select('business_name, phone, email')
      .single();

    const companyName = companyData?.business_name || 'Grúas 5 Norte';
    const companyPhone = companyData?.phone || '';
    const companyEmail = companyData?.email || 'contacto@gruas5norte.cl';

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
              <div class="logo">${escapeHtml(companyName)}</div>
              <p style="color: #666; margin: 0;">Sistema de Gestión de Servicios</p>
            </div>

            <h2 style="color: #333; text-align: center;">🚛 Nuevo Servicio Asignado</h2>
            
            <p>Hola <strong>${escapeHtml(operatorName)}</strong>,</p>
            
            <p>Se te ha asignado un nuevo servicio de grúa. Por favor revisa los detalles y prepárate para el servicio programado:</p>

            <div class="folio">Folio: ${escapeHtml(folio)}</div>

            <div class="service-info">
              <h3 style="margin-top: 0; color: #333;">Detalles del Servicio</h3>
              <div class="info-row">
                <span class="label">Cliente:</span>
                <span class="value">${escapeHtml(clientName)}</span>
              </div>
              <div class="info-row">
                <span class="label">Tipo de Servicio:</span>
                <span class="value">${escapeHtml(serviceTypeName)}</span>
              </div>
              <div class="info-row">
                <span class="label">Fecha del Servicio:</span>
                <span class="value">${formattedDate}</span>
              </div>
              <div class="info-row">
                <span class="label">Origen:</span>
                <span class="value">${escapeHtml(origin)}</span>
              </div>
              <div class="info-row">
                <span class="label">Destino:</span>
                <span class="value">${escapeHtml(destination)}</span>
              </div>
              <div class="info-row">
                <span class="label">Grúa Asignada:</span>
                <span class="value">${escapeHtml(craneLicensePlate)}</span>
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
      from: `${companyName} <operaciones@gruas5norte.cl>`,
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
        ...getCorsHeaders(req),
      },
    });
  } catch (error: any) {
    console.error("Error enviando notificación al operador:", error);
    return new Response(
      JSON.stringify({ 
        error: "Error en el servicio de notificación de operador"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      }
    );
  }
};

serve(handler);

import { requireUserRoles, withHeaders, jsonResponse } from '../_shared/auth.ts';
import { getWhatsAppGate, normalizeChileanPhone, sendWhatsAppDocumentTemplate } from '../_shared/whatsapp.ts';
import { getCorsHeaders } from "../_shared/cors.ts";

const corsHdrs = (req: Request) => ({ ...getCorsHeaders(req), 'Access-Control-Allow-Methods': 'POST, OPTIONS' });

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function formatServiceDate(value: string): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    return `${Number(m[3])} de ${MONTHS_ES[Number(m[2]) - 1]} de ${m[1]}`;
  }
  return value;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHdrs(req) });

  try {
    const authContext = await requireUserRoles(req, ['admin', 'operator']);
    if ('response' in authContext) return withHeaders(authContext.response, corsHdrs(req));

    const gate = await getWhatsAppGate(authContext.supabaseAdmin);

    if (!gate.enabled) {
      console.log('[send-whatsapp-retiro] Master switch OFF — mensaje omitido');
      return withHeaders(
        jsonResponse({ success: true, skipped: true, reason: 'whatsapp_disabled' }),
        corsHdrs(req),
      );
    }

    if (gate.settings?.notify_vehicle_pickup === false) {
      return withHeaders(
        jsonResponse({ success: true, skipped: true, reason: 'Notificación de retiro desactivada' }),
        corsHdrs(req),
      );
    }

    const body = await req.json();
    const {
      folio, serviceId, clientName, clientPhone,
      contactPhone, contactPerson, pdfUrl, serviceDate, operatorName,
    } = body;

    if (!folio || !pdfUrl) {
      return withHeaders(jsonResponse({ error: 'folio y pdfUrl son requeridos' }, 400), corsHdrs(req));
    }

    const formattedDate = formatServiceDate(serviceDate || '');
    const results: Array<{ target: string; phone: string; success: boolean }> = [];

    const sendToPhone = async (phone: string, recipientName: string, target: string) => {
      const norm = normalizeChileanPhone(phone);
      if (!norm.ok) return;
      const parameters = [recipientName, folio, formattedDate, operatorName || ''];
      const options = {
          event: 'retiro_completado',
          triggeredBy: authContext.user?.id ?? null,
          context: { folio, serviceId, target, phase: 'final' },
      };
      const result = await sendWhatsAppDocumentTemplate(
        norm.phone, 'inspeccion_completada_doc', parameters, pdfUrl, `Entrega-${folio}.pdf`, options,
      );
      results.push({ target, phone: norm.phone, success: result.success });
    };

    // Prioridad: la persona EN EL LUGAR (contacto del servicio). Si el servicio no trae contacto,
    // recién entonces se usa el teléfono del maestro de clientes. Un solo destinatario, no ambos.
    const recipientPhone = contactPhone || clientPhone;
    const recipientName = contactPhone
      ? (contactPerson || clientName || 'Receptor')
      : (clientName || 'Cliente');

    if (recipientPhone) {
      await sendToPhone(recipientPhone, recipientName, contactPhone ? 'contact' : 'client');
    }

    const allSuccess = results.length === 0 || results.every(r => r.success);
    return withHeaders(
      jsonResponse({ success: allSuccess, results, sent: results.length }),
      corsHdrs(req),
    );
  } catch (err) {
    console.error('[send-whatsapp-retiro] Error:', err);
    return withHeaders(
      jsonResponse({ error: err instanceof Error ? err.message : 'Error interno' }, 500),
      corsHdrs(req),
    );
  }
});

import { requireUserRoles, withHeaders, jsonResponse } from '../_shared/auth.ts';
import { getWhatsAppGate, normalizeChileanPhone, sendWhatsAppDocumentTemplate } from '../_shared/whatsapp.ts';
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  acquireNotificationDedupe,
  notificationDedupeKey,
  releaseNotificationDedupe,
} from '../_shared/dedupe.ts';

const corsHdrs = (req: Request) => ({ ...getCorsHeaders(req), 'Access-Control-Allow-Methods': 'POST, OPTIONS' });

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatServiceDate(value: string): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    return `${Number(m[3])} de ${MONTHS_ES[Number(m[2]) - 1]} de ${m[1]}`;
  }
  return value;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHdrs(req) });
  }

  try {
    const authContext = await requireUserRoles(req, ['admin', 'operator']);
    if ('response' in authContext) return withHeaders(authContext.response, corsHdrs(req));

    // Verificar master switch + flag individual (helper compartido)
    const gate = await getWhatsAppGate(authContext.supabaseAdmin);

    if (!gate.enabled) {
      console.log('[send-whatsapp-inspection] Master switch OFF — mensaje omitido');
      return withHeaders(
        jsonResponse({ success: true, skipped: true, reason: 'whatsapp_disabled' }),
        corsHdrs(req),
      );
    }

    if (gate.settings?.notify_inspection_completed === false) {
      return withHeaders(
        jsonResponse({ success: true, skipped: true, reason: 'Notificación de inspección desactivada' }),
        corsHdrs(req),
      );
    }

    const body = await req.json();
    const {
      folio, serviceId, clientName, clientPhone,
      contactPhone, contactPerson, pdfUrl, serviceDate, operatorName,
      force = false,
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
          event: 'inspeccion_completada',
          triggeredBy: authContext.user?.id ?? null,
          context: { folio, serviceId, target, phase: 'initial' },
      };
      const result = await sendWhatsAppDocumentTemplate(
        norm.phone, 'inspeccion_completada_doc', parameters, pdfUrl, `Inspeccion-${folio}.pdf`, options,
      );
      results.push({ target, phone: norm.phone, success: result.success });
    };

    // Prioridad: la persona EN EL LUGAR (contacto del servicio). Si el servicio no trae contacto,
    // recién entonces se usa el teléfono del maestro de clientes. Un solo destinatario, no ambos.
    const recipientPhone = contactPhone || clientPhone;
    const recipientName = contactPhone
      ? (contactPerson || clientName || 'Receptor')
      : (clientName || 'Cliente');

    if (!recipientPhone) {
      return withHeaders(jsonResponse({ success: true, skipped: 'no_recipient_phone', sent: 0 }), corsHdrs(req));
    }

    const normalizedRecipient = normalizeChileanPhone(recipientPhone);
    if (!normalizedRecipient.ok) {
      return withHeaders(jsonResponse({ success: true, skipped: 'invalid_recipient_phone', sent: 0 }), corsHdrs(req));
    }

    const { data: inspection, error: inspectionError } = await (authContext.supabaseAdmin as any)
      .from('inspections')
      .select('id')
      .eq('service_id', serviceId)
      .maybeSingle();

    if (inspectionError || !inspection?.id) {
      return withHeaders(jsonResponse({ error: 'Inspección no encontrada para dedupe' }, 404), corsHdrs(req));
    }

    const forceManualSend = force === true && authContext.role === 'admin';
    const alertKey = notificationDedupeKey('inspection_whatsapp', inspection.id);
    if (!forceManualSend) {
      const dedupe = await acquireNotificationDedupe(authContext.supabaseAdmin, alertKey, {
        service_id: serviceId,
        inspection_id: inspection.id,
        folio,
        phase: 'initial',
        channel: 'whatsapp',
        source: 'send-whatsapp-inspection',
      });

      if (dedupe.duplicate) {
        return withHeaders(jsonResponse({ success: true, skipped: 'already_sent', sent: 0 }), corsHdrs(req));
      }
      if (!dedupe.acquired) {
        console.warn('[send-whatsapp-inspection] dedupe insert error:', dedupe.error);
        return withHeaders(jsonResponse({ success: true, skipped: 'dedupe_error', sent: 0 }), corsHdrs(req));
      }
    }

    await sendToPhone(recipientPhone, recipientName, contactPhone ? 'contact' : 'client');

    const allSuccess = results.length === 0 || results.every(r => r.success);
    if (!allSuccess && !forceManualSend) {
      await releaseNotificationDedupe(authContext.supabaseAdmin, alertKey);
    }

    return withHeaders(
      jsonResponse({ success: allSuccess, results, sent: results.length }),
      corsHdrs(req),
    );
  } catch (err) {
    console.error('[send-whatsapp-inspection] Error:', err);
    return withHeaders(
      jsonResponse({ error: err instanceof Error ? err.message : 'Error interno' }, 500),
      corsHdrs(req),
    );
  }
});

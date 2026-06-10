import { requireUserRoles, withHeaders, jsonResponse } from '../_shared/auth.ts';
import { getWhatsAppGate, normalizeChileanPhone, sendWhatsAppTemplate } from '../_shared/whatsapp.ts';
import { corsHeaders as _cors } from '../_shared/cors.ts';

const corsHeaders = { ..._cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const WEEKDAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function formatServiceDate(value: string): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    const utc = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return `${WEEKDAYS_ES[utc.getUTCDay()]} ${Number(m[3])} de ${MONTHS_ES[utc.getUTCMonth()]} de ${m[1]}`;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authContext = await requireUserRoles(req, ['admin', 'operator']);
    if ('response' in authContext) return withHeaders(authContext.response, corsHeaders);

    // Verificar master switch + flag individual (helper compartido)
    const gate = await getWhatsAppGate(authContext.supabaseAdmin);

    if (!gate.enabled) {
      console.log('[send-whatsapp-inspection] Master switch OFF — mensaje omitido');
      return withHeaders(
        jsonResponse({ success: true, skipped: true, reason: 'whatsapp_disabled' }),
        corsHeaders,
      );
    }

    if (gate.settings?.notify_inspection_completed === false) {
      return withHeaders(
        jsonResponse({ success: true, skipped: true, reason: 'Notificación de inspección desactivada' }),
        corsHeaders,
      );
    }

    const body = await req.json();
    const {
      folio, serviceId, clientName, clientPhone,
      contactPhone, contactPerson, pdfUrl, serviceDate, operatorName,
    } = body;

    if (!folio || !pdfUrl) {
      return withHeaders(jsonResponse({ error: 'folio y pdfUrl son requeridos' }, 400), corsHeaders);
    }

    const formattedDate = formatServiceDate(serviceDate || '');
    const results: Array<{ target: string; phone: string; success: boolean }> = [];

    const sendToPhone = async (phone: string, recipientName: string, target: string) => {
      const norm = normalizeChileanPhone(phone);
      if (!norm.ok) return;
      const result = await sendWhatsAppTemplate(
        norm.phone,
        'inspeccion_completada_link',
        [
          recipientName,   // {{1}} nombre destinatario
          folio,           // {{2}} folio
          formattedDate,   // {{3}} fecha servicio
          operatorName || '', // {{4}} nombre operador
          pdfUrl,          // {{5}} link descarga
        ],
        {
          event: 'inspeccion_completada',
          triggeredBy: authContext.user?.id ?? null,
          context: { folio, serviceId, target },
        },
      );
      results.push({ target, phone: norm.phone, success: result.success });
    };

    if (clientPhone) {
      await sendToPhone(clientPhone, clientName || 'Cliente', 'client');
    }

    // Receptor final solo si existe y es distinto del cliente
    if (contactPhone && contactPhone !== clientPhone) {
      await sendToPhone(contactPhone, contactPerson || clientName || 'Receptor', 'contact');
    }

    const allSuccess = results.length === 0 || results.every(r => r.success);
    return withHeaders(
      jsonResponse({ success: allSuccess, results, sent: results.length }),
      corsHeaders,
    );
  } catch (err) {
    console.error('[send-whatsapp-inspection] Error:', err);
    return withHeaders(
      jsonResponse({ error: err instanceof Error ? err.message : 'Error interno' }, 500),
      corsHeaders,
    );
  }
});

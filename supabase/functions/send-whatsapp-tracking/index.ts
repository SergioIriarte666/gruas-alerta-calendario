import { requireUserRoles, withHeaders, jsonResponse } from '../_shared/auth.ts';
import { getWhatsAppGate, normalizeChileanPhone, sendWhatsAppTemplate } from '../_shared/whatsapp.ts';
import { getCorsHeaders } from "../_shared/cors.ts";
import { FINAL_SERVICE_STATUSES } from "../_shared/serviceLifecycle.ts";

const corsHdrs = (req: Request) => ({ ...getCorsHeaders(req), 'Access-Control-Allow-Methods': 'POST, OPTIONS' });

// Nace en true: la plantilla cliente_seguimiento_grua ya fue aprobada por Meta (10/07/2026).
const TRACKING_LINK_TEMPLATE_ENABLED = true;

const TRACKING_BASE_URL = 'https://app.gruas5norte.cl/track/';

// Dedupe de una-vez-por-servicio (no diario): sent_for_date fijo para que la
// UNIQUE(alert_key, sent_for_date) actue como "nunca mas" en vez de "no hoy",
// y asi sobreviva a que el servicio se reinicie y vuelva a pasar por in_progress.
const DEDUPE_SENTINEL_DATE = '2000-01-01';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHdrs(req) });

  try {
    const authContext = await requireUserRoles(req, ['admin', 'operator']);
    if ('response' in authContext) return withHeaders(authContext.response, corsHdrs(req));

    const { supabaseAdmin } = authContext;

    const body = await req.json();
    const serviceId = body?.service_id;
    if (!serviceId || typeof serviceId !== 'string') {
      return withHeaders(jsonResponse({ error: 'service_id es requerido' }, 400), corsHdrs(req));
    }

    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select(`
        id,
        folio,
        status,
        contact_person,
        contact_phone,
        operator:operators(name),
        crane:cranes(license_plate)
      `)
      .eq('id', serviceId)
      .maybeSingle();

    if (serviceError || !service) {
      return withHeaders(jsonResponse({ error: 'Servicio no encontrado' }, 404), corsHdrs(req));
    }

    // Guard anti link fantasma: un servicio cerrado no genera token nuevo. La
    // base tambien lo rechaza, pero el aviso no tiene sentido igual: nadie
    // sigue en vivo una grua que ya termino.
    if (FINAL_SERVICE_STATUSES.includes(service.status as string)) {
      console.log('[send-whatsapp-tracking] Envio omitido: servicio en estado final', service.status);
      return withHeaders(jsonResponse({ success: true, skipped: 'service_closed' }), corsHdrs(req));
    }

    const normalizedPhone = normalizeChileanPhone(service.contact_phone as string | null);
    if (!normalizedPhone.ok) {
      return withHeaders(jsonResponse({ success: true, skipped: 'no_contact_phone' }), corsHdrs(req));
    }

    const gate = await getWhatsAppGate(supabaseAdmin);
    if (!gate.enabled || !TRACKING_LINK_TEMPLATE_ENABLED) {
      console.log('[send-whatsapp-tracking] Envio omitido: gate/kill-switch desactivado');
      return withHeaders(jsonResponse({ success: true, skipped: 'whatsapp_disabled' }), corsHdrs(req));
    }

    const alertKey = `tracking_link:${serviceId}`;
    const { error: dedupeError } = await supabaseAdmin
      .from('whatsapp_alert_dedupe')
      .insert({ alert_key: alertKey, sent_for_date: DEDUPE_SENTINEL_DATE, context: { service_id: serviceId } });

    if (dedupeError) {
      if ((dedupeError as { code?: string }).code === '23505') {
        return withHeaders(jsonResponse({ success: true, skipped: 'already_sent' }), corsHdrs(req));
      }
      console.warn('[send-whatsapp-tracking] dedupe insert error:', dedupeError.message);
      return withHeaders(jsonResponse({ success: true, skipped: 'dedupe_error' }), corsHdrs(req));
    }

    const { data: token, error: tokenError } = await supabaseAdmin.rpc('get_or_create_tracking_token', {
      p_service_id: serviceId,
      p_created_by: null,
    });

    if (tokenError || !token) {
      await supabaseAdmin.from('whatsapp_alert_dedupe').delete().eq('alert_key', alertKey).eq('sent_for_date', DEDUPE_SENTINEL_DATE);
      console.error('[send-whatsapp-tracking] No se pudo generar el token:', tokenError?.message);
      return withHeaders(jsonResponse({ error: 'No se pudo generar el link de seguimiento' }, 500), corsHdrs(req));
    }

    const operator = Array.isArray(service.operator) ? service.operator[0] : service.operator;
    const crane = Array.isArray(service.crane) ? service.crane[0] : service.crane;
    const operatorFirstName = typeof operator?.name === 'string' && operator.name.trim() !== ''
      ? operator.name.trim().split(' ')[0]
      : '';

    const parameters = [
      service.contact_person || 'Cliente',
      service.folio,
      operatorFirstName,
      crane?.license_plate || '',
    ];

    const result = await sendWhatsAppTemplate(
      normalizedPhone.phone,
      'cliente_seguimiento_grua',
      parameters,
      {
        event: 'tracking_link',
        triggeredBy: authContext.user?.id ?? null,
        context: { folio: service.folio, serviceId, trackingUrl: `${TRACKING_BASE_URL}${token}` },
      },
      token,
    );

    if (!result.success) {
      // Fallo de Meta: liberar el dedupe para permitir un reintento futuro
      // (evita que un problema transitorio bloquee el envio para siempre).
      await supabaseAdmin.from('whatsapp_alert_dedupe').delete().eq('alert_key', alertKey).eq('sent_for_date', DEDUPE_SENTINEL_DATE);
    }

    return withHeaders(jsonResponse({ success: result.success, messageId: result.messageId }), corsHdrs(req));
  } catch (err) {
    console.error('[send-whatsapp-tracking] Error:', err);
    return withHeaders(
      jsonResponse({ error: err instanceof Error ? err.message : 'Error interno' }, 500),
      corsHdrs(req),
    );
  }
});

import { requireUserRoles, withHeaders, jsonResponse } from "../_shared/auth.ts";
import {
  sendWhatsAppTemplate,
  sendWhatsAppTemplateBulk,
  normalizeChileanPhone,
} from "../_shared/whatsapp.ts";
import { corsHeaders as _cors } from "../_shared/cors.ts";

const corsHeaders = { ..._cors, "Access-Control-Allow-Methods": "POST, OPTIONS" };

type AdminWhatsAppRequest = {
  event: string;
  data: Record<string, unknown>;
  testMode?: boolean;
  testPhone?: string;
};

const templates: Record<string, { name: string; params: (d: any) => string[] }> = {
  servicio_completado: {
    name: "admin_servicio_completado",
    params: (d) => [d.folio, d.operatorName, d.clientName, d.fechaCompletado].map(String),
  },
  documento_vencimiento: {
    name: "admin_documento_vence",
    params: (d) => [d.tipoDocumento, d.entidad, d.fechaVencimiento, String(d.diasRestantes)].map(String),
  },
  pago_pendiente: {
    name: "admin_pago_pendiente",
    params: (d) => [d.clientName, d.folio, d.monto, String(d.diasVencido)].map(String),
  },
  servicio_sin_cotizacion: {
    name: "admin_servicio_sin_cotizacion",
    params: (d) => [d.folio, d.clientName, d.fechaServicio].map(String),
  },
  orden_compra: {
    name: "admin_orden_compra",
    params: (d) => [d.proveedor, d.monto, d.descripcion].map(String),
  },
  cierre_mensual: {
    name: "admin_cierre_mensua",
    params: (d) => [d.mes, d.anio, String(d.totalServicios), d.totalIngresos].map(String),
  },
  servicio_sin_operador: {
    name: "admin_servicio_sin_operador",
    params: (d) => [d.folio, d.clientName, d.fechaServicio].map(String),
  },
  resumen_diario: {
    name: "admin_resumen_diario",
    params: (d) => [d.fecha, String(d.serviciosHoy ?? 0), String(d.facturasPendientes ?? 0)].map(String),
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authContext = await requireUserRoles(req, ["admin"]);
    if ("response" in authContext) {
      return withHeaders(authContext.response, corsHeaders);
    }

    const body: AdminWhatsAppRequest = await req.json();
    const event = body?.event;
    const data = body?.data;
    const testMode = body?.testMode === true;
    const testPhone = body?.testPhone;

    if (!event || typeof event !== "string") {
      return withHeaders(jsonResponse({ error: "event es requerido" }, 400), corsHeaders);
    }
    if (!data || typeof data !== "object") {
      return withHeaders(jsonResponse({ error: "data es requerido" }, 400), corsHeaders);
    }

    const template = templates[event];
    if (!template) {
      return withHeaders(jsonResponse({ error: "Evento no soportado", event }, 400), corsHeaders);
    }

    const parameters = template.params(data);

    // Read WhatsApp settings from DB
    const { data: waSettings } = await authContext.supabaseAdmin
      .from("whatsapp_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    // Map event -> setting flag (manual buttons like orden_compra / cierre_mensual always send)
    const eventToSettingKey: Record<string, string> = {
      servicio_completado: "notify_service_completed",
      documento_vencimiento: "notify_document_expiry",
      pago_pendiente: "notify_payment_pending",
      servicio_sin_cotizacion: "notify_service_no_quote",
      servicio_sin_operador: "notify_service_no_operator",
      resumen_diario: "notify_daily_reminder",
    };
    const settingKey = eventToSettingKey[event];
    if (!testMode && settingKey && waSettings && (waSettings as any)[settingKey] === false) {
      return withHeaders(
        jsonResponse({ success: true, skipped: true, reason: "Notificación desactivada en configuración" }),
        corsHeaders,
      );
    }

    const sendOpts = {
      event,
      triggeredBy: authContext.user?.id ?? null,
      context: (data as Record<string, unknown>) ?? {},
    };

    if (testMode && testPhone) {
      const norm = normalizeChileanPhone(testPhone);
      if (!norm.ok) {
        return withHeaders(
          jsonResponse({ success: false, error: { code: "INVALID_PHONE", message: norm.reason } }, 400),
          corsHeaders,
        );
      }
      const result = await sendWhatsAppTemplate(norm.phone, template.name, parameters, sendOpts);
      return withHeaders(
        jsonResponse(
          { success: result.success, event, notified: result.success ? 1 : 0, error: result.error },
          result.success ? 200 : 502,
        ),
        corsHeaders,
      );
    }

    const rawNumbers = [
      (waSettings as any)?.admin_phone_1 || Deno.env.get("ADMIN_WHATSAPP_1"),
      (waSettings as any)?.admin_phone_2 || Deno.env.get("ADMIN_WHATSAPP_2"),
    ].filter(Boolean) as string[];

    if (rawNumbers.length === 0) {
      return withHeaders(
        jsonResponse({ error: "No hay números de administrador configurados" }, 422),
        corsHeaders,
      );
    }

    const normalized = rawNumbers.map((n) => normalizeChileanPhone(n));
    const valid = normalized.filter((n) => n.ok).map((n) => n.phone);
    const invalid = normalized.filter((n) => !n.ok);

    if (valid.length === 0) {
      return withHeaders(
        jsonResponse(
          {
            success: false,
            error: {
              code: "ALL_PHONES_INVALID",
              message: "Ningún número de administrador tiene formato válido",
              invalid: invalid.map((i) => ({ phone: i.phone, reason: i.reason })),
            },
          },
          422,
        ),
        corsHeaders,
      );
    }

    const outcome = await sendWhatsAppTemplateBulk(valid, template.name, parameters, sendOpts);
    const status = outcome.failed.length === 0 ? 200 : outcome.notified === 0 ? 502 : 207;

    return withHeaders(
      jsonResponse(
        {
          success: outcome.notified > 0,
          event,
          notified: outcome.notified,
          failed: outcome.failed,
          invalid: invalid.map((i) => ({ phone: i.phone, reason: i.reason })),
        },
        status,
      ),
      corsHeaders,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withHeaders(
      jsonResponse({ success: false, error: { code: "INTERNAL_ERROR", message } }, 500),
      corsHeaders,
    );
  }
});


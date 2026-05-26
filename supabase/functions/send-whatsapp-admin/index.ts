import { requireUserRoles, withHeaders, jsonResponse } from "../_shared/auth.ts";
import { notifyAdmins, sendWhatsAppTemplate, normalizeChileanPhone } from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    name: "admin_cierre_mensual",
    params: (d) => [d.mes, d.anio, String(d.totalServicios), d.totalIngresos].map(String),
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
    };
    const settingKey = eventToSettingKey[event];
    if (!testMode && settingKey && waSettings && (waSettings as any)[settingKey] === false) {
      return withHeaders(
        jsonResponse({ success: true, skipped: true, reason: "Notificación desactivada en configuración" }),
        corsHeaders,
      );
    }

    let notified = 0;
    if (testMode && testPhone) {
      await sendWhatsAppTemplate(normalizeChileanPhone(testPhone), template.name, parameters);
      notified = 1;
    } else {
      const numbers = [
        (waSettings as any)?.admin_phone_1 || Deno.env.get("ADMIN_WHATSAPP_1"),
        (waSettings as any)?.admin_phone_2 || Deno.env.get("ADMIN_WHATSAPP_2"),
      ].filter(Boolean) as string[];

      if (numbers.length === 0) {
        return withHeaders(
          jsonResponse({ error: "No hay números de administrador configurados" }, 422),
          corsHeaders,
        );
      }

      await Promise.all(
        numbers.map((n) => sendWhatsAppTemplate(normalizeChileanPhone(n), template.name, parameters)),
      );
      notified = numbers.length;
    }

    return withHeaders(
      jsonResponse({
        success: true,
        event,
        notified,
      }),
      corsHeaders,
    );
  } catch (error) {
    return withHeaders(jsonResponse({ success: false, error }, 500), corsHeaders);
  }
});


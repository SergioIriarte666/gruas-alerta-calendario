import { requireUserRoles, withHeaders, jsonResponse } from "../_shared/auth.ts";
import { notifyAdmins } from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AdminWhatsAppRequest = {
  event: string;
  data: Record<string, unknown>;
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
    await notifyAdmins(template.name, parameters);

    const notified = [
      Deno.env.get("ADMIN_WHATSAPP_1"),
      Deno.env.get("ADMIN_WHATSAPP_2"),
    ].filter(Boolean).length;

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


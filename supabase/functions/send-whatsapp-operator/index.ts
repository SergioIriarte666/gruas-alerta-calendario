import { requireUserRoles, withHeaders, jsonResponse } from "../_shared/auth.ts";
import { normalizeChileanPhone, sendWhatsAppTemplate } from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const WEEKDAYS_ES = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
];

/**
 * Formatea una fecha de servicio sin sufrir el corrimiento de timezone que
 * sucede al pasar `"YYYY-MM-DD"` directo a `new Date(...)` en Deno (UTC).
 */
function formatServiceDate(value: string): string {
  if (!value) return "";
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    // Construimos en UTC para que getUTC* devuelva los valores tal cual
    const utc = new Date(Date.UTC(year, month - 1, day));
    const weekday = WEEKDAYS_ES[utc.getUTCDay()];
    const monthName = MONTHS_ES[utc.getUTCMonth()];
    return `${weekday} ${day} de ${monthName} de ${year}`;
  }
  // Si trae hora, dejamos que Date la interprete y formateamos en es-CL
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type OperatorWhatsAppRequest = {
  operatorId: string;
  serviceId?: string;
  folio: string;
  clientName: string;
  clientPhone: string;
  serviceDate: string;
  origin: string;
  destination: string;
  force?: boolean;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authContext = await requireUserRoles(req, ["admin", "operator"]);
    if ("response" in authContext) {
      return withHeaders(authContext.response, corsHeaders);
    }

    // Respect notify_operator_assigned flag
    const { data: waSettings } = await authContext.supabaseAdmin
      .from("whatsapp_settings")
      .select("notify_operator_assigned")
      .limit(1)
      .maybeSingle();

    if (waSettings && (waSettings as any).notify_operator_assigned === false) {
      return withHeaders(
        jsonResponse({
          success: true,
          skipped: true,
          reason: "Notificación de operador desactivada en configuración",
        }),
        corsHeaders,
      );
    }

    const body: OperatorWhatsAppRequest = await req.json();
    const {
      operatorId,
      serviceId,
      folio,
      clientName,
      clientPhone,
      serviceDate,
      origin,
      destination,
      force,
    } = body ?? ({} as OperatorWhatsAppRequest);

    if (!operatorId || !folio || !serviceDate) {
      return withHeaders(
        jsonResponse({ error: "operatorId, folio y serviceDate son requeridos" }, 400),
        corsHeaders,
      );
    }

    // ── Idempotencia: si el mismo operador ya fue notificado para este servicio, no reenviar
    if (serviceId && !force) {
      const { data: existing } = await authContext.supabaseAdmin
        .from("services")
        .select("operator_notified_at, operator_notified_for")
        .eq("id", serviceId)
        .maybeSingle();
      if (
        existing?.operator_notified_at &&
        existing?.operator_notified_for === operatorId
      ) {
        return withHeaders(
          jsonResponse({
            success: true,
            skipped: true,
            reason: "Operador ya notificado para este servicio",
            notifiedAt: existing.operator_notified_at,
          }),
          corsHeaders,
        );
      }
    }

    const { data: operator, error: operatorError } = await authContext.supabaseAdmin
      .from("operators")
      .select("name, phone")
      .eq("id", operatorId)
      .maybeSingle();

    if (operatorError) {
      return withHeaders(
        jsonResponse({ error: "No se pudo obtener el operador", details: operatorError }, 500),
        corsHeaders,
      );
    }

    const operatorName = (operator?.name || "Operador") as string;
    const operatorPhone = (operator?.phone || "").toString().trim();
    if (!operatorPhone) {
      return withHeaders(
        jsonResponse(
          { success: false, error: { code: "NO_PHONE", message: "Operador sin teléfono" } },
          422,
        ),
        corsHeaders,
      );
    }

    const normalized = normalizeChileanPhone(operatorPhone);
    if (!normalized.ok) {
      return withHeaders(
        jsonResponse(
          { success: false, error: { code: "INVALID_PHONE", message: normalized.reason } },
          422,
        ),
        corsHeaders,
      );
    }

    const formattedDate = formatServiceDate(serviceDate);

    const result = await sendWhatsAppTemplate(
      normalized.phone,
      "servicio_asignado",
      [
        operatorName,
        String(folio),
        formattedDate,
        origin || "",
        destination || "",
        clientName || "",
        clientPhone || "",
      ],
      {
        event: "servicio_asignado",
        triggeredBy: authContext.user?.id ?? null,
        context: { folio, operatorId, serviceDate, clientName },
      },
    );

    if (!result.success) {
      return withHeaders(
        jsonResponse({ success: false, error: result.error }, 502),
        corsHeaders,
      );
    }

    // Marcar como notificado en services para idempotencia futura
    if (serviceId) {
      try {
        await authContext.supabaseAdmin
          .from("services")
          .update({
            operator_notified_at: new Date().toISOString(),
            operator_notified_for: operatorId,
          })
          .eq("id", serviceId);
      } catch (e) {
        console.warn("[send-whatsapp-operator] no se pudo marcar operator_notified_at:", e);
      }
    }

    return withHeaders(
      jsonResponse({
        success: true,
        message: "WhatsApp enviado al operador",
        messageId: result.messageId,
      }),
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

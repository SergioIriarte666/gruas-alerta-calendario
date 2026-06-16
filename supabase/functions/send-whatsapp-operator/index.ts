import { requireUserRoles, withHeaders, jsonResponse } from "../_shared/auth.ts";
import { getWhatsAppGate, normalizeChileanPhone, sendWhatsAppTemplate } from "../_shared/whatsapp.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const corsHdrs = (req: Request) => ({ ...getCorsHeaders(req), "Access-Control-Allow-Methods": "POST, OPTIONS" });

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
  vehicleBrand?: string;
  vehicleModel?: string;
  licensePlate?: string;
  clientName: string;
  clientPhone: string;
  contactPerson?: string;
  contactPhone?: string;
  serviceDate: string;
  origin: string;
  destination: string;
  force?: boolean;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHdrs(req) });
  }

  try {
    const authContext = await requireUserRoles(req, ["admin", "operator"]);
    if ("response" in authContext) {
      return withHeaders(authContext.response, corsHdrs(req));
    }

    // Master switch + flag individual (helper compartido: única fuente de verdad)
    const gate = await getWhatsAppGate(authContext.supabaseAdmin);

    if (!gate.enabled) {
      console.log("[send-whatsapp-operator] Master switch OFF — mensaje omitido");
      return withHeaders(
        jsonResponse({ success: true, skipped: true, reason: "whatsapp_disabled" }),
        corsHdrs(req),
      );
    }

    if (gate.settings?.notify_operator_assigned === false) {
      return withHeaders(
        jsonResponse({
          success: true,
          skipped: true,
          reason: "Notificación de operador desactivada en configuración",
        }),
        corsHdrs(req),
      );
    }

    const body: OperatorWhatsAppRequest = await req.json();
    const {
      operatorId,
      serviceId,
      folio,
      vehicleBrand,
      vehicleModel,
      licensePlate,
      clientName,
      clientPhone,
      contactPerson,
      contactPhone,
      serviceDate,
      origin,
      destination,
      force,
    } = body ?? ({} as OperatorWhatsAppRequest);

    if (!operatorId || !folio || !serviceDate) {
      return withHeaders(
        jsonResponse({ error: "operatorId, folio y serviceDate son requeridos" }, 400),
        corsHdrs(req),
      );
    }

    // ── Idempotencia: evita doble envío dentro de ventana de 30 minutos,
    //    incluso cuando force=true (protege contra doble-clic en modal + save del form)
    if (serviceId) {
      const { data: existing } = await authContext.supabaseAdmin
        .from("services")
        .select("operator_notified_at, operator_notified_for")
        .eq("id", serviceId)
        .maybeSingle();

      if (existing?.operator_notified_at && existing?.operator_notified_for === operatorId) {
        const notifiedAt = new Date(existing.operator_notified_at).getTime();
        const minutesAgo = (Date.now() - notifiedAt) / 60_000;

        if (!force || minutesAgo < 30) {
          console.log(
            `[send-whatsapp-operator] DEDUP skip: ya notificado hace ${minutesAgo.toFixed(1)} min` +
            ` (service=${serviceId}, operator=${operatorId}, force=${force})`,
          );
          return withHeaders(
            jsonResponse({
              success: true,
              skipped: true,
              reason: force
                ? `Reenvío bloqueado: operador ya notificado hace ${Math.round(minutesAgo)} min (ventana 30 min)`
                : "Operador ya notificado para este servicio",
              notifiedAt: existing.operator_notified_at,
            }),
            corsHdrs(req),
          );
        }
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
        corsHdrs(req),
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
        corsHdrs(req),
      );
    }

    const normalized = normalizeChileanPhone(operatorPhone);
    if (!normalized.ok) {
      return withHeaders(
        jsonResponse(
          { success: false, error: { code: "INVALID_PHONE", message: normalized.reason } },
          422,
        ),
        corsHdrs(req),
      );
    }

    const formattedDate = formatServiceDate(serviceDate);

    // WhatsApp API (131008): parámetros vacíos "" se tratan como ausentes — usar fallbacks
    const safe = (v: string | undefined | null, fb: string) =>
      v && v.trim() !== "" ? v.trim() : fb;

    const params = [
      safe(operatorName, "Operador"),                            // {{1}} nombre operador
      safe(String(folio), "-"),                                  // {{2}} folio
      safe(formattedDate, "Fecha por confirmar"),                // {{3}} fecha
      safe(vehicleBrand, "Sin marca"),                          // {{4}} marca
      safe(vehicleModel, "Sin modelo"),                         // {{5}} modelo
      safe(licensePlate, "Sin patente"),                        // {{6}} patente
      safe(origin, "Origen por confirmar"),                     // {{7}} origen
      safe(destination, "Destino por confirmar"),               // {{8}} destino
      safe(contactPerson || clientName, "Sin contacto"),        // {{9}} persona en el lugar
      safe(contactPhone || clientPhone, "Sin teléfono"),        // {{10}} teléfono persona en el lugar
    ];

    console.log("[send-whatsapp-operator] params:", {
      phone: normalized.phone, operatorName, folio, formattedDate,
      vehicleBrand, vehicleModel, licensePlate, origin, destination,
      contactPerson, contactPhone, clientName, clientPhone,
    });

    const result = await sendWhatsAppTemplate(
      normalized.phone,
      "servicio_asignado_v3",
      params,
      {
        event: "servicio_asignado",
        triggeredBy: authContext.user?.id ?? null,
        context: { folio, operatorId, serviceDate, clientName },
      },
    );

    if (!result.success) {
      return withHeaders(
        jsonResponse({ success: false, error: result.error }, 502),
        corsHdrs(req),
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
      corsHdrs(req),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withHeaders(
      jsonResponse({ success: false, error: { code: "INTERNAL_ERROR", message } }, 500),
      corsHdrs(req),
    );
  }
});

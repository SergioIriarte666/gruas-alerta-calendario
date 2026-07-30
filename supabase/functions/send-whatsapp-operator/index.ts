import { requireUserRoles, withHeaders, jsonResponse } from "../_shared/auth.ts";
import {
  getWhatsAppGate,
  normalizeChileanPhone,
  sendWhatsAppTemplateBulk,
  type BulkRecipient,
} from "../_shared/whatsapp.ts";
import { acquireNotificationDedupe, releaseNotificationDedupe } from "../_shared/dedupe.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const corsHdrs = (req: Request) => ({ ...getCorsHeaders(req), "Access-Control-Allow-Methods": "POST, OPTIONS" });

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const WEEKDAYS_ES = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
];

/** Ventana mínima antes de permitir un reenvío explícito (force). */
const RESEND_WINDOW_MINUTES = 30;

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

    const admin = authContext.supabaseAdmin;

    // ── Destinatarios: TODOS los operadores del servicio, no solo el principal.
    //    El auxiliar va al mismo trabajo; enterarse no es opcional.
    type Candidate = { operatorId: string; name: string; rawPhone: string };
    const candidates: Candidate[] = [];
    const seenOperators = new Set<string>();

    const pushCandidate = (
      id: string | null | undefined,
      name: unknown,
      phone: unknown,
    ) => {
      if (!id || seenOperators.has(id)) return;
      seenOperators.add(id);
      candidates.push({
        operatorId: id,
        name: (typeof name === "string" && name.trim()) || "Operador",
        rawPhone: (phone ?? "").toString().trim(),
      });
    };

    // El operador del request va primero: es el principal y el que manda para
    // operator_notified_for.
    const { data: requestedOperator, error: requestedOperatorError } = await admin
      .from("operators")
      .select("name, phone")
      .eq("id", operatorId)
      .maybeSingle();

    if (requestedOperatorError) {
      return withHeaders(
        jsonResponse({ error: "No se pudo obtener el operador", details: requestedOperatorError }, 500),
        corsHdrs(req),
      );
    }

    pushCandidate(operatorId, requestedOperator?.name, requestedOperator?.phone);

    if (serviceId) {
      const { data: resources, error: resourcesError } = await admin
        .from("service_resources")
        .select("operator_id, is_primary, operator:operators(name, phone)")
        .eq("service_id", serviceId)
        .eq("resource_type", "operator");

      if (resourcesError) {
        // Sin la lista de recursos igual se notifica al principal: mejor un
        // mensaje que ninguno.
        console.warn("[send-whatsapp-operator] no se pudo leer service_resources:", resourcesError.message);
      }

      for (const row of resources ?? []) {
        const operator = (row as { operator?: { name?: string; phone?: string } }).operator;
        pushCandidate((row as { operator_id?: string }).operator_id, operator?.name, operator?.phone);
      }

      // Por si el operador de services quedó fuera de service_resources.
      const { data: serviceRow } = await admin
        .from("services")
        .select("operator_id, operator:operators!services_operator_id_fkey(name, phone)")
        .eq("id", serviceId)
        .maybeSingle();

      const serviceOperator = (serviceRow as { operator?: { name?: string; phone?: string } } | null)?.operator;
      pushCandidate(
        (serviceRow as { operator_id?: string } | null)?.operator_id,
        serviceOperator?.name,
        serviceOperator?.phone,
      );
    }

    const formattedDate = formatServiceDate(serviceDate);

    // WhatsApp API (131008): parámetros vacíos "" se tratan como ausentes — usar fallbacks
    const safe = (v: string | undefined | null, fb: string) =>
      v && v.trim() !== "" ? v.trim() : fb;

    // {{2}}..{{10}} son iguales para todos; solo {{1}} cambia por destinatario.
    const sharedParams = [
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

    const skipped: Array<{ operatorId: string; reason: string; code: string }> = [];
    const seenPhones = new Set<string>();
    const dedupeKeys = new Map<string, string>();
    const recipients: Array<BulkRecipient & { operatorId: string; name: string }> = [];

    for (const candidate of candidates) {
      if (!candidate.rawPhone) {
        console.warn(`[send-whatsapp-operator] operador sin teléfono: ${candidate.operatorId} (${candidate.name})`);
        skipped.push({ operatorId: candidate.operatorId, code: "NO_PHONE", reason: "Operador sin teléfono" });
        continue;
      }

      const normalized = normalizeChileanPhone(candidate.rawPhone);
      if (!normalized.ok) {
        console.warn(
          `[send-whatsapp-operator] teléfono inválido para ${candidate.operatorId} (${candidate.name}): ${normalized.reason}`,
        );
        skipped.push({
          operatorId: candidate.operatorId,
          code: "INVALID_PHONE",
          reason: normalized.reason ?? "Teléfono inválido",
        });
        continue;
      }

      // Dedupe por teléfono normalizado, no por operator_id: dos fichas de
      // operador con el mismo número son la misma persona y un solo mensaje.
      if (seenPhones.has(normalized.phone)) {
        continue;
      }
      seenPhones.add(normalized.phone);

      // Idempotencia POR OPERADOR. services.operator_notified_for guarda un solo
      // uuid y no alcanza para dos destinatarios.
      if (serviceId) {
        const alertKey = `servicio_asignado:${serviceId}:${candidate.operatorId}`;
        const acquired = await acquireNotificationDedupe(admin, alertKey, {
          folio,
          operatorId: candidate.operatorId,
          serviceId,
        });

        if (!acquired.acquired) {
          if (acquired.error) {
            console.warn(`[send-whatsapp-operator] dedupe con error (${alertKey}): ${acquired.error}`);
          }

          // force reabre la ventana, pero recién pasados RESEND_WINDOW_MINUTES:
          // protege del doble clic sin bloquear un reenvío legítimo.
          let reopened = false;
          if (force) {
            const { data: previous } = await admin
              .from("whatsapp_alert_dedupe")
              .select("created_at")
              .eq("alert_key", alertKey)
              .maybeSingle();

            const minutesAgo = previous?.created_at
              ? (Date.now() - new Date(previous.created_at as string).getTime()) / 60_000
              : Number.POSITIVE_INFINITY;

            if (minutesAgo >= RESEND_WINDOW_MINUTES) {
              await releaseNotificationDedupe(admin, alertKey);
              const retry = await acquireNotificationDedupe(admin, alertKey, {
                folio,
                operatorId: candidate.operatorId,
                serviceId,
                resend: true,
              });
              reopened = retry.acquired;
            }
          }

          if (!reopened) {
            console.log(
              `[send-whatsapp-operator] DEDUP skip (service=${serviceId}, operator=${candidate.operatorId}, force=${force})`,
            );
            skipped.push({
              operatorId: candidate.operatorId,
              code: "ALREADY_NOTIFIED",
              reason: force
                ? `Reenvío bloqueado: ya notificado hace menos de ${RESEND_WINDOW_MINUTES} min`
                : "Operador ya notificado para este servicio",
            });
            // El teléfono queda tomado a propósito: si otra ficha de operador
            // repite el número, esa persona YA recibió el mensaje de este
            // servicio y no debe recibir un segundo.
            continue;
          }
        }

        dedupeKeys.set(candidate.operatorId, alertKey);
      }

      recipients.push({
        operatorId: candidate.operatorId,
        name: candidate.name,
        phone: normalized.phone,
        parameters: [safe(candidate.name, "Operador"), ...sharedParams],
      });
    }

    if (recipients.length === 0) {
      // Un solo operador sin teléfono usable: se responde igual que antes para
      // que el frontend siga distinguiendo NO_PHONE de INVALID_PHONE.
      const phoneProblem = skipped.find((s) => s.code === "NO_PHONE" || s.code === "INVALID_PHONE");
      if (phoneProblem) {
        return withHeaders(
          jsonResponse(
            { success: false, error: { code: phoneProblem.code, message: phoneProblem.reason }, skippedRecipients: skipped },
            422,
          ),
          corsHdrs(req),
        );
      }

      return withHeaders(
        jsonResponse({
          success: true,
          skipped: true,
          reason: skipped[0]?.reason ?? "Operador ya notificado para este servicio",
          skippedRecipients: skipped,
        }),
        corsHdrs(req),
      );
    }

    console.log("[send-whatsapp-operator] destinatarios:", {
      folio,
      formattedDate,
      recipients: recipients.map((r) => ({ operatorId: r.operatorId, name: r.name, phone: r.phone })),
      skipped,
    });

    const outcome = await sendWhatsAppTemplateBulk(
      recipients,
      "servicio_asignado_v3",
      // Fallback por si algún destinatario no trajera parámetros propios.
      [safe(recipients[0].name, "Operador"), ...sharedParams],
      {
        event: "servicio_asignado",
        triggeredBy: authContext.user?.id ?? null,
        context: { folio, operatorId, serviceDate, clientName },
      },
    );

    // El que falló no queda "notificado": se libera su llave para que un
    // reintento pueda salir.
    outcome.results.forEach((result, index) => {
      if (result.success) return;
      const alertKey = dedupeKeys.get(recipients[index].operatorId);
      if (alertKey) {
        void releaseNotificationDedupe(admin, alertKey);
      }
    });

    if (outcome.notified === 0) {
      return withHeaders(
        jsonResponse({ success: false, error: outcome.failed[0]?.error, failed: outcome.failed }, 502),
        corsHdrs(req),
      );
    }

    // operator_notified_at/for se mantienen apuntando al principal: la UI los lee
    // y este cambio no es el lugar para migrarla.
    if (serviceId) {
      try {
        await admin
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
        message: outcome.notified === 1
          ? "WhatsApp enviado al operador"
          : `WhatsApp enviado a ${outcome.notified} operadores`,
        notified: outcome.notified,
        messageId: outcome.results.find((r) => r.success)?.messageId,
        recipients: recipients.map((r) => ({ operatorId: r.operatorId, name: r.name, phone: r.phone })),
        failed: outcome.failed,
        skippedRecipients: skipped,
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

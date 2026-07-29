import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { assertCronRequest, errorMessage, json } from "../_shared/retention.ts";
import {
  getWhatsAppGate,
  normalizeChileanPhone,
  sendWhatsAppDocumentTemplate,
  sendWhatsAppTemplate,
} from "../_shared/whatsapp.ts";
import {
  acquireNotificationDedupe,
  notificationDedupeKey,
  releaseNotificationDedupe,
} from "../_shared/dedupe.ts";
import {
  sanitizeInspectionEmailAddress,
  sendInspectionEmailWithPdf,
  type InspectionEmailData,
} from "../_shared/email.ts";
import {
  getEmailNotificationGate,
  getInspectionEmailSkipReason,
} from "../_shared/emailSettings.ts";

const BATCH_LIMIT = 10;
const MAX_ATTEMPTS = 5;
const TRACKING_BASE_URL = "https://app.gruas5norte.cl/track/";
const PDF_SIGNED_URL_SECONDS = 10 * 60;

/**
 * Sufijo del botón de la plantilla `operador_telemetria_caida`.
 *
 * En Meta el botón se configura como `https://app.gruas5norte.cl/operador?accion={{1}}`
 * y aquí se manda solo el valor. Aterriza en el portal operador con el botón
 * "Reanudar viaje" enfocado (Fix 10).
 */
const RESUME_TRIP_BUTTON_PARAM = "reanudar";

type OutboxKind =
  | "tracking_link"
  | "inspection_whatsapp"
  | "inspection_email"
  | "delivery_whatsapp"
  | "delivery_email"
  | "operator_tracking_silence";

/**
 * Canales HACIA EL CLIENTE. Son los únicos que el interruptor por servicio
 * (`client_notifications_enabled`) puede apagar: las alertas internas —hoy el
 * watchdog de telemetría— salen igual con el interruptor abajo, porque apagar
 * la voz hacia afuera no puede dejar ciega a la operación.
 */
const CLIENT_FACING_KINDS: ReadonlySet<OutboxKind> = new Set<OutboxKind>([
  "tracking_link",
  "inspection_whatsapp",
  "inspection_email",
  "delivery_whatsapp",
  "delivery_email",
]);

interface OutboxRow {
  id: string;
  kind: OutboxKind;
  service_id: string;
  inspection_id: string | null;
  payload: Record<string, unknown>;
  attempts: number;
}

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatServiceDate(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) return `${Number(m[3])} de ${MONTHS_ES[Number(m[2]) - 1]} de ${m[1]}`;
  return value;
}

function getPayloadPdf(row: OutboxRow): { bucket: string; path: string } | null {
  const pdf = row.payload?.pdf as { bucket?: unknown; path?: unknown } | undefined;
  if (typeof pdf?.bucket === "string" && typeof pdf.path === "string") {
    return { bucket: pdf.bucket, path: pdf.path };
  }
  return null;
}

function getOutboxError(error: unknown): string {
  return errorMessage(error).slice(0, 2000);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    assertCronRequest(req);
  } catch (response) {
    if (response instanceof Response) return response;
    throw response;
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const worker = new OutboxWorker(supabase);
  return worker.run();
});

class OutboxWorker {
  constructor(private readonly supabase: any) {}

  async run(): Promise<Response> {
    const { data, error } = await this.supabase.rpc("claim_notification_outbox", { p_limit: BATCH_LIMIT });
    if (error) return json({ error: error.message }, 500);

    const rows = ((data ?? []) as OutboxRow[]);
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    let retried = 0;

    for (const row of rows) {
      try {
        const outcome = await this.processRow(row);
        if (outcome === "sent") sent += 1;
        if (outcome === "skipped") skipped += 1;
      } catch (cause) {
        const terminal = await this.markFailure(row, getOutboxError(cause));
        if (terminal) failed += 1;
        else retried += 1;
      }
    }

    return json({ processed: rows.length, sent, skipped, failed, retried });
  }

  private async processRow(row: OutboxRow): Promise<"sent" | "skipped"> {
    // El cortafuegos va PRIMERO, antes de resolver destinatarios o firmar PDFs:
    // con el interruptor abajo no se toca nada del servicio ni se consulta a
    // Meta. Es el cortafuegos de diseño que reemplaza al de datos placeholder
    // (25/07: un correo salió `sent` hacia un dominio con error de tipeo).
    if (CLIENT_FACING_KINDS.has(row.kind)) {
      const { data: enabled, error } = await this.supabase.rpc(
        "service_client_notifications_enabled",
        { p_service_id: row.service_id },
      );
      if (error) throw new Error(error.message);
      if (enabled !== true) {
        await this.markSkipped(row.id, "client_notifications_disabled");
        return "skipped";
      }
    }

    if (row.kind === "operator_tracking_silence") {
      const dispatched = await this.dispatchTrackingSilence(row);
      if (!dispatched) return "skipped";
      await this.markSent(row.id);
      return "sent";
    }

    if (row.kind === "tracking_link" || row.kind === "inspection_whatsapp" || row.kind === "delivery_whatsapp") {
      const gate = await getWhatsAppGate(this.supabase);
      const gateReason = this.getWhatsAppSkipReason(row.kind, gate);
      if (gateReason) {
        await this.markSkipped(row.id, gateReason);
        return "skipped";
      }
    }

    if (row.kind === "inspection_email" || row.kind === "delivery_email") {
      const gate = await getEmailNotificationGate(this.supabase);
      const gateReason = getInspectionEmailSkipReason(row.kind, gate);
      if (gateReason) {
        await this.markSkipped(row.id, gateReason);
        return "skipped";
      }
    }

    if (row.kind === "tracking_link") {
      const dispatched = await this.dispatchTracking(row);
      if (!dispatched) return "skipped";
      await this.markSent(row.id);
      return "sent";
    }

    if (!row.inspection_id) {
      await this.markSkipped(row.id, "missing_inspection_id");
      return "skipped";
    }

    if (row.kind === "inspection_whatsapp" || row.kind === "delivery_whatsapp") {
      const dispatched = await this.dispatchInspectionWhatsApp(row);
      if (!dispatched) return "skipped";
      await this.markSent(row.id);
      return "sent";
    }

    const dispatched = await this.dispatchInspectionEmail(row);
    if (!dispatched) return "skipped";
    await this.markSent(row.id);
    return "sent";
  }

  private getWhatsAppSkipReason(
    kind: "tracking_link" | "inspection_whatsapp" | "delivery_whatsapp",
    gate: { enabled: boolean; settings: Record<string, unknown> | null },
  ): string | null {
    if (!gate.enabled) return "whatsapp_disabled";
    if (kind === "inspection_whatsapp" && gate.settings?.notify_inspection_completed === false) {
      return "notify_inspection_completed_disabled";
    }
    if (kind === "delivery_whatsapp" && gate.settings?.notify_vehicle_pickup === false) {
      return "notify_vehicle_pickup_disabled";
    }
    return null;
  }

  private async fetchService(serviceId: string) {
    const { data, error } = await this.supabase
      .from("services")
      .select(`
        id,
        folio,
        contact_person,
        contact_phone,
        service_date,
        client:clients!services_client_id_fkey(name, phone, email),
        operator:operators(name),
        crane:cranes(license_plate)
      `)
      .eq("id", serviceId)
      .maybeSingle();

    if (error || !data) throw new Error(error?.message ?? "Servicio no encontrado");
    return data as any;
  }

  private async fetchInspection(inspectionId: string) {
    const { data, error } = await this.supabase
      .from("inspections")
      .select("id, service_id, equipment_checklist, pdf_url, pdf_retiro_url")
      .eq("id", inspectionId)
      .maybeSingle();

    if (error || !data) throw new Error(error?.message ?? "Inspección no encontrada");
    return data as any;
  }

  private async dispatchTracking(row: OutboxRow): Promise<boolean> {
    const service = await this.fetchService(row.service_id);
    const normalizedPhone = normalizeChileanPhone(service.contact_phone as string | null);
    if (!normalizedPhone.ok) {
      await this.markSkipped(row.id, "no_contact_phone");
      return false;
    }

    const alertKey = notificationDedupeKey("tracking_link", row.service_id);
    return this.withDedupe(row, alertKey, {
      service_id: row.service_id,
      folio: service.folio,
      channel: "whatsapp",
      source: "process-notification-outbox",
    }, async () => {
      const { data: token, error: tokenError } = await this.supabase.rpc("get_or_create_tracking_token", {
        p_service_id: row.service_id,
        p_created_by: null,
      });
      if (tokenError || !token) throw new Error(tokenError?.message ?? "No se pudo generar token de seguimiento");

      const operator = one(service.operator);
      const crane = one(service.crane);
      const operatorFirstName = typeof operator?.name === "string" && operator.name.trim() !== ""
        ? operator.name.trim().split(" ")[0]
        : "";

      const result = await sendWhatsAppTemplate(
        normalizedPhone.phone,
        "cliente_seguimiento_grua",
        [
          service.contact_person || "Cliente",
          service.folio,
          operatorFirstName,
          crane?.license_plate || "",
        ],
        {
          event: "tracking_link",
          triggeredBy: null,
          context: { folio: service.folio, serviceId: row.service_id, trackingUrl: `${TRACKING_BASE_URL}${token}` },
        },
        token as string,
      );

      if (!result.success) {
        throw new Error(result.error?.message ?? "No se pudo enviar WhatsApp de seguimiento");
      }
    });
  }

  /**
   * Aviso al OPERADOR de que su telemetría se cayó.
   *
   * Va sin `withDedupe`: el dedupe de este tipo ya se resolvió al encolar, en
   * `enqueue_tracking_silence_alerts`, con una llave por EPISODIO (servicio +
   * último punto conocido). Meterlo aquí también bloquearía el reintento de una
   * fila cuyo envío falló, que es justo lo que el outbox tiene que poder hacer.
   *
   * Tampoco pasa por el gate de WhatsApp del cliente: es un canal interno.
   */
  private async dispatchTrackingSilence(row: OutboxRow): Promise<boolean> {
    const payload = row.payload as {
      folio?: string;
      operator_name?: string;
      operator_phone?: string;
      silent_minutes?: number;
      open_stop_reason?: string | null;
    };

    const normalizedPhone = normalizeChileanPhone(payload.operator_phone ?? null);
    if (!normalizedPhone.ok) {
      await this.markSkipped(row.id, "operator_without_valid_phone");
      return false;
    }

    const firstName = (payload.operator_name ?? "").trim().split(" ")[0] || "Operador";
    const minutes = String(Math.max(1, Math.round(payload.silent_minutes ?? 0)));

    const result = await sendWhatsAppTemplate(
      normalizedPhone.phone,
      "operador_telemetria_caida",
      [firstName, payload.folio ?? "", minutes],
      {
        event: "operador_telemetria_caida",
        triggeredBy: null,
        context: {
          folio: payload.folio,
          serviceId: row.service_id,
          silentMinutes: payload.silent_minutes,
          openStopReason: payload.open_stop_reason ?? null,
        },
      },
      RESUME_TRIP_BUTTON_PARAM,
    );

    if (!result.success) {
      throw new Error(result.error?.message ?? "No se pudo avisar al operador");
    }

    return true;
  }

  private async dispatchInspectionWhatsApp(row: OutboxRow): Promise<boolean> {
    const service = await this.fetchService(row.service_id);
    const inspection = await this.fetchInspection(row.inspection_id!);
    const phase = row.kind === "delivery_whatsapp" ? "final" : "initial";
    const client = one(service.client);
    const operator = one(service.operator);
    const recipientPhone = service.contact_phone || client?.phone || "";
    const recipientName = service.contact_phone
      ? (service.contact_person || client?.name || "Receptor")
      : (client?.name || "Cliente");

    const normalizedPhone = normalizeChileanPhone(recipientPhone);
    if (!normalizedPhone.ok) {
      await this.markSkipped(row.id, "invalid_or_missing_recipient_phone");
      return false;
    }

    const pdf = getPayloadPdf(row) ?? {
      bucket: "inspection-pdfs",
      path: phase === "final" ? inspection.pdf_retiro_url : inspection.pdf_url,
    };
    if (!pdf.path) throw new Error("PDF no disponible para WhatsApp");
    const pdfUrl = await this.createSignedUrl(pdf.bucket, pdf.path);

    const dedupeKind = phase === "final" ? "delivery_whatsapp" : "inspection_whatsapp";
    const alertKey = notificationDedupeKey(dedupeKind, row.inspection_id!);
    return this.withDedupe(row, alertKey, {
      service_id: row.service_id,
      inspection_id: row.inspection_id,
      folio: service.folio,
      phase,
      channel: "whatsapp",
      source: "process-notification-outbox",
    }, async () => {
      const result = await sendWhatsAppDocumentTemplate(
        normalizedPhone.phone,
        "inspeccion_completada_doc",
        [recipientName, service.folio, formatServiceDate(service.service_date), operator?.name || ""],
        pdfUrl,
        `${phase === "final" ? "Entrega" : "Inspeccion"}-${service.folio}.pdf`,
        {
          event: phase === "final" ? "retiro_completado" : "inspeccion_completada",
          triggeredBy: null,
          context: { folio: service.folio, serviceId: row.service_id, inspectionId: row.inspection_id, phase },
        },
      );

      if (!result.success) {
        throw new Error(result.error?.message ?? "No se pudo enviar WhatsApp con PDF");
      }
    });
  }

  private async dispatchInspectionEmail(row: OutboxRow): Promise<boolean> {
    const service = await this.fetchService(row.service_id);
    const inspection = await this.fetchInspection(row.inspection_id!);
    const phase = row.kind === "delivery_email" ? "final" : "initial";
    const client = one(service.client);
    const operator = one(service.operator);
    const clientEmail = client?.email || "";

    try {
      sanitizeInspectionEmailAddress(clientEmail);
    } catch {
      await this.markSkipped(row.id, "invalid_or_missing_client_email");
      return false;
    }

    const pdf = getPayloadPdf(row) ?? {
      bucket: "inspection-pdfs",
      path: phase === "final" ? inspection.pdf_retiro_url : inspection.pdf_url,
    };
    if (!pdf.path) throw new Error("PDF no disponible para email");
    const pdfBytes = await this.downloadPdf(pdf.bucket, pdf.path);

    const dedupeKind = phase === "final" ? "delivery_email" : "inspection_email";
    const alertKey = notificationDedupeKey(dedupeKind, row.inspection_id!);
    return this.withDedupe(row, alertKey, {
      service_id: row.service_id,
      inspection_id: row.inspection_id,
      folio: service.folio,
      phase,
      channel: "email",
      source: "process-notification-outbox",
    }, async () => {
      const inspectionData: InspectionEmailData = {
        serviceId: row.service_id,
        folio: service.folio,
        clientName: client?.name || "Cliente",
        clientEmail,
        operatorName: operator?.name || "Operador",
        serviceDate: formatServiceDate(service.service_date),
        equipmentCount: Array.isArray(inspection.equipment_checklist) ? inspection.equipment_checklist.length : 0,
        phase,
      };
      await sendInspectionEmailWithPdf(inspectionData, pdfBytes);
    });
  }

  private async withDedupe(
    row: OutboxRow,
    alertKey: string,
    context: Record<string, unknown>,
    send: () => Promise<void>,
  ): Promise<boolean> {
    const dedupe = await acquireNotificationDedupe(this.supabase, alertKey, context);
    if (dedupe.duplicate) {
      await this.markSkipped(row.id, "already_sent");
      return false;
    }
    if (!dedupe.acquired) {
      throw new Error(`No se pudo reservar dedupe: ${dedupe.error ?? "error desconocido"}`);
    }

    try {
      await send();
      return true;
    } catch (cause) {
      await releaseNotificationDedupe(this.supabase, alertKey);
      throw cause;
    }
  }

  private async createSignedUrl(bucket: string, path: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(path, PDF_SIGNED_URL_SECONDS);
    if (error || !data?.signedUrl) throw new Error(error?.message ?? "No se pudo firmar PDF");
    return data.signedUrl;
  }

  private async downloadPdf(bucket: string, path: string): Promise<Uint8Array> {
    const { data, error } = await this.supabase.storage.from(bucket).download(path);
    if (error || !data) throw new Error(error?.message ?? "No se pudo descargar PDF");
    return new Uint8Array(await data.arrayBuffer());
  }

  private async markSent(id: string): Promise<void> {
    await this.supabase
      .from("notification_outbox")
      .update({ status: "sent", processed_at: new Date().toISOString(), last_error: null })
      .eq("id", id);
  }

  private async markSkipped(id: string, reason: string): Promise<void> {
    await this.supabase
      .from("notification_outbox")
      .update({ status: "skipped", processed_at: new Date().toISOString(), last_error: reason })
      .eq("id", id);
  }

  private async markFailure(row: OutboxRow, message: string): Promise<boolean> {
    const attempts = row.attempts + 1;
    const terminal = attempts >= MAX_ATTEMPTS;
    await this.supabase
      .from("notification_outbox")
      .update({
        status: terminal ? "failed" : "pending",
        attempts,
        last_error: message,
        processed_at: terminal ? new Date().toISOString() : null,
      })
      .eq("id", row.id);
    return terminal;
  }
}

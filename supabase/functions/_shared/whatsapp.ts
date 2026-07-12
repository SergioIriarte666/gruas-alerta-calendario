import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  logId?: string;
  attempts?: number;
  error?: { code: string; message: string; details?: unknown };
}

export interface WhatsAppSendOptions {
  event?: string;
  triggeredBy?: string | null;
  context?: Record<string, unknown>;
}

export interface NormalizedPhoneResult {
  ok: boolean;
  phone: string;
  reason?: string;
}

const CHILEAN_PHONE_REGEX = /^569\d{8}$/;

/**
 * Normaliza un teléfono al formato E.164 chileno (`569XXXXXXXX`).
 * Devuelve `ok: false` si no es posible producir un número válido.
 */
export function normalizeChileanPhone(phone: string | null | undefined): NormalizedPhoneResult {
  if (!phone) return { ok: false, phone: "", reason: "Teléfono vacío" };
  let digits = String(phone).replace(/\D/g, "");
  if (!digits) return { ok: false, phone: "", reason: "Sin dígitos" };

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);

  // Casos: 9XXXXXXXX (móvil sin código país) → 569XXXXXXXX
  if (digits.length === 9 && digits.startsWith("9")) {
    digits = `56${digits}`;
  } else if (digits.length === 8) {
    // 8 dígitos: asumimos móvil sin el 9 inicial → 569XXXXXXXX
    digits = `569${digits}`;
  } else if (!digits.startsWith("56")) {
    digits = `56${digits}`;
  }

  if (!CHILEAN_PHONE_REGEX.test(digits)) {
    return {
      ok: false,
      phone: digits,
      reason: `Formato inválido (esperado 569XXXXXXXX, recibido ${digits})`,
    };
  }

  return { ok: true, phone: digits };
}

/**
 * Helper para legacy: si necesitas el string directo (sin validación), usa `.phone`.
 * Lanza si no es válido.
 */
export function normalizeChileanPhoneStrict(phone: string): string {
  const r = normalizeChileanPhone(phone);
  if (!r.ok) throw new Error(`Phone normalization failed: ${r.reason}`);
  return r.phone;
}

export interface WhatsAppGateResult {
  /** false solo cuando whatsapp_settings.whatsapp_enabled === false (master switch) */
  enabled: boolean;
  settings: Record<string, unknown> | null;
}

/**
 * Lee `whatsapp_settings` y resuelve el master switch `whatsapp_enabled`.
 * Única fuente de verdad para TODAS las rutas de envío: si retorna
 * `enabled: false`, la función NO debe llamar a la Meta Cloud API.
 * Usa `select("*")` para que una columna faltante no rompa la query
 * (un error aquí dejaría `data` en null y saltaría el chequeo en silencio).
 */
export async function getWhatsAppGate(
  admin: { from: (table: string) => any },
): Promise<WhatsAppGateResult> {
  const { data, error } = await admin
    .from("whatsapp_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[whatsapp] No se pudo leer whatsapp_settings:", error.message);
  }

  const settings = (data as Record<string, unknown> | null) ?? null;
  return {
    enabled: !(settings && settings.whatsapp_enabled === false),
    settings,
  };
}

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function insertLog(
  to: string,
  templateName: string,
  parameters: string[],
  opts: WhatsAppSendOptions,
): Promise<string | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from("whatsapp_message_log")
      .insert({
        direction: "outbound",
        event: opts.event ?? null,
        template_name: templateName,
        recipient_phone: to,
        parameters,
        status: "queued",
        triggered_by: opts.triggeredBy ?? null,
        context: opts.context ?? {},
      })
      .select("id")
      .single();
    if (error) {
      console.warn("[whatsapp] insertLog failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.warn("[whatsapp] insertLog exception:", e);
    return null;
  }
}

async function updateLog(
  id: string | null,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!id) return;
  const admin = getAdminClient();
  if (!admin) return;
  try {
    await admin.from("whatsapp_message_log").update(patch).eq("id", id);
  } catch (e) {
    console.warn("[whatsapp] updateLog exception:", e);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  parameters: string[],
  options: WhatsAppSendOptions = {},
  buttonUrlParam?: string,
): Promise<WhatsAppSendResult> {
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const token = Deno.env.get("WHATSAPP_TOKEN");

  // Validar teléfono (puede venir ya normalizado, pero re-validamos)
  const normalized = normalizeChileanPhone(to);
  const recipient = normalized.ok ? normalized.phone : to;

  const logId = await insertLog(recipient, templateName, parameters, options);

  if (!normalized.ok) {
    await updateLog(logId, {
      status: "failed",
      error_code: "INVALID_PHONE",
      error_message: normalized.reason,
    });
    return {
      success: false,
      logId: logId ?? undefined,
      error: { code: "INVALID_PHONE", message: normalized.reason ?? "Teléfono inválido" },
    };
  }

  if (!phoneNumberId || !token) {
    await updateLog(logId, {
      status: "failed",
      error_code: "MISSING_WHATSAPP_SECRETS",
      error_message: "Faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_TOKEN",
    });
    return {
      success: false,
      logId: logId ?? undefined,
      error: {
        code: "MISSING_WHATSAPP_SECRETS",
        message: "Faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_TOKEN",
      },
    };
  }

  const components: Record<string, unknown>[] = [
    {
      type: "body",
      parameters: parameters.map((text) => ({ type: "text", text })),
    },
  ];

  if (buttonUrlParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: buttonUrlParam }],
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    to: recipient,
    type: "template",
    template: {
      name: templateName,
      language: { code: "es_CL" },
      components,
    },
  };

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  const delays = [250, 750, 2000];
  let attempt = 0;
  let lastErrorBody: unknown = null;
  let lastStatus = 0;

  while (attempt < delays.length) {
    attempt += 1;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      lastStatus = response.status;
      lastErrorBody = data;

      if (response.ok) {
        const messageId = (data as any)?.messages?.[0]?.id ?? null;
        await updateLog(logId, {
          status: "sent",
          provider_message_id: messageId,
          attempts: attempt,
          error_code: null,
          error_message: null,
        });
        console.log("WhatsApp enviado:", { to: recipient, templateName, messageId, attempt });
        return {
          success: true,
          messageId: messageId ?? undefined,
          logId: logId ?? undefined,
          attempts: attempt,
        };
      }

      if (!isRetryableStatus(response.status) || attempt >= delays.length) break;
    } catch (e) {
      lastErrorBody = { message: e instanceof Error ? e.message : String(e) };
      if (attempt >= delays.length) break;
    }
    await sleep(delays[attempt - 1]);
  }

  const metaError = (lastErrorBody as any)?.error ?? lastErrorBody;
  const errorCode = String(metaError?.code ?? lastStatus ?? "UNKNOWN");
  const errorMessage =
    metaError?.message ??
    metaError?.error_user_msg ??
    `Meta API respondió ${lastStatus || "sin status"}`;

  await updateLog(logId, {
    status: "failed",
    attempts: attempt,
    error_code: errorCode,
    error_message: String(errorMessage).slice(0, 1000),
  });

  return {
    success: false,
    attempts: attempt,
    logId: logId ?? undefined,
    error: { code: errorCode, message: String(errorMessage), details: lastErrorBody },
  };
}

/**
 * Sube un PDF a Meta y lo envía como header DOCUMENT de una plantilla aprobada.
 * Se mantiene separado del envío legacy para poder habilitarlo con un guard
 * sin arriesgar las notificaciones mientras Meta termina la aprobación.
 */
export async function sendWhatsAppDocumentTemplate(
  to: string,
  templateName: string,
  parameters: string[],
  pdfUrl: string,
  filename: string,
  options: WhatsAppSendOptions = {},
): Promise<WhatsAppSendResult> {
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const normalized = normalizeChileanPhone(to);
  const recipient = normalized.ok ? normalized.phone : to;
  const logId = await insertLog(recipient, templateName, parameters, {
    ...options,
    context: { ...(options.context ?? {}), attachment: "document" },
  });

  if (!normalized.ok) {
    await updateLog(logId, { status: "failed", error_code: "INVALID_PHONE", error_message: normalized.reason });
    return { success: false, logId: logId ?? undefined, error: { code: "INVALID_PHONE", message: normalized.reason ?? "Teléfono inválido" } };
  }
  if (!phoneNumberId || !token) {
    await updateLog(logId, { status: "failed", error_code: "MISSING_WHATSAPP_SECRETS", error_message: "Faltan credenciales de WhatsApp" });
    return { success: false, logId: logId ?? undefined, error: { code: "MISSING_WHATSAPP_SECRETS", message: "Faltan credenciales de WhatsApp" } };
  }

  try {
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) throw new Error(`No se pudo descargar el PDF (${pdfResponse.status})`);
    const pdfBlob = await pdfResponse.blob();
    const mediaForm = new FormData();
    mediaForm.append("messaging_product", "whatsapp");
    mediaForm.append("type", "application/pdf");
    mediaForm.append("file", pdfBlob, filename);

    const mediaResponse = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: mediaForm,
    });
    const mediaData = await mediaResponse.json().catch(() => ({}));
    if (!mediaResponse.ok || !(mediaData as any)?.id) {
      throw new Error((mediaData as any)?.error?.message ?? `Meta rechazó el PDF (${mediaResponse.status})`);
    }

    const messageResponse = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name: templateName,
          language: { code: "es_CL" },
          components: [
            { type: "header", parameters: [{ type: "document", document: { id: (mediaData as any).id, filename } }] },
            { type: "body", parameters: parameters.map((text) => ({ type: "text", text })) },
          ],
        },
      }),
    });
    const messageData = await messageResponse.json().catch(() => ({}));
    if (!messageResponse.ok) {
      throw new Error((messageData as any)?.error?.message ?? `Meta rechazó el mensaje (${messageResponse.status})`);
    }

    const messageId = (messageData as any)?.messages?.[0]?.id ?? null;
    await updateLog(logId, { status: "sent", provider_message_id: messageId, attempts: 1, error_code: null, error_message: null });
    return { success: true, messageId: messageId ?? undefined, logId: logId ?? undefined, attempts: 1 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateLog(logId, { status: "failed", attempts: 1, error_code: "DOCUMENT_SEND_FAILED", error_message: message.slice(0, 1000) });
    return { success: false, logId: logId ?? undefined, attempts: 1, error: { code: "DOCUMENT_SEND_FAILED", message } };
  }
}

export interface BulkSendOutcome {
  notified: number;
  failed: Array<{ phone: string; error: WhatsAppSendResult["error"] }>;
  results: WhatsAppSendResult[];
}

/**
 * Envía la misma plantilla a varios destinatarios sin abortar al primer fallo.
 */
export async function sendWhatsAppTemplateBulk(
  recipients: string[],
  templateName: string,
  parameters: string[],
  options: WhatsAppSendOptions = {},
): Promise<BulkSendOutcome> {
  const settled = await Promise.allSettled(
    recipients.map((n) => sendWhatsAppTemplate(n, templateName, parameters, options)),
  );

  const results: WhatsAppSendResult[] = settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : {
          success: false,
          error: {
            code: "EXCEPTION",
            message: s.reason instanceof Error ? s.reason.message : String(s.reason),
          },
        },
  );

  const failed = results
    .map((r, i) => ({ r, phone: recipients[i] }))
    .filter(({ r }) => !r.success)
    .map(({ r, phone }) => ({ phone, error: r.error }));

  return {
    notified: results.filter((r) => r.success).length,
    failed,
    results,
  };
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getWhatsAppGate, sendWhatsAppTemplateBulk, normalizeChileanPhone } from "../_shared/whatsapp.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const corsHdrs = (req: Request) => ({
  ...getCorsHeaders(req),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const TZ = "America/Santiago";

// Kill switch de las alertas de documentos (admin_doc_op_* / admin_doc_grua_*).
// Las 4 plantillas fueron aprobadas por Meta el 2026-06-10 (es_CL, Utilidad,
// "calidad pendiente"). Poner en false y redesplegar si Meta degrada alguna.
const DOC_ALERTS_ENABLED = true;
// Alerta de servicios en riesgo. Requiere plantilla
// admin_servicio_recurso_no_apto aprobada por Meta. Activar tras aprobación.
const SERVICE_RISK_ALERTS_ENABLED = false;

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}
function addDaysISO(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function fmtCLP(n: number): string {
  try {
    return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString("es-CL")}`;
  }
}
function fmtDateDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}
function daysBetween(fromISO: string, toISO: string): number {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(fromISO);
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(toISO);
  if (!a || !b) return 0;
  const da = Date.UTC(+a[1], +a[2] - 1, +a[3]);
  const db = Date.UTC(+b[1], +b[2] - 1, +b[3]);
  return Math.floor((db - da) / 86400000);
}
function isMondayInTZ(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 1;
}
/**
 * Escalera de intensidad según urgencia.
 * Casos mentales validados:
 * - daysUntil=20 y hoy no-lunes -> skip
 * - daysUntil=10 -> envia
 * - daysUntil=3 -> envia
 * - daysUntil=-5 -> envia diario
 */
function cadenceAllows(daysUntil: number, todayISO: string): boolean {
  if (daysUntil <= 7) return true;
  if (daysUntil <= 15) return daysUntil % 2 === 0;
  return isMondayInTZ(todayISO);
}

async function getAdminPhones(supabase: any, settings: any): Promise<string[]> {
  const raw = [
    settings?.admin_phone_1 || Deno.env.get("ADMIN_WHATSAPP_1"),
    settings?.admin_phone_2 || Deno.env.get("ADMIN_WHATSAPP_2"),
  ].filter(Boolean) as string[];
  return raw.map((p) => normalizeChileanPhone(p)).filter((n) => n.ok).map((n) => n.phone);
}

async function shouldRun(supabase: any, alertKey: string, dateISO: string, context: any): Promise<boolean> {
  const { error } = await supabase
    .from("whatsapp_alert_dedupe")
    .insert({ alert_key: alertKey, sent_for_date: dateISO, context });
  if (error) {
    // unique violation = ya enviado hoy
    if ((error as any).code === "23505") return false;
    console.warn("[wa-daily-alerts] dedupe insert error:", error.message);
    return false;
  }
  return true;
}

async function getAcknowledgedAlertMap(
  supabase: any,
  candidates: Array<{ alertKey: string; docExpiryDate: string | null | undefined }>,
) {
  const validCandidates = candidates.filter((candidate) => candidate.alertKey && candidate.docExpiryDate);
  const uniqueAlertKeys = [...new Set(validCandidates.map((candidate) => candidate.alertKey))];

  if (uniqueAlertKeys.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await supabase
    .from("alert_acknowledgements")
    .select("alert_key, doc_expiry_date")
    .in("alert_key", uniqueAlertKeys);

  if (error) {
    console.warn("[wa-daily-alerts] acknowledgement lookup error:", error.message);
    return new Set<string>();
  }

  return new Set(
    ((data ?? []) as Array<{ alert_key: string; doc_expiry_date: string }>)
      .map((row) => `${row.alert_key}::${row.doc_expiry_date}`),
  );
}

function isAcknowledgedForCurrentExpiry(
  acknowledgedSet: Set<string>,
  alertKey: string,
  docExpiryDate: string | null | undefined,
) {
  if (!docExpiryDate) return false;
  return acknowledgedSet.has(`${alertKey}::${docExpiryDate}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHdrs(req) });

  // Authentication: CRON_SECRET header o JWT admin
  const cronSecret = Deno.env.get("CRON_SECRET");
  const headerSecret = req.headers.get("x-cron-secret");
  const forceSend = (await req.clone().json().catch(() => ({})))?.force === true;
  let authenticated = !!(cronSecret && headerSecret && cronSecret === headerSecret);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  if (!authenticated) {
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const { data: { user } } = await supabase.auth.getUser(auth.slice(7));
      if (user) {
        const { data: roles } = await supabase
          .from("user_roles").select("role").eq("user_id", user.id);
        if (roles?.some((r: any) => r.role === "admin")) authenticated = true;
      }
    }
  }

  if (!authenticated) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHdrs(req), "Content-Type": "application/json" },
    });
  }

  // Master switch (helper compartido: única fuente de verdad)
  const gate = await getWhatsAppGate(supabase);
  const settings = gate.settings;

  if (!gate.enabled) {
    console.log("[whatsapp-daily-alerts] Master switch OFF — alertas omitidas");
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "whatsapp_disabled" }), {
      status: 200, headers: { ...corsHdrs(req), "Content-Type": "application/json" },
    });
  }

  const phones = await getAdminPhones(supabase, settings);
  if (phones.length === 0) {
    return new Response(JSON.stringify({ ok: false, reason: "No hay teléfonos admin configurados" }), {
      status: 200, headers: { ...corsHdrs(req), "Content-Type": "application/json" },
    });
  }

  const todayISO = today();
  const tomorrowISO = addDaysISO(todayISO, 1);
  const results: Record<string, unknown> = {};
  const activeUpcomingServiceStatuses = [
    "pending",
    "scheduled", // compatibilidad legacy si existen registros textuales antiguos
    "quoted",
    "purchase_order_pending",
    "with_purchase_order",
  ];

  // ── 1. Facturas vencidas (notify_invoice_overdue)
  if (settings?.notify_invoice_overdue) {
    const { data: overdue } = await supabase
      .from("invoices")
      .select("id, folio, total, paid_amount, due_date, client:clients(name)")
      .lt("due_date", todayISO)
      .neq("status", "paid")
      .neq("status", "cancelled")
      .order("due_date", { ascending: true })
      .limit(20);

    const overdueList = (overdue ?? []).filter((inv: any) => {
      const remaining = Number(inv.total ?? 0) - Number(inv.paid_amount ?? 0);
      return remaining > 0;
    });

    const sent: any[] = [];
    for (const inv of overdueList) {
      const dedupeKey = `invoice_overdue:${inv.id}`;
      const ok = forceSend || await shouldRun(supabase, dedupeKey, todayISO, { invoiceId: inv.id });
      if (!ok) continue;

      const remaining = Number(inv.total ?? 0) - Number(inv.paid_amount ?? 0);
      const params = [
        (inv.client?.name as string) || "Cliente",
        String(inv.folio ?? ""),
        fmtCLP(remaining),
        String(daysBetween(inv.due_date, todayISO)),
      ];
      const outcome = await sendWhatsAppTemplateBulk(phones, "admin_pago_pendiente", params, {
        event: "pago_pendiente",
        context: { invoiceId: inv.id, folio: inv.folio },
      });
      sent.push({ folio: inv.folio, notified: outcome.notified, failed: outcome.failed.length });
    }
    results.overdue = { total: overdueList.length, dispatched: sent.length, detail: sent };
  }

  // ── 2. Servicios programados sin operador (notify_service_no_operator)
  if (settings?.notify_service_no_operator) {
    const { data: noOp } = await supabase
      .from("services")
      .select("id, folio, service_date, client:clients(name)")
      .gte("service_date", todayISO)
      .lte("service_date", tomorrowISO)
      .is("operator_id", null)
      .in("status", ["pending", "scheduled"])
      .limit(10);

    const list = (noOp ?? []) as any[];
    const dispatched: any[] = [];
    for (const svc of list) {
      const dedupeKey = `service_no_operator:${svc.id}`;
      const ok = forceSend || await shouldRun(supabase, dedupeKey, todayISO, { serviceId: svc.id });
      if (!ok) continue;
      const outcome = await sendWhatsAppTemplateBulk(
        phones,
        "admin_servicio_sin_operador",
        [String(svc.folio ?? ""), (svc.client?.name as string) || "—", fmtDateDisplay(svc.service_date)],
        { event: "servicio_sin_operador", context: { serviceId: svc.id } },
      );
      dispatched.push({ folio: svc.folio, notified: outcome.notified });
    }
    results.no_operator = { total: list.length, dispatched: dispatched.length, detail: dispatched };
  }

  // ── 3. Resumen diario (notify_daily_reminder)
  if (settings?.notify_daily_reminder) {
    const dedupeKey = "daily_reminder";
    const ok = forceSend || await shouldRun(supabase, dedupeKey, todayISO, {});
    if (ok) {
      const { count: scheduledToday } = await supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("service_date", todayISO);
      const { count: pendingInvoices } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .neq("status", "paid")
        .neq("status", "cancelled");

      const outcome = await sendWhatsAppTemplateBulk(
        phones,
        "admin_resumen_diario",
        [fmtDateDisplay(todayISO), String(scheduledToday ?? 0), String(pendingInvoices ?? 0)],
        { event: "resumen_diario", context: { date: todayISO } },
      );
      results.daily_reminder = { notified: outcome.notified, failed: outcome.failed };
    } else {
      results.daily_reminder = { skipped: true };
    }
  }

  // ── 4. Documentos de operadores por vencer / vencidos (notify_operator_document_expiry)
  if (DOC_ALERTS_ENABLED && (settings as any)?.notify_operator_document_expiry !== false) {
    const in30ISO = addDaysISO(todayISO, 30);

    const OPERATOR_DOC_LABELS: Record<string, string> = {
      cedula_identidad: "Cédula de Identidad",
      licencia_conducir: "Licencia de Conducir",
      examen_psicosensotecnico: "Examen Psicosensotécnico",
      examen_altura: "Examen de Altura",
      seguro_vida: "Seguro de Vida",
      contrato_trabajo: "Contrato de Trabajo",
    };

    // Documentos por vencer (hoy…+30 días)
    const { data: expiring } = await supabase
      .from("operator_documents")
      .select("id, operator_id, document_type, expiry_date, operator:operators(name)")
      .gte("expiry_date", todayISO)
      .lte("expiry_date", in30ISO)
      .order("expiry_date", { ascending: true });

    // Documentos ya vencidos
    const { data: expired } = await supabase
      .from("operator_documents")
      .select("id, operator_id, document_type, expiry_date, operator:operators(name)")
      .lt("expiry_date", todayISO)
      .order("expiry_date", { ascending: false })
      .limit(20);

    const expiringList = (expiring ?? []) as any[];
    const expiredList = (expired ?? []) as any[];
    const sentExpiring: any[] = [];
    const sentExpired: any[] = [];
    let cadenceSkippedExpiring = 0;
    let cadenceSkippedExpired = 0;
    let ackSilencedExpiring = 0;
    let ackSilencedExpired = 0;
    const acknowledgedOperatorAlerts = await getAcknowledgedAlertMap(supabase, [
      ...expiringList.map((doc) => ({ alertKey: `operator_doc_expiry:${doc.id}`, docExpiryDate: doc.expiry_date })),
      ...expiredList.map((doc) => ({ alertKey: `operator_doc_vencido:${doc.id}`, docExpiryDate: doc.expiry_date })),
    ]);

    for (const doc of expiringList) {
      const days = daysBetween(todayISO, doc.expiry_date);
      if (!forceSend && !cadenceAllows(days, todayISO)) {
        cadenceSkippedExpiring += 1;
        continue;
      }

      const dedupeKey = `operator_doc_expiry:${doc.id}`;
      if (isAcknowledgedForCurrentExpiry(acknowledgedOperatorAlerts, dedupeKey, doc.expiry_date)) {
        ackSilencedExpiring += 1;
        continue;
      }
      const ok = forceSend || await shouldRun(supabase, dedupeKey, todayISO, { docId: doc.id });
      if (!ok) continue;

      const docLabel = OPERATOR_DOC_LABELS[doc.document_type] ?? doc.document_type;
      const operatorName = (doc.operator as any)?.name ?? "Operador";

      const outcome = await sendWhatsAppTemplateBulk(
        phones,
        "admin_doc_op_vencimiento",
        [operatorName, docLabel, fmtDateDisplay(doc.expiry_date), String(days)],
        { event: "operador_doc_vencimiento", context: { docId: doc.id, operatorId: doc.operator_id } },
      );
      sentExpiring.push({ operatorName, docLabel, days, notified: outcome.notified });
    }

    for (const doc of expiredList) {
      const daysExpired = daysBetween(doc.expiry_date, todayISO);
      const daysUntil = -daysExpired;
      if (!forceSend && !cadenceAllows(daysUntil, todayISO)) {
        cadenceSkippedExpired += 1;
        continue;
      }

      const dedupeKey = `operator_doc_vencido:${doc.id}`;
      if (isAcknowledgedForCurrentExpiry(acknowledgedOperatorAlerts, dedupeKey, doc.expiry_date)) {
        ackSilencedExpired += 1;
        continue;
      }
      const ok = forceSend || await shouldRun(supabase, dedupeKey, todayISO, { docId: doc.id });
      if (!ok) continue;

      const docLabel = OPERATOR_DOC_LABELS[doc.document_type] ?? doc.document_type;
      const operatorName = (doc.operator as any)?.name ?? "Operador";

      const outcome = await sendWhatsAppTemplateBulk(
        phones,
        "admin_doc_op_vencido",
        [operatorName, docLabel, fmtDateDisplay(doc.expiry_date), String(daysExpired)],
        { event: "operador_doc_vencido", context: { docId: doc.id, operatorId: doc.operator_id } },
      );
      sentExpired.push({ operatorName, docLabel, daysExpired, notified: outcome.notified });
    }

    results.operator_doc_expiry = {
      expiring: {
        total: expiringList.length,
        cadenceSkipped: cadenceSkippedExpiring,
        ackSilenced: ackSilencedExpiring,
        dispatched: sentExpiring.length,
        detail: sentExpiring,
      },
      expired: {
        total: expiredList.length,
        cadenceSkipped: cadenceSkippedExpired,
        ackSilenced: ackSilencedExpired,
        dispatched: sentExpired.length,
        detail: sentExpired,
      },
    };
  }

  // ── 5. Documentos de grúas por vencer / vencidos (notify_operator_document_expiry)
  if (DOC_ALERTS_ENABLED && (settings as any)?.notify_operator_document_expiry !== false) {
    const in30ISO = addDaysISO(todayISO, 30);

    const CRANE_DOC_LABELS: Record<string, string> = {
      technical_review: "Revisión Técnica",
      insurance: "Seguro",
      circulation_permit: "Permiso Circulación",
    };

    const { data: craneExpiring } = await supabase
      .from("crane_documents")
      .select("id, crane_id, document_type, expiry_date, crane:cranes(license_plate, status)")
      .gte("expiry_date", todayISO)
      .lte("expiry_date", in30ISO)
      .order("expiry_date", { ascending: true });

    const { data: craneExpired } = await supabase
      .from("crane_documents")
      .select("id, crane_id, document_type, expiry_date, crane:cranes(license_plate, status)")
      .lt("expiry_date", todayISO)
      .order("expiry_date", { ascending: false })
      .limit(20);

    const craneExpiringList = (craneExpiring ?? []) as any[];
    const craneExpiredList = (craneExpired ?? []) as any[];
    const sentCraneExpiring: any[] = [];
    const sentCraneExpired: any[] = [];
    let cadenceSkippedCraneExpiring = 0;
    let cadenceSkippedCraneExpired = 0;
    let ackSilencedCraneExpiring = 0;
    let ackSilencedCraneExpired = 0;
    const acknowledgedCraneAlerts = await getAcknowledgedAlertMap(supabase, [
      ...craneExpiringList.map((doc) => ({ alertKey: `crane_doc_expiry:${doc.id}`, docExpiryDate: doc.expiry_date })),
      ...craneExpiredList.map((doc) => ({ alertKey: `crane_doc_vencido:${doc.id}`, docExpiryDate: doc.expiry_date })),
    ]);

    for (const doc of craneExpiringList) {
      if ((doc.crane as any)?.status !== 'active') continue;
      const days = daysBetween(todayISO, doc.expiry_date);
      if (!forceSend && !cadenceAllows(days, todayISO)) {
        cadenceSkippedCraneExpiring += 1;
        continue;
      }

      const dedupeKey = `crane_doc_expiry:${doc.id}`;
      if (isAcknowledgedForCurrentExpiry(acknowledgedCraneAlerts, dedupeKey, doc.expiry_date)) {
        ackSilencedCraneExpiring += 1;
        continue;
      }
      const ok = forceSend || await shouldRun(supabase, dedupeKey, todayISO, { docId: doc.id });
      if (!ok) continue;

      const docLabel = CRANE_DOC_LABELS[doc.document_type] ?? doc.document_type;
      const craneName = (doc.crane as any)?.license_plate ?? "Equipo";

      const outcome = await sendWhatsAppTemplateBulk(
        phones,
        "admin_doc_grua_vencimiento",
        [craneName, docLabel, fmtDateDisplay(doc.expiry_date), String(days)],
        { event: "grua_doc_vencimiento", context: { docId: doc.id, craneId: doc.crane_id } },
      );
      sentCraneExpiring.push({ craneName, docLabel, days, notified: outcome.notified });
    }

    for (const doc of craneExpiredList) {
      if ((doc.crane as any)?.status !== 'active') continue;
      const daysExpired = daysBetween(doc.expiry_date, todayISO);
      const daysUntil = -daysExpired;
      if (!forceSend && !cadenceAllows(daysUntil, todayISO)) {
        cadenceSkippedCraneExpired += 1;
        continue;
      }

      const dedupeKey = `crane_doc_vencido:${doc.id}`;
      if (isAcknowledgedForCurrentExpiry(acknowledgedCraneAlerts, dedupeKey, doc.expiry_date)) {
        ackSilencedCraneExpired += 1;
        continue;
      }
      const ok = forceSend || await shouldRun(supabase, dedupeKey, todayISO, { docId: doc.id });
      if (!ok) continue;

      const docLabel = CRANE_DOC_LABELS[doc.document_type] ?? doc.document_type;
      const craneName = (doc.crane as any)?.license_plate ?? "Equipo";

      const outcome = await sendWhatsAppTemplateBulk(
        phones,
        "admin_doc_grua_vencido",
        [craneName, docLabel, fmtDateDisplay(doc.expiry_date), String(daysExpired)],
        { event: "grua_doc_vencido", context: { docId: doc.id, craneId: doc.crane_id } },
      );
      sentCraneExpired.push({ craneName, docLabel, daysExpired, notified: outcome.notified });
    }

    results.crane_doc_expiry = {
      expiring: {
        total: craneExpiringList.length,
        cadenceSkipped: cadenceSkippedCraneExpiring,
        ackSilenced: ackSilencedCraneExpiring,
        dispatched: sentCraneExpiring.length,
        detail: sentCraneExpiring,
      },
      expired: {
        total: craneExpiredList.length,
        cadenceSkipped: cadenceSkippedCraneExpired,
        ackSilenced: ackSilencedCraneExpired,
        dispatched: sentCraneExpired.length,
        detail: sentCraneExpired,
      },
    };
  }

  // ── 6. Servicios próximos en riesgo por recursos no aptos
  if (!SERVICE_RISK_ALERTS_ENABLED) {
    results.service_resource_risk = { skipped: true, reason: "kill_switch_off" };
  } else if ((settings as any)?.notify_service_resource_risk === false) {
    results.service_resource_risk = { skipped: true, reason: "setting_disabled" };
  } else {
    const { data: upcomingServices } = await supabase
      .from("services")
      .select("id, folio, service_date, crane_id, operator_id, client:clients(name)")
      .gte("service_date", todayISO)
      .lte("service_date", addDaysISO(todayISO, 7))
      .in("status", activeUpcomingServiceStatuses)
      .limit(30);

    const services = (upcomingServices ?? []) as any[];
    const serviceIds = services.map((svc) => svc.id).filter(Boolean);
    const operatorIdsByServiceId = new Map<string, string[]>();

    if (serviceIds.length > 0) {
      const { data: serviceResources } = await supabase
        .from("service_resources")
        .select("service_id, operator_id, resource_type")
        .in("service_id", serviceIds)
        .eq("resource_type", "operator");

      for (const resource of (serviceResources ?? []) as any[]) {
        if (!resource.service_id || !resource.operator_id) continue;
        const existing = operatorIdsByServiceId.get(resource.service_id) ?? [];
        existing.push(resource.operator_id);
        operatorIdsByServiceId.set(resource.service_id, existing);
      }
    }

    let issuesCount = 0;
    let dispatchedCount = 0;

    for (const svc of services) {
      const operatorIds = [
        ...new Set([
          ...(svc.operator_id ? [svc.operator_id] : []),
          ...(operatorIdsByServiceId.get(svc.id) ?? []),
        ]),
      ];

      if (!svc.crane_id && operatorIds.length === 0) continue;

      const { data: issues, error: issuesError } = await supabase.rpc("get_resource_compliance", {
        p_crane_id: svc.crane_id,
        p_operator_ids: operatorIds.length > 0 ? operatorIds : null,
        p_service_date: svc.service_date,
      });

      if (issuesError) {
        console.warn("[wa-daily-alerts] service risk compliance rpc error:", issuesError.message, { serviceId: svc.id });
        continue;
      }

      const blockingIssues = ((issues ?? []) as any[]).filter((issue) => issue.level === "error");
      issuesCount += blockingIssues.length;

      for (const issue of blockingIssues) {
        const dedupeKey = `service_resource_risk:${svc.id}:${issue.resource_id}:${issue.item}`;
        const ok = forceSend || await shouldRun(supabase, dedupeKey, todayISO, {
          serviceId: svc.id,
          resourceId: issue.resource_id,
          item: issue.item,
        });
        if (!ok) continue;

        const outcome = await sendWhatsAppTemplateBulk(
          phones,
          "admin_servicio_recurso_no_apto",
          [
            String(svc.folio ?? ""),
            fmtDateDisplay(svc.service_date),
            issue.resource_type === "crane"
              ? `Grúa ${issue.resource_name}`
              : `Operador ${issue.resource_name}`,
            issue.item_label,
            issue.expiry_date ? fmtDateDisplay(issue.expiry_date) : fmtDateDisplay(svc.service_date),
          ],
          {
            event: "servicio_recurso_no_apto",
            context: { serviceId: svc.id, resourceId: issue.resource_id, item: issue.item },
          },
        );

        if (outcome.notified > 0) {
          dispatchedCount += 1;
        }
      }
    }

    results.service_resource_risk = {
      services: services.length,
      issues: issuesCount,
      dispatched: dispatchedCount,
    };
  }

  return new Response(JSON.stringify({ ok: true, date: todayISO, ...results }), {
    status: 200, headers: { ...corsHdrs(req), "Content-Type": "application/json" },
  });
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppTemplateBulk, normalizeChileanPhone } from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TZ = "America/Santiago";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: settings } = await supabase
    .from("whatsapp_settings").select("*").limit(1).maybeSingle();

  const phones = await getAdminPhones(supabase, settings);
  if (phones.length === 0) {
    return new Response(JSON.stringify({ ok: false, reason: "No hay teléfonos admin configurados" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const todayISO = today();
  const tomorrowISO = addDaysISO(todayISO, 1);
  const results: Record<string, unknown> = {};

  // ── 1. Facturas vencidas (notify_invoice_overdue)
  if (settings?.notify_invoice_overdue) {
    const { data: overdue } = await supabase
      .from("invoices")
      .select("id, folio, total, amount_paid, due_date, client:clients(name)")
      .lt("due_date", todayISO)
      .neq("status", "paid")
      .neq("status", "cancelled")
      .order("due_date", { ascending: true })
      .limit(20);

    const overdueList = (overdue ?? []).filter((inv: any) => {
      const remaining = Number(inv.total ?? 0) - Number(inv.amount_paid ?? 0);
      return remaining > 0;
    });

    const sent: any[] = [];
    for (const inv of overdueList) {
      const dedupeKey = `invoice_overdue:${inv.id}`;
      const ok = forceSend || await shouldRun(supabase, dedupeKey, todayISO, { invoiceId: inv.id });
      if (!ok) continue;

      const remaining = Number(inv.total ?? 0) - Number(inv.amount_paid ?? 0);
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

  return new Response(JSON.stringify({ ok: true, date: todayISO, ...results }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

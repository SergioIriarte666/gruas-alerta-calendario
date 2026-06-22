import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { getCorsHeaders } from "../_shared/cors.ts";

const DEFAULT_TZ = "America/Santiago";
const BUCKET = "backups-auto";
const FROM_ADDRESS = "Grúas 5 Norte <facturacion@gruas5norte.cl>";

const getHourInTZ = (tz: string): number =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date()));

const getDateInTZ = (tz: string): string =>
  new Date().toLocaleDateString("en-CA", { timeZone: tz });

const formatBytes = (b?: number | null): string => {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0; let n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(2)} ${u[i]}`;
};

/** Genera dump JSON simple: snapshot de tablas críticas */
async function generateJsonBackup(supabase: any): Promise<{ content: string; size: number }> {
  const tables = [
    "services", "service_resources", "costs", "operators", "cost_categories",
    "clients", "cranes", "service_types", "profiles", "inventory_items",
    "inventory_stock", "supplier_invoices", "supplier_payments", "invoices",
    "company_data", "system_settings",
  ];
  const snapshot: Record<string, any> = {
    generated_at: new Date().toISOString(),
    tables: {},
  };
  let total = 0;
  for (const t of tables) {
    try {
      const { data, error } = await supabase.from(t).select("*").limit(50000);
      if (error) { snapshot.tables[t] = { error: error.message }; continue; }
      snapshot.tables[t] = { count: data?.length ?? 0, rows: data ?? [] };
      total += data?.length ?? 0;
    } catch (e: any) {
      snapshot.tables[t] = { error: e?.message || String(e) };
    }
  }
  snapshot.total_records = total;
  const content = JSON.stringify(snapshot, null, 2);
  return { content, size: new TextEncoder().encode(content).length };
}

/** Genera dump SQL simple con INSERTs */
async function generateSqlBackup(supabase: any): Promise<{ content: string; size: number }> {
  const tables = [
    "services", "service_resources", "costs", "operators", "cost_categories",
    "clients", "cranes", "service_types", "profiles", "inventory_items",
    "inventory_stock", "supplier_invoices", "supplier_payments", "invoices",
    "company_data", "system_settings",
  ];
  const ts = new Date().toISOString();
  let sql = `-- SQL Dump TMS Grúas - ${ts}\n-- Tablas: ${tables.join(", ")}\n\n`;
  let total = 0;
  for (const t of tables) {
    try {
      const { data, error } = await supabase.from(t).select("*").limit(50000);
      if (error) { sql += `-- ERROR ${t}: ${error.message}\n\n`; continue; }
      if (!data || data.length === 0) { sql += `-- Tabla ${t} vacía\n\n`; continue; }
      sql += `-- Datos: ${t} (${data.length} registros)\n`;
      const cols = Object.keys(data[0]);
      const colList = cols.map((c) => `"${c}"`).join(", ");
      for (const row of data) {
        const vals = cols.map((c) => {
          const v = row[c];
          if (v === null || v === undefined) return "NULL";
          if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
          if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
          if (typeof v === "boolean") return v ? "true" : "false";
          return String(v);
        }).join(", ");
        sql += `INSERT INTO public."${t}" (${colList}) VALUES (${vals});\n`;
      }
      sql += "\n";
      total += data.length;
    } catch (e: any) {
      sql += `-- ERROR ${t}: ${e?.message || e}\n\n`;
    }
  }
  sql += `-- Total: ${total} registros\n-- Fin: ${new Date().toISOString()}\n`;
  return { content: sql, size: new TextEncoder().encode(sql).length };
}

function buildEmailHtml(opts: {
  dateStr: string;
  sqlUrl: string;
  jsonUrl: string;
  sqlSize: string;
  jsonSize: string;
  expiresDays: number;
}): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Respaldo TMS Grúas</title></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);padding:28px 32px;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Respaldo TMS Grúas 5 Norte</h1>
        <p style="margin:6px 0 0;color:#ede9fe;font-size:14px;">Generado el ${opts.dateStr}</p>
      </div>
      <div style="padding:28px 32px;">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
          Tu respaldo diario se generó correctamente. Descarga los archivos desde los siguientes enlaces:
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;">
          <tr>
            <td style="padding:14px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;margin-bottom:10px;">
              <div style="font-size:13px;color:#6b21a8;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Dump SQL · ${opts.sqlSize}</div>
              <div style="font-size:12px;color:#6b7280;margin:4px 0 12px;">Restauración completa de la base de datos</div>
              <a href="${opts.sqlUrl}" style="display:inline-block;background:#8b5cf6;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;font-size:14px;">Descargar SQL</a>
            </td>
          </tr>
          <tr><td style="height:12px;"></td></tr>
          <tr>
            <td style="padding:14px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;">
              <div style="font-size:13px;color:#6b21a8;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Export JSON · ${opts.jsonSize}</div>
              <div style="font-size:12px;color:#6b7280;margin:4px 0 12px;">Snapshot para análisis y auditoría</div>
              <a href="${opts.jsonUrl}" style="display:inline-block;background:#ffffff;color:#8b5cf6;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;font-size:14px;border:1.5px solid #8b5cf6;">Descargar JSON</a>
            </td>
          </tr>
        </table>
        <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 14px;margin:20px 0;">
          <p style="margin:0;font-size:13px;color:#92400e;">
            <strong>Importante:</strong> Estos enlaces expiran en <strong>${opts.expiresDays} días</strong>. Descarga y guarda los archivos en una ubicación segura (Drive, disco externo).
          </p>
        </div>
        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:16px;">
          Este es un correo automático del sistema de respaldos. Si no deseas recibirlos, desactiva el envío diario desde Settings → Gestión de Respaldos.
        </p>
      </div>
    </div>
    <p style="text-align:center;margin:20px 0 0;font-size:11px;color:#9ca3af;">© Grúas 5 Norte · TMS</p>
  </div>
</body></html>`;
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req, "authorization, x-client-info, apikey, content-type, x-cron-secret");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  let generatedBackupMetadata: Record<string, unknown> | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const force: boolean = body?.force === true;

    // ── Auth ──
    const requestSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");
    let authenticated = false;
    let manualTrigger = false;

    if (requestSecret) {
      const { data: s } = await supabase
        .from("internal_scheduler_secrets")
        .select("value")
        .eq("key", "scheduled_backup_email_cron")
        .maybeSingle();
      if (s?.value && s.value === requestSecret) authenticated = true;
    }

    if (!authenticated && authHeader?.startsWith("Bearer ")) {
      const ua = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claims } = await ua.auth.getClaims(token);
      if (claims?.claims) { authenticated = true; manualTrigger = true; }
    }

    if (!authenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Configuración ──
    const { data: config, error: cfgErr } = await supabase
      .from("backup_email_config").select("*").limit(1).maybeSingle();
    if (cfgErr || !config) throw new Error("No se encontró backup_email_config");

    if (!config.enabled && !force) {
      return new Response(JSON.stringify({ skipped: true, reason: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validar hora (solo si es cron automático) ──
    if (!manualTrigger && !force) {
      const tz = DEFAULT_TZ;
      const currentHour = getHourInTZ(tz);
      if (currentHour !== config.schedule_hour) {
        return new Response(JSON.stringify({
          skipped: true, reason: "outside_hour", currentHour, configHour: config.schedule_hour,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Evitar doble envío en el mismo día
      if (config.last_sent_at) {
        const last = new Date(config.last_sent_at).toLocaleDateString("en-CA", { timeZone: tz });
        const today = getDateInTZ(tz);
        if (last === today && config.last_status === "success") {
          return new Response(JSON.stringify({ skipped: true, reason: "already_sent_today" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const recipient = (config.recipient_email || "").trim();
    if (!recipient) throw new Error("Sin correo destinatario configurado");

    const expiresDays = config.signed_url_days || 7;
    const dateKey = getDateInTZ(DEFAULT_TZ);
    const dateDisplay = new Date().toLocaleDateString("es-CL", {
      timeZone: DEFAULT_TZ, day: "2-digit", month: "long", year: "numeric",
    });

    console.log("📦 Generando respaldos SQL y JSON...");
    const [sqlBackup, jsonBackup] = await Promise.all([
      generateSqlBackup(supabase),
      generateJsonBackup(supabase),
    ]);

    const sqlPath = `${dateKey}/tms-gruas-backup-${dateKey}.sql`;
    const jsonPath = `${dateKey}/tms-gruas-backup-${dateKey}.json`;

    console.log("⬆️  Subiendo a Storage...");
    const { error: sqlUpErr } = await supabase.storage.from(BUCKET).upload(
      sqlPath, new Blob([sqlBackup.content], { type: "application/sql" }),
      { upsert: true, contentType: "application/sql" },
    );
    if (sqlUpErr) throw new Error(`Upload SQL falló: ${sqlUpErr.message}`);

    const { error: jsonUpErr } = await supabase.storage.from(BUCKET).upload(
      jsonPath, new Blob([jsonBackup.content], { type: "application/json" }),
      { upsert: true, contentType: "application/json" },
    );
    if (jsonUpErr) throw new Error(`Upload JSON falló: ${jsonUpErr.message}`);

    const expiresSec = expiresDays * 86400;
    const { data: sqlSigned, error: sqlSigErr } = await supabase.storage.from(BUCKET)
      .createSignedUrl(sqlPath, expiresSec, { download: `tms-gruas-backup-${dateKey}.sql` });
    if (sqlSigErr || !sqlSigned?.signedUrl) throw new Error(`Signed URL SQL falló: ${sqlSigErr?.message}`);

    const { data: jsonSigned, error: jsonSigErr } = await supabase.storage.from(BUCKET)
      .createSignedUrl(jsonPath, expiresSec, { download: `tms-gruas-backup-${dateKey}.json` });
    if (jsonSigErr || !jsonSigned?.signedUrl) throw new Error(`Signed URL JSON falló: ${jsonSigErr?.message}`);

    generatedBackupMetadata = {
      source: "scheduled_email",
      recipient,
      sql_size: sqlBackup.size,
      json_size: jsonBackup.size,
      sql_path: sqlPath,
      json_path: jsonPath,
      manual: manualTrigger,
    };

    console.log(`📧 Enviando correo a ${recipient}...`);
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY no configurado");
    const resend = new Resend(resendKey);

    const html = buildEmailHtml({
      dateStr: dateDisplay,
      sqlUrl: sqlSigned.signedUrl,
      jsonUrl: jsonSigned.signedUrl,
      sqlSize: formatBytes(sqlBackup.size),
      jsonSize: formatBytes(jsonBackup.size),
      expiresDays,
    });

    const { data: sent, error: sendErr } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [recipient],
      subject: `Respaldo TMS Grúas - ${dateDisplay}`,
      html,
    });
    if (sendErr) throw new Error(`Resend: ${sendErr.message ?? JSON.stringify(sendErr)}`);

    // Actualizar config + log
    await supabase.from("backup_email_config").update({
      last_sent_at: new Date().toISOString(),
      last_status: "success",
      last_error: null,
      last_sql_size_bytes: sqlBackup.size,
      last_json_size_bytes: jsonBackup.size,
    }).eq("id", config.id);

    await supabase.from("backup_logs").insert({
      backup_type: "auto",
      status: "completed",
      file_size_bytes: sqlBackup.size + jsonBackup.size,
      metadata: {
        ...generatedBackupMetadata,
        email_status: "success",
        resend_id: sent?.id,
      },
    });

    return new Response(JSON.stringify({
      success: true, recipient,
      sql_size: sqlBackup.size, json_size: jsonBackup.size,
      resend_id: sent?.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error("❌ scheduled-backup-email:", msg);
    try {
      await supabase.from("backup_email_config").update({
        last_sent_at: new Date().toISOString(),
        last_status: "failed",
        last_error: msg.substring(0, 500),
      }).eq("id", (await supabase.from("backup_email_config").select("id").limit(1).maybeSingle()).data?.id);
      await supabase.from("backup_logs").insert(generatedBackupMetadata
        ? {
            backup_type: "auto",
            status: "completed",
            file_size_bytes:
              Number(generatedBackupMetadata.sql_size || 0) +
              Number(generatedBackupMetadata.json_size || 0),
            metadata: {
              ...generatedBackupMetadata,
              email_status: "failed",
              email_error: msg.substring(0, 500),
            },
          }
        : {
            backup_type: "auto",
            status: "failed",
            error_message: msg.substring(0, 500),
            metadata: { source: "scheduled_email", email_status: "not_attempted" },
          });
    } catch (_) { /* ignore */ }
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

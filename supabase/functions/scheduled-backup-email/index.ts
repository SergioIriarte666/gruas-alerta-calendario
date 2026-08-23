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

/**
 * Dos fallos encadenados dieron forma a este archivo:
 *
 * 1. Pedía `.select("*").limit(50000)` sin paginar. PostgREST corta en 1.000
 *    filas por respuesta, así que el límite del cliente nunca se aplicaba y cada
 *    archivo perdía miles de filas en silencio, cubriendo 16 de 143 tablas.
 * 2. Al paginar tabla por tabla pasó a hacer ~208 peticiones de ~265 ms: el ida
 *    y vuelta agotaba el presupuesto de cómputo y el respaldo dejó de generarse
 *    el 2026-08-20 con "CPU Time exceeded".
 *
 * Ahora Postgres arma bloques de varias tablas (`backup_dump_chunk`) y la
 * función solo comprime y sube: ~7 peticiones. Lo que no se pudo leer se
 * reporta; nunca se omite en silencio.
 */

interface TableStat {
  table: string;
  rows: number;
  error?: string;
}

/**
 * El respaldo se pide por bloques, no tabla por tabla.
 *
 * La versión anterior hacía una petición por tabla (143) más una por página
 * extra: ~208 viajes a PostgREST de ~265 ms cada uno. Solo el ida y vuelta
 * agotaba el presupuesto de cómputo, y el respaldo diario dejó de generarse el
 * 2026-08-20 con "CPU Time exceeded" a los 33 s.
 *
 * `backup_dump_chunk` devuelve todas las tablas que quepan en un presupuesto de
 * bytes y dice por cuál seguir: el respaldo completo son ~7 peticiones. Se
 * genera solo el .sql, que es el artefacto con el que se restaura; el .json era
 * el mismo contenido en otra forma y duplicaba el trabajo.
 */
const CHUNK_BYTES = 2_500_000;
const CHUNK_PAGE = 5_000;
const MAX_CHUNKS = 60; // tope de seguridad: jamás debería acercarse

interface DumpChunk {
  body: string;
  next_table: string | null;
  rows_by_table: Record<string, number> | null;
}

async function dumpSql(
  supabase: any,
  stats: TableStat[],
): Promise<Blob> {
  const encoder = new TextEncoder();
  const ts = new TransformStream<Uint8Array, BufferSource>();
  const done = new Response(ts.readable.pipeThrough(new CompressionStream("gzip"))).blob();
  const writer = ts.writable.getWriter();
  const write = (text: string) => writer.write(encoder.encode(text));

  await write(`-- SQL Dump TMS Grúas - ${new Date().toISOString()}\n\n`);

  let nextTable: string | null = null;
  let chunks = 0;

  try {
    while (chunks < MAX_CHUNKS) {
      const { data, error } = await supabase.rpc("backup_dump_chunk", {
        p_start_table: nextTable,
        p_max_bytes: CHUNK_BYTES,
        p_page: CHUNK_PAGE,
      });
      if (error) throw new Error(`bloque ${chunks + 1} desde ${nextTable ?? "el inicio"}: ${error.message}`);

      const chunk = (Array.isArray(data) ? data[0] : data) as DumpChunk | undefined;
      if (!chunk) throw new Error(`bloque ${chunks + 1}: respuesta vacía`);

      chunks += 1;
      await write(chunk.body);
      for (const [table, rows] of Object.entries(chunk.rows_by_table ?? {})) {
        stats.push({ table, rows: Number(rows) });
      }

      nextTable = chunk.next_table;
      if (!nextTable) break;
    }

    if (nextTable) {
      // Nunca debería ocurrir; si ocurre, el archivo queda incompleto y hay que
      // decirlo en vez de subirlo como si estuviera entero.
      throw new Error(`El respaldo no terminó: quedó pendiente desde ${nextTable}`);
    }
  } finally {
    await writer.close();
  }

  console.log(`📦 ${chunks} bloques`);
  return await done;
}

function buildEmailHtml(opts: {
  dateStr: string;
  sqlUrl: string;
  sqlSize: string;
  expiresDays: number;
  tables: number;
  rows: number;
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
          Tu respaldo diario se generó correctamente: <strong>${opts.tables} tablas</strong> y
          <strong>${opts.rows.toLocaleString("es-CL")} registros</strong>. El archivo viene comprimido (.gz);
          descomprímelo con doble clic antes de abrirlo.
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;">
          <tr>
            <td style="padding:14px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;margin-bottom:10px;">
              <div style="font-size:13px;color:#6b21a8;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Dump SQL comprimido · ${opts.sqlSize}</div>
              <div style="font-size:12px;color:#6b7280;margin:4px 0 12px;">INSERTs de todas las tablas, para restaurar la base</div>
              <a href="${opts.sqlUrl}" style="display:inline-block;background:#8b5cf6;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;font-size:14px;">Descargar SQL</a>
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
    // Permite validar la generación completa sin enviarle un correo a nadie.
    const skipEmail: boolean = body?.skip_email === true;

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

    console.log("📦 Generando respaldo...");
    const stats: TableStat[] = [];
    const sqlBlob = await dumpSql(supabase, stats);

    const tables = stats;
    const failedTables = stats.filter((t) => t.error);
    const totalRows = stats.reduce((sum, t) => sum + t.rows, 0);
    console.log(`📊 ${totalRows} filas de ${stats.length} tablas`);
    if (stats.length === 0) throw new Error("El respaldo no incluyó ninguna tabla");

    const sqlPath = `${dateKey}/tms-gruas-backup-${dateKey}.sql.gz`;

    console.log("⬆️  Subiendo a Storage...");
    const { error: sqlUpErr } = await supabase.storage.from(BUCKET).upload(
      sqlPath, sqlBlob, { upsert: true, contentType: "application/gzip" },
    );
    if (sqlUpErr) throw new Error(`Upload SQL falló: ${sqlUpErr.message}`);

    const expiresSec = expiresDays * 86400;
    const { data: sqlSigned, error: sqlSigErr } = await supabase.storage.from(BUCKET)
      .createSignedUrl(sqlPath, expiresSec, { download: `tms-gruas-backup-${dateKey}.sql.gz` });
    if (sqlSigErr || !sqlSigned?.signedUrl) throw new Error(`Signed URL SQL falló: ${sqlSigErr?.message}`);

    const sqlBackup = { size: sqlBlob.size };

    generatedBackupMetadata = {
      source: "scheduled_email",
      recipient,
      sql_size: sqlBlob.size,
      sql_path: sqlPath,
      manual: manualTrigger,
      // Cobertura explícita: si algún día vuelve a faltar algo, queda escrito.
      tables_total: tables.length,
      rows_total: totalRows,
      tables_failed: failedTables.map((t) => ({ table: t.table, error: t.error })),
      rows_by_table: Object.fromEntries(stats.map((t) => [t.table, t.rows])),
    };

    if (skipEmail) {
      await supabase.from("backup_logs").insert({
        backup_type: "auto",
        status: failedTables.length > 0 ? "partial" : "completed",
        file_size_bytes: sqlBlob.size,
        metadata: { ...generatedBackupMetadata, email_status: "skipped" },
      });
      return new Response(JSON.stringify({
        success: true, email_skipped: true,
        tables: tables.length, rows: totalRows,
        failed_tables: failedTables,
        sql_size: sqlBlob.size,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`📧 Enviando correo a ${recipient}...`);
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY no configurado");
    const resend = new Resend(resendKey);

    const html = buildEmailHtml({
      dateStr: dateDisplay,
      sqlUrl: sqlSigned.signedUrl,
      sqlSize: formatBytes(sqlBackup.size),
      expiresDays,
      tables: tables.length,
      rows: totalRows,
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
    }).eq("id", config.id);

    await supabase.from("backup_logs").insert({
      backup_type: "auto",
      // Una tabla ilegible ya no pasa por respaldo correcto.
      status: failedTables.length > 0 ? "partial" : "completed",
      file_size_bytes: sqlBackup.size,
      error_message: failedTables.length > 0
        ? `No se pudieron leer ${failedTables.length} tabla(s): ${failedTables.map((t) => t.table).join(", ")}`
        : null,
      metadata: {
        ...generatedBackupMetadata,
        email_status: "success",
        resend_id: sent?.id,
      },
    });

    return new Response(JSON.stringify({
      success: true, recipient,
      tables: tables.length, rows: totalRows, failed_tables: failedTables,
      sql_size: sqlBackup.size,
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
              Number(generatedBackupMetadata.sql_size || 0),
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

import { createClient } from "npm:@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@6";
import { createR2Config, listObjectKeys } from "../_shared/r2.ts";
import { assertCronRequest, errorMessage, json } from "../_shared/retention.ts";

/**
 * Vigilante del respaldo.
 *
 * Hasta ahora el correo diario solo llegaba cuando el respaldo salía bien, así
 * que el silencio parecía éxito. Esta función invierte esa señal: revisa que en
 * las últimas 26 horas exista un respaldo generado Y una copia verificada en
 * R2, y avisa cuando falta alguno.
 *
 * Vive aparte de `scheduled-backup-email` a propósito: un respaldo que no corre
 * no puede avisar de su propia ausencia.
 */

const FROM_ADDRESS = "Grúas 5 Norte <facturacion@gruas5norte.cl>";
const WINDOW_HOURS = 26; // 24 h de ciclo + margen para atrasos del cron

const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 3_600_000).toISOString();

const dayOffset = (offset: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

Deno.serve(async (req: Request) => {
  try {
    assertCronRequest(req);
  } catch (response) {
    return response as Response;
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const since = hoursAgo(WINDOW_HOURS);
    const problems: string[] = [];

    const { data: logs, error: logsError } = await supabase
      .from("backup_logs")
      .select("status, error_message, metadata, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    if (logsError) throw new Error(`No se pudo leer backup_logs: ${logsError.message}`);

    const rows = logs ?? [];
    const generation = rows.find((r) => r.metadata?.source === "scheduled_email");
    const offsite = rows.find((r) => r.metadata?.source === "sync_backups_to_r2");

    // 1) ¿se generó?
    if (!generation) {
      problems.push(`No se generó ningún respaldo en las últimas ${WINDOW_HOURS} horas.`);
    } else if (generation.status !== "completed") {
      problems.push(
        `El último respaldo quedó en estado "${generation.status}": ${generation.error_message ?? "sin detalle"}.`,
      );
    } else {
      const tables = Number(generation.metadata?.tables_total ?? 0);
      const rowsTotal = Number(generation.metadata?.rows_total ?? 0);
      // Un respaldo que de pronto trae mucho menos que antes es sospechoso
      // aunque se declare correcto: es exactamente como pasó desapercibido
      // el truncamiento a 1.000 filas por tabla.
      if (tables < 100 || rowsTotal < 10_000) {
        problems.push(
          `El último respaldo se declara correcto pero trae solo ${tables} tablas y ${rowsTotal} filas.`,
        );
      }
    }

    // 2) ¿existe de verdad fuera de sitio? No basta con que el registro lo diga.
    let r2Days: string[] = [];
    try {
      const r2 = createR2Config(Deno.env.get("R2_BACKUPS_BUCKET")?.trim());
      const keys = await listObjectKeys(r2);
      r2Days = [...new Set(keys.map((k) => k.slice(0, 10)))].sort();
      const recent = [dayOffset(0), dayOffset(-1)];
      if (!r2Days.some((day) => recent.includes(day))) {
        problems.push(`R2 no tiene copia de hoy ni de ayer (última: ${r2Days.at(-1) ?? "ninguna"}).`);
      }
    } catch (r2Error) {
      problems.push(`No se pudo consultar R2: ${errorMessage(r2Error)}`);
    }

    if (!offsite && r2Days.length === 0) {
      problems.push("La copia fuera de sitio no corrió y R2 está vacío.");
    }

    if (problems.length === 0) {
      return json({
        success: true, healthy: true,
        tables: generation?.metadata?.tables_total,
        rows: generation?.metadata?.rows_total,
        r2_days: r2Days.length,
      });
    }

    // ── Aviso ──
    const { data: config } = await supabase
      .from("backup_email_config").select("recipient_email").limit(1).maybeSingle();
    const recipient = (config?.recipient_email || "").trim();
    const resendKey = Deno.env.get("RESEND_API_KEY");

    let notified = false;
    if (recipient && resendKey) {
      const list = problems.map((p) => `<li style="margin-bottom:6px">${p}</li>`).join("");
      await new Resend(resendKey).emails.send({
        from: FROM_ADDRESS,
        to: [recipient],
        subject: "⚠️ Revisar el respaldo de TMS Grúas",
        html: `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;padding:24px">
  <h1 style="font-size:19px;margin:0 0 12px">El respaldo necesita atención</h1>
  <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
    La revisión automática de las últimas ${WINDOW_HOURS} horas encontró esto:
  </p>
  <ul style="font-size:15px;line-height:1.6;padding-left:20px">${list}</ul>
  <p style="margin:16px 0 0;font-size:13px;color:#6b7280">
    Mientras no se resuelva, no hay garantía de poder recuperar los datos ante un error.
  </p>
</body></html>`,
      });
      notified = true;
    }

    await supabase.from("backup_logs").insert({
      backup_type: "auto",
      status: "failed",
      error_message: problems.join(" | ").substring(0, 500),
      metadata: { source: "backup_watchdog", problems, notified, recipient },
    });

    console.error(`⚠️ backup-watchdog: ${problems.join(" | ")}`);
    return json({ success: true, healthy: false, problems, notified });
  } catch (error) {
    const detail = errorMessage(error);
    console.error(`❌ backup-watchdog: ${detail}`);
    return json({ success: false, error: detail }, 500);
  }
});

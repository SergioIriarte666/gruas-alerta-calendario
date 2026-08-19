import { createClient } from "npm:@supabase/supabase-js@2.50.0";
import { createR2Config, headVerifiedObject, putAndVerifyObject } from "../_shared/r2.ts";
import { assertCronRequest, errorMessage, json } from "../_shared/retention.ts";

/**
 * Copia los respaldos diarios a Cloudflare R2, fuera de Supabase.
 *
 * Va aparte de `scheduled-backup-email` a propósito: generar el respaldo ya
 * consume 85 s de los ~150 s disponibles, y añadirle la subida lo mataba con
 * WORKER_RESOURCE_LIMIT.
 *
 * Es un reconciliador, no un disparo único: cada corrida busca respaldos sin
 * copia verificada en R2 y sube los que falten. Si un día falla la copia, la
 * corrida siguiente la recupera sola sin intervención.
 */

const STORAGE_BUCKET = "backups-auto";
const DEFAULT_BATCH_LIMIT = 3;   // ~16 MB por día; más no cabe en una corrida
const MAX_BATCH_LIMIT = 6;
const LOOKBACK_DAYS = 35;        // algo más que la retención, para no dejar huecos

interface PendingFile {
  day: string;
  name: string;
  path: string;
  size: number;
}

const dayFromNow = (offset: number): string => {
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
    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body?.dry_run === true;
    const limit = Math.min(
      Math.max(Number(body?.limit) || DEFAULT_BATCH_LIMIT, 1),
      MAX_BATCH_LIMIT,
    );

    const r2 = createR2Config(Deno.env.get("R2_BACKUPS_BUCKET")?.trim());
    const oldestDay = dayFromNow(-LOOKBACK_DAYS);

    // Los respaldos viven en carpetas YYYY-MM-DD dentro del bucket.
    const { data: days, error: daysError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list("", { limit: 1000, sortBy: { column: "name", order: "desc" } });
    if (daysError) throw new Error(`No se pudo listar Storage: ${daysError.message}`);

    const candidateDays = (days || [])
      .map((entry) => entry.name)
      .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name) && name >= oldestDay)
      .sort()
      .reverse();

    const pending: PendingFile[] = [];
    for (const day of candidateDays) {
      if (pending.length >= limit) break;

      const { data: files, error: filesError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .list(day, { limit: 100 });
      if (filesError) {
        console.warn(`No se pudo listar ${day}: ${filesError.message}`);
        continue;
      }

      for (const file of files || []) {
        // Solo los comprimidos: los .sql/.json sueltos son del formato viejo.
        if (!file.name.endsWith(".gz")) continue;
        const size = Number(file.metadata?.size ?? 0);
        if (size <= 0) continue;

        const key = `${day}/${file.name}`;
        // Sin el sha esperado, HEAD confirma al menos que existe con ese tamaño.
        if (await headVerifiedObject(r2, key, size)) continue;

        pending.push({ day, name: file.name, path: key, size });
        if (pending.length >= limit) break;
      }
    }

    if (pending.length === 0) {
      return json({ success: true, copied: 0, message: "Todo respaldo reciente ya tiene copia verificada en R2" });
    }

    if (dryRun) {
      return json({
        success: true, dry_run: true,
        would_copy: pending.map((f) => ({ key: f.path, size: f.size })),
      });
    }

    const copied: Record<string, unknown>[] = [];
    const failed: Record<string, unknown>[] = [];

    for (const file of pending) {
      try {
        const { data: blob, error: downloadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .download(file.path);
        if (downloadError || !blob) {
          throw new Error(downloadError?.message ?? "descarga vacía");
        }

        const bytes = new Uint8Array(await blob.arrayBuffer());
        const result = await putAndVerifyObject(
          r2, file.path, bytes, "application/gzip", STORAGE_BUCKET, file.path,
        );
        copied.push({ key: file.path, size: result.size, sha256: result.sha256 });
        console.log(`☁️  ${file.path} → R2 (${result.size} bytes)`);
      } catch (error) {
        const detail = errorMessage(error);
        failed.push({ key: file.path, error: detail });
        console.error(`❌ ${file.path}: ${detail}`);
      }
    }

    await supabase.from("backup_logs").insert({
      backup_type: "auto",
      status: failed.length > 0 ? "partial" : "completed",
      file_size_bytes: copied.reduce((sum, c) => sum + Number(c.size || 0), 0),
      error_message: failed.length > 0
        ? `No se pudo copiar a R2: ${failed.map((f) => f.key).join(", ")}`
        : null,
      metadata: {
        source: "sync_backups_to_r2",
        bucket: r2.bucket,
        copied,
        failed,
        pending_after: Math.max(pending.length - copied.length, 0),
      },
    });

    return json({
      success: failed.length === 0,
      copied: copied.length,
      failed,
      bucket: r2.bucket,
      details: copied,
    });
  } catch (error) {
    const detail = errorMessage(error);
    console.error(`❌ sync-backups-to-r2: ${detail}`);
    await supabase.from("backup_logs").insert({
      backup_type: "auto",
      status: "failed",
      error_message: detail.substring(0, 500),
      metadata: { source: "sync_backups_to_r2" },
    }).then(() => {}, () => {});
    return json({ success: false, error: detail }, 500);
  }
});

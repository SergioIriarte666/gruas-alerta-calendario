import { createClient } from "npm:@supabase/supabase-js@2.50.0";
import { createR2Config, deleteAndVerifyObjects, listObjectKeys } from "../_shared/r2.ts";
import { assertCronRequest, errorMessage, json } from "../_shared/retention.ts";

/**
 * Purga de respaldos, en Supabase Storage y en R2 a la vez.
 *
 * Regla acordada con el dueño (2026-08-19):
 *   · se conservan los últimos 30 días completos;
 *   · de cada mes anterior sobrevive una copia —la más antigua del mes, que es
 *     la que cierra el mes anterior— durante 12 meses;
 *   · lo demás se borra.
 *
 * La fecha sale SIEMPRE de la llave del objeto (`YYYY-MM-DD/...`), nunca de la
 * metadata: es el único dato que no se puede corromper ni reescribir.
 */

const STORAGE_BUCKET = "backups-auto";
const KEEP_DAILY_DAYS = 30;
const KEEP_MONTHLY_DAYS = 365;
const DAY_RE = /^(\d{4}-\d{2}-\d{2})\//;

const dayFromNow = (offset: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

/** Decide qué días se conservan. Devuelve también el porqué, para poder auditarlo. */
const planRetention = (days: string[], today: string) => {
  const sorted = [...new Set(days)].sort();
  const dailyCutoff = dayFromNow(-KEEP_DAILY_DAYS);
  const monthlyCutoff = dayFromNow(-KEEP_MONTHLY_DAYS);

  // La copia mensual es la más antigua de cada mes.
  const monthlyKeeper = new Map<string, string>();
  for (const day of sorted) {
    const month = day.slice(0, 7);
    if (!monthlyKeeper.has(month)) monthlyKeeper.set(month, day);
  }

  const newest = sorted[sorted.length - 1];
  const keep = new Map<string, string>();
  const drop: string[] = [];

  for (const day of sorted) {
    if (day === newest || day === today) {
      keep.set(day, "más reciente");
    } else if (day >= dailyCutoff) {
      keep.set(day, "dentro de los 30 días");
    } else if (monthlyKeeper.get(day.slice(0, 7)) === day && day >= monthlyCutoff) {
      keep.set(day, "copia mensual");
    } else {
      drop.push(day);
    }
  }

  return { keep, drop, dailyCutoff, monthlyCutoff };
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
    const dryRun: boolean = body?.dry_run !== false; // por defecto NO borra
    const today = dayFromNow(0);

    // ── Inventario: Supabase Storage ──
    const { data: folders, error: foldersError } = await supabase.storage
      .from(STORAGE_BUCKET).list("", { limit: 1000 });
    if (foldersError) throw new Error(`No se pudo listar Storage: ${foldersError.message}`);

    const storageByDay = new Map<string, string[]>();
    for (const folder of folders || []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(folder.name)) continue;
      const { data: files, error } = await supabase.storage
        .from(STORAGE_BUCKET).list(folder.name, { limit: 100 });
      if (error) throw new Error(`No se pudo listar ${folder.name}: ${error.message}`);
      const paths = (files || []).filter((f) => f.id).map((f) => `${folder.name}/${f.name}`);
      if (paths.length > 0) storageByDay.set(folder.name, paths);
    }

    // ── Inventario: R2 ──
    const r2 = createR2Config(Deno.env.get("R2_BACKUPS_BUCKET")?.trim());
    const r2Keys = await listObjectKeys(r2);
    const r2ByDay = new Map<string, string[]>();
    for (const key of r2Keys) {
      const day = key.match(DAY_RE)?.[1];
      if (!day) continue;
      r2ByDay.set(day, [...(r2ByDay.get(day) ?? []), key]);
    }

    const allDays = [...new Set([...storageByDay.keys(), ...r2ByDay.keys()])];
    if (allDays.length === 0) {
      return json({ success: true, message: "No hay respaldos que evaluar", deleted: 0 });
    }

    const { keep, drop, dailyCutoff, monthlyCutoff } = planRetention(allDays, today);

    // Guarda dura: si el plan no deja nada en pie, algo está mal en el cálculo
    // de fechas y no se borra absolutamente nada.
    if (keep.size === 0) {
      throw new Error("ABORTA: la retención no conservaría ningún respaldo");
    }

    const storageToDelete = drop.flatMap((day) => storageByDay.get(day) ?? []);
    const r2ToDelete = drop.flatMap((day) => r2ByDay.get(day) ?? []);

    const summary = {
      hoy: today,
      corte_diario: dailyCutoff,
      corte_mensual: monthlyCutoff,
      dias_conservados: [...keep.entries()].map(([day, reason]) => ({ day, reason })),
      dias_a_borrar: drop,
      archivos_storage: storageToDelete.length,
      archivos_r2: r2ToDelete.length,
    };

    if (dryRun) {
      return json({ success: true, dry_run: true, ...summary });
    }

    if (storageToDelete.length > 0) {
      const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(storageToDelete);
      if (error) throw new Error(`Borrado en Storage falló: ${error.message}`);
    }
    if (r2ToDelete.length > 0) {
      await deleteAndVerifyObjects(r2, r2ToDelete);
    }

    await supabase.from("backup_logs").insert({
      backup_type: "auto",
      status: "completed",
      metadata: {
        source: "purge_old_backups",
        retencion: "30 días + 1 copia mensual durante 12 meses",
        ...summary,
      },
    });

    console.log(`🧹 Purgados ${storageToDelete.length} en Storage y ${r2ToDelete.length} en R2`);
    return json({ success: true, ...summary });
  } catch (error) {
    const detail = errorMessage(error);
    console.error(`❌ purge-old-backups: ${detail}`);
    await supabase.from("backup_logs").insert({
      backup_type: "auto",
      status: "failed",
      error_message: detail.substring(0, 500),
      metadata: { source: "purge_old_backups" },
    }).then(() => {}, () => {});
    return json({ success: false, error: detail }, 500);
  }
});

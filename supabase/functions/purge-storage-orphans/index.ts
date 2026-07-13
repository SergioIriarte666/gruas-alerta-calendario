import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { assertCronRequest, errorMessage, json } from "../_shared/retention.ts";

// Barrido del ledger inspection_storage_orphans: borra de Supabase Storage los
// objetos huerfanos que quedaron registrados (subidas cuyo servicio se elimino,
// PDFs de reintentos, etc.) y marca la fila como resuelta.
//
// CLAVE: procesa TODAS las filas sin resolver, INCLUIDAS las de service_id NULL.
// La FK service_id ... ON DELETE SET NULL deja en NULL las filas de servicios ya
// borrados, que son justamente las que hay que purgar. Filtrar por service_id
// (o un join que las excluya) las dejaria huerfanas para siempre.

type OrphanRow = {
  id: string;
  bucket_id: string;
  storage_path: string;
};

const BATCH_LIMIT = 200;

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

  const { data, error } = await supabase
    .from("inspection_storage_orphans")
    .select("id,bucket_id,storage_path")
    .is("resolved_at", null)
    .order("detected_at", { ascending: true })
    .limit(BATCH_LIMIT);
  if (error) return json({ error: error.message }, 500);

  const rows = (data || []) as OrphanRow[];

  // Agrupar por bucket para borrar en lote con la Storage API.
  const byBucket = new Map<string, OrphanRow[]>();
  for (const row of rows) {
    const list = byBucket.get(row.bucket_id) ?? [];
    list.push(row);
    byBucket.set(row.bucket_id, list);
  }

  const nowIso = new Date().toISOString();
  let purged = 0;
  let failed = 0;

  for (const [bucket, bucketRows] of byBucket) {
    const paths = bucketRows.map((r) => r.storage_path);
    const ids = bucketRows.map((r) => r.id);
    try {
      // remove() es idempotente: un objeto ya inexistente no genera error.
      const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
      if (removeError) throw new Error(removeError.message);

      const { error: updateError } = await supabase
        .from("inspection_storage_orphans")
        .update({ cleanup_attempted: true, cleanup_succeeded: true, resolved_at: nowIso, error_message: null })
        .in("id", ids);
      if (updateError) throw new Error(updateError.message);

      purged += bucketRows.length;
    } catch (cause) {
      const message = errorMessage(cause);
      // Intento fallido: se deja sin resolver (resolved_at NULL) para reintentar
      // en la proxima corrida, registrando el error.
      await supabase
        .from("inspection_storage_orphans")
        .update({ cleanup_attempted: true, cleanup_succeeded: false, error_message: message })
        .in("id", ids);
      failed += bucketRows.length;
      console.error(`[purge-storage-orphans] bucket ${bucket}: ${message}`);
    }
  }

  return json({ processed: rows.length, purged, failed });
});

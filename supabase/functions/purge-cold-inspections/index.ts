import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { createR2Config, deleteAndVerifyObjects } from "../_shared/r2.ts";
import { assertCronRequest, errorMessage, json } from "../_shared/retention.ts";

type Row = {
  id: string;
  service_id: string;
  r2_pdf_path: string | null;
  r2_pdf_retiro_path: string | null;
  r2_photos: Record<string, string[]> | null;
};

const audit = async (
  supabase: ReturnType<typeof createClient>,
  row: Row,
  status: "success" | "failure",
  details: Record<string, unknown>,
  errorMessage?: string,
) => {
  const { error } = await supabase.from("inspection_retention_audit").insert({
    inspection_id: row.id,
    service_id: row.service_id,
    action: "purge",
    status,
    details,
    error_message: errorMessage || null,
  });
  if (error) console.error(`[purge-cold-inspections] auditoría ${row.id}: ${error.message}`);
};

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
  const r2 = createR2Config();
  const purgeCutoff = new Date();
  purgeCutoff.setUTCFullYear(purgeCutoff.getUTCFullYear() - 2);
  const { data, error } = await supabase
    .from("inspections")
    .select("id,service_id,r2_pdf_path,r2_pdf_retiro_path,r2_photos")
    .eq("storage_tier", "cold")
    .lt("archived_at", purgeCutoff.toISOString())
    .order("archived_at", { ascending: true })
    .limit(200);
  if (error) return json({ error: error.message }, 500);

  const results: Array<{ inspectionId: string; serviceId: string; status: string; error?: string }> = [];
  for (const row of (data || []) as Row[]) {
    try {
      const photoKeys = Object.values(row.r2_photos || {}).flat().filter((key): key is string => typeof key === "string");
      const keys = [row.r2_pdf_path, row.r2_pdf_retiro_path, ...photoKeys].filter((key): key is string => !!key);
      await deleteAndVerifyObjects(r2, keys);

      const deletedAt = new Date().toISOString();
      const { error: updateError } = await supabase.from("inspections")
        .update({ storage_tier: "deleted", deleted_at: deletedAt })
        .eq("id", row.id)
        .eq("storage_tier", "cold");
      if (updateError) throw new Error(updateError.message);

      await audit(supabase, row, "success", { files: keys.length, deleted_at: deletedAt });
      results.push({ inspectionId: row.id, serviceId: row.service_id, status: "success" });
    } catch (cause) {
      const message = errorMessage(cause);
      try {
        await audit(supabase, row, "failure", {}, message);
      } catch (auditCause) {
        console.error(`[purge-cold-inspections] auditoría ${row.id}: ${errorMessage(auditCause)}`);
      }
      results.push({ inspectionId: row.id, serviceId: row.service_id, status: "failure", error: message });
    }
  }
  return json({ processed: results.length, results });
});

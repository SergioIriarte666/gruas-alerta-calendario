import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { requireUserRoles, withHeaders, jsonResponse } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createR2Config, createR2DownloadUrl } from "../_shared/r2.ts";

const cors = (req: Request) => ({
  ...getCorsHeaders(req),
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return withHeaders(jsonResponse({ error: "Método no permitido" }, 405), cors(req));

  const auth = await requireUserRoles(req, ["admin", "operator"]);
  if ("response" in auth) return withHeaders(auth.response, cors(req));

  const body = await req.json().catch(() => ({})) as { serviceId?: string; inspectionId?: string; folio?: string };
  if (!body.serviceId && !body.inspectionId && !body.folio) {
    return withHeaders(jsonResponse({ error: "serviceId, inspectionId o folio es requerido" }, 400), cors(req));
  }

  // Los operadores consultan con su propio JWT para conservar el alcance RLS del servicio.
  // Solo el administrador usa el cliente privilegiado.
  const dataClient = auth.role === "admin" ? auth.supabaseAdmin : createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: { headers: { Authorization: auth.authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  let serviceId = body.serviceId;
  if (!serviceId && body.folio) {
    const { data: service, error: serviceError } = await dataClient
      .from("services")
      .select("id")
      .eq("folio", body.folio)
      .maybeSingle();
    if (serviceError) return withHeaders(jsonResponse({ error: serviceError.message }, 500), cors(req));
    if (!service) return withHeaders(jsonResponse({ error: "Servicio no encontrado" }, 404), cors(req));
    serviceId = service.id;
  }

  let query = dataClient
    .from("inspections")
    .select("id,service_id,storage_tier,archived_at,deleted_at,r2_pdf_path,r2_pdf_retiro_path,r2_photos");
  query = body.inspectionId ? query.eq("id", body.inspectionId) : query.eq("service_id", serviceId!);
  const { data: inspection, error } = await query.maybeSingle();
  if (error) return withHeaders(jsonResponse({ error: error.message }, 500), cors(req));
  if (!inspection) return withHeaders(jsonResponse({ error: "Inspección no encontrada" }, 404), cors(req));

  if (inspection.storage_tier === "deleted") {
    return withHeaders(jsonResponse({
      tier: "deleted",
      deletedAt: inspection.deleted_at,
      message: "Respaldo eliminado por política de retención (>2 años)",
    }), cors(req));
  }
  if (inspection.storage_tier !== "cold") {
    return withHeaders(jsonResponse({ tier: inspection.storage_tier }), cors(req));
  }

  const r2 = createR2Config();
  const expiresIn = 60 * 60;
  const sign = async (key: string | null) => key ? await createR2DownloadUrl(r2, key, expiresIn) : null;
  const groups = (inspection.r2_photos || {}) as Record<string, string[]>;
  const signMany = (keys: string[] | undefined) => Promise.all((keys || []).map(sign));
  let signed: [string | null, string | null, Array<string | null>, Array<string | null>, Array<string | null>];
  try {
    signed = await Promise.all([
      sign(inspection.r2_pdf_path),
      sign(inspection.r2_pdf_retiro_path),
      signMany(groups.before_service),
      signMany(groups.client_vehicle),
      signMany(groups.equipment_used),
    ]);
  } catch (cause) {
    console.error(`[get-archived-inspection-files] ${inspection.id}:`, cause);
    return withHeaders(jsonResponse({ error: "El respaldo archivado no está disponible en R2" }, 502), cors(req));
  }
  const [pdfUrl, pdfRetiroUrl, before, client, equipment] = signed;

  return withHeaders(jsonResponse({
    tier: "cold",
    archivedAt: inspection.archived_at,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    pdfUrl,
    pdfRetiroUrl,
    photos: { beforeService: before, clientVehicle: client, equipmentUsed: equipment },
  }), cors(req));
});

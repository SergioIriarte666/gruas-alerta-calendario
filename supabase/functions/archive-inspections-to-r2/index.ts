import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { createR2Config, headVerifiedObject, putAndVerifyObject } from "../_shared/r2.ts";
import { assertCronRequest, errorMessage, json } from "../_shared/retention.ts";

const PHOTO_BUCKET = "inspection-photos";
const PDF_BUCKET = "inspection-pdfs";

type PhotoGroup = "before_service" | "client_vehicle" | "equipment_used";
type SourceFile = {
  bucket: string;
  sourcePath: string;
  kind: "pdf" | "pdf_retiro" | "photo";
  group?: PhotoGroup;
  index?: number;
};
type ManifestEntry = SourceFile & {
  r2Path: string;
  size: number;
  sha256: string;
  contentType: string;
};
type InspectionRow = {
  id: string;
  service_id: string;
  pdf_url: string | null;
  pdf_retiro_url: string | null;
  photos_before_service: string[] | null;
  photos_client_vehicle: string[] | null;
  photos_equipment_used: string[] | null;
  archive_manifest: ManifestEntry[] | null;
};

const storagePath = (value: string | null, bucket: string): string | null => {
  if (!value) return null;
  if (!value.startsWith("http")) return value;
  for (const marker of [`/object/sign/${bucket}/`, `/object/public/${bucket}/`]) {
    const index = value.indexOf(marker);
    if (index >= 0) return decodeURIComponent(value.slice(index + marker.length).split("?")[0]);
  }
  throw new Error(`No se pudo extraer un path válido de ${bucket}`);
};

const safeName = (path: string): string => {
  const name = path.split("/").pop() || "archivo";
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
};

const sourcesFor = (row: InspectionRow): SourceFile[] => {
  const files: SourceFile[] = [];
  const pdf = storagePath(row.pdf_url, PDF_BUCKET);
  const retiro = storagePath(row.pdf_retiro_url, PDF_BUCKET);
  if (pdf) files.push({ bucket: PDF_BUCKET, sourcePath: pdf, kind: "pdf" });
  if (retiro) files.push({ bucket: PDF_BUCKET, sourcePath: retiro, kind: "pdf_retiro" });

  const groups: Array<[PhotoGroup, string[] | null]> = [
    ["before_service", row.photos_before_service],
    ["client_vehicle", row.photos_client_vehicle],
    ["equipment_used", row.photos_equipment_used],
  ];
  for (const [group, values] of groups) {
    (values || []).forEach((value, index) => {
      const path = storagePath(value, PHOTO_BUCKET);
      if (path) files.push({ bucket: PHOTO_BUCKET, sourcePath: path, kind: "photo", group, index });
    });
  }
  return files;
};

const keyFor = (serviceId: string, file: SourceFile): string => {
  const segment = file.kind === "photo" ? `photos/${file.group}` : `pdfs/${file.kind}`;
  const orderedName = file.kind === "photo" ? `${file.index ?? 0}-${safeName(file.sourcePath)}` : safeName(file.sourcePath);
  return `inspections/${serviceId}/${segment}/${orderedName}`;
};

const audit = async (supabase: ReturnType<typeof createClient>, row: InspectionRow, status: string, details: unknown, error?: string) => {
  const { error: auditError } = await supabase.from("inspection_retention_audit").insert({
    inspection_id: row.id,
    service_id: row.service_id,
    action: "archive",
    status,
    details,
    error_message: error || null,
  });
  if (auditError) console.error(`[archive-inspections-to-r2] auditoría ${row.id}: ${auditError.message}`);
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
  const requestedLimit = Number(new URL(req.url).searchParams.get("limit") || "50");
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 50, 1), 200);
  const archiveCutoff = new Date();
  archiveCutoff.setUTCMonth(archiveCutoff.getUTCMonth() - 6);

  const { data, error } = await supabase
    .from("inspections")
    .select("id,service_id,pdf_url,pdf_retiro_url,photos_before_service,photos_client_vehicle,photos_equipment_used,archive_manifest")
    .eq("storage_tier", "hot")
    .lt("created_at", archiveCutoff.toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) return json({ error: error.message }, 500);

  const results: Array<{ inspectionId: string; serviceId: string; status: string; error?: string }> = [];
  for (const row of (data || []) as InspectionRow[]) {
    try {
      const sources = sourcesFor(row);
      const previous = Array.isArray(row.archive_manifest) ? row.archive_manifest : [];
      const manifest: ManifestEntry[] = [];

      // Fase 1: copiar y verificar absolutamente todo. No se borra nada en esta fase.
      for (const source of sources) {
        const staged = previous.find((item) =>
          item.bucket === source.bucket && item.sourcePath === source.sourcePath
        );
        if (staged && await headVerifiedObject(r2, staged.r2Path, staged.size, staged.sha256)) {
          manifest.push(staged);
          continue;
        }

        const { data: blob, error: downloadError } = await supabase.storage
          .from(source.bucket)
          .download(source.sourcePath);
        if (downloadError || !blob) {
          throw new Error(`No se pudo descargar ${source.bucket}/${source.sourcePath}: ${downloadError?.message || "sin datos"}`);
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const r2Path = keyFor(row.service_id, source);
        const verified = await putAndVerifyObject(
          r2,
          r2Path,
          bytes,
          blob.type || (source.bucket === PDF_BUCKET ? "application/pdf" : "application/octet-stream"),
          source.bucket,
          source.sourcePath,
        );
        manifest.push({
          ...source,
          r2Path,
          size: verified.size,
          sha256: verified.sha256,
          contentType: blob.type || "application/octet-stream",
        });
      }

      const photoPaths = (group: PhotoGroup) => manifest
        .filter((item) => item.kind === "photo" && item.group === group)
        .sort((a, b) => (a.index || 0) - (b.index || 0))
        .map((item) => item.r2Path);
      const stagedPaths = {
        r2_pdf_path: manifest.find((item) => item.kind === "pdf")?.r2Path || null,
        r2_pdf_retiro_path: manifest.find((item) => item.kind === "pdf_retiro")?.r2Path || null,
        r2_photos: {
          before_service: photoPaths("before_service"),
          client_vehicle: photoPaths("client_vehicle"),
          equipment_used: photoPaths("equipment_used"),
        },
        archive_manifest: manifest,
      };

      // El manifiesto permite retomar si Storage o la actualización final fallan.
      const { error: stageError } = await supabase.from("inspections")
        .update(stagedPaths)
        .eq("id", row.id)
        .eq("storage_tier", "hot");
      if (stageError) throw new Error(`No se pudo guardar el manifiesto: ${stageError.message}`);

      // Fase 2: solo comienza después de verificar el conjunto completo en R2.
      for (const bucket of [PDF_BUCKET, PHOTO_BUCKET]) {
        const paths = [...new Set(sources.filter((item) => item.bucket === bucket).map((item) => item.sourcePath))];
        if (paths.length === 0) continue;
        const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
        if (removeError) throw new Error(`No se pudo borrar de ${bucket}: ${removeError.message}`);
      }

      const archivedAt = new Date().toISOString();
      const { error: finalizeError } = await supabase.from("inspections")
        .update({ ...stagedPaths, storage_tier: "cold", archived_at: archivedAt, deleted_at: null })
        .eq("id", row.id)
        .eq("storage_tier", "hot");
      if (finalizeError) throw new Error(`No se pudo finalizar el archivado: ${finalizeError.message}`);

      await audit(supabase, row, "success", { files: manifest.length, archived_at: archivedAt });
      results.push({ inspectionId: row.id, serviceId: row.service_id, status: "success" });
    } catch (cause) {
      const message = errorMessage(cause);
      console.error(`[archive-inspections-to-r2] ${row.id}: ${message}`);
      await audit(supabase, row, "failure", {}, message);
      results.push({ inspectionId: row.id, serviceId: row.service_id, status: "failure", error: message });
    }
  }

  return json({ processed: results.length, results });
});

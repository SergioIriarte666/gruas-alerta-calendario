import type { SupabaseClient } from "npm:@supabase/supabase-js@2.50.0";
import { createR2Config, deleteAndVerifyObjects, putAndVerifyObject, sha256Base64 } from "./r2.ts";
import { MAX_RECEIPT_BYTES, parsePurchaseReceiptPath, putPurchaseReceipt, verifyPurchaseReceipt } from "./purchaseReceipts.ts";

type Client = SupabaseClient;

export async function checkPurchaseReceiptStorage() {
  const bucket = Deno.env.get("R2_PURCHASES_BUCKET")?.trim();
  if (!bucket) throw new Error("Falta configurar R2_PURCHASES_BUCKET");
  const r2 = createR2Config(bucket);
  const key = `purchase-receipts/_checks/${crypto.randomUUID()}.txt`;
  const bytes = new TextEncoder().encode("purchase-receipts-private-storage-check");
  try {
    const result = await putAndVerifyObject(r2, key, bytes, "text/plain", "health-check", key);
    await verifyPurchaseReceipt(r2, key, result.size, result.sha256);
  } finally { await deleteAndVerifyObjects(r2, [key]); }
  return { bucket: r2.bucket };
}

export interface ReceiptRecord {
  path: string;
  owner_id: string;
  request_id: string;
  r2_bucket: string;
  r2_key: string;
  size_bytes: number;
  sha256: string;
  legacy_removed: boolean;
}

export async function findPurchaseReceipt(client: Client, path: string): Promise<ReceiptRecord | null> {
  const { data, error } = await client.from("purchase_receipt_files").select("*").eq("path", path).maybeSingle();
  if (error) throw new Error("No se pudo consultar el respaldo de la compra");
  return data as ReceiptRecord | null;
}

export async function storePurchaseReceipt(client: Client, path: string, bytes: Uint8Array, legacyRemoved: boolean, r2Factory = createR2Config): Promise<ReceiptRecord> {
  const identity = parsePurchaseReceiptPath(path);
  const existing = await findPurchaseReceipt(client, path);
  if (existing && (existing.sha256 !== await sha256Base64(bytes) || Number(existing.size_bytes) !== bytes.byteLength)) throw new Error("La solicitud ya tiene otra foto de respaldo. No se reemplazó el original");
  const bucket = existing?.r2_bucket || Deno.env.get("R2_PURCHASES_BUCKET")?.trim();
  if (!bucket) throw new Error("Falta configurar el bucket privado R2_PURCHASES_BUCKET");
  const r2 = r2Factory(bucket);
  const result = await putPurchaseReceipt(r2, path, bytes);
  const { error } = await client.from("purchase_receipt_files").upsert({
    path, owner_id: identity.ownerId, request_id: identity.requestId, r2_bucket: r2.bucket,
    r2_key: result.key, size_bytes: result.size, sha256: result.sha256, legacy_removed: legacyRemoved,
  }, { onConflict: "path", ignoreDuplicates: true });
  if (error) throw new Error("R2 recibió la foto, pero no se pudo registrar su verificación. Reintenta sin cambiar los datos");
  const saved = await findPurchaseReceipt(client, path);
  if (!saved || saved.sha256 !== result.sha256 || Number(saved.size_bytes) !== result.size) throw new Error("El registro del respaldo no coincide con la foto");
  return saved;
}

export async function migratePurchaseReceipt(client: Client, path: string, r2Factory = createR2Config): Promise<ReceiptRecord> {
  parsePurchaseReceiptPath(path);
  let saved = await findPurchaseReceipt(client, path);
  const storage = client.storage.from("quick-entry-photos");
  const { data: photo, error: downloadError } = await storage.download(path);
  if (downloadError || !photo) {
    if (!saved) throw new Error("No se pudo leer el original de Supabase. No se eliminó ningún archivo");
    const slash = path.lastIndexOf("/");
    const { data: files, error: listError } = await storage.list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 100 });
    if (listError || !files || files.some(file => file.name === path.slice(slash + 1))) throw new Error("No se pudo confirmar el estado del original. No se eliminó ningún archivo");
  } else {
    if (photo.size > MAX_RECEIPT_BYTES) throw new Error("La foto original supera 5 MB. Se conservó en Supabase para revisión");
    const bytes = new Uint8Array(await photo.arrayBuffer());
    saved = await storePurchaseReceipt(client, path, bytes, false, r2Factory);
  }
  const r2 = r2Factory(saved!.r2_bucket);
  await verifyPurchaseReceipt(r2, saved!.r2_key, Number(saved!.size_bytes), saved!.sha256);
  if (photo) {
    const { error: removeError } = await storage.remove([path]);
    if (removeError) throw new Error("El respaldo está verificado en R2; falta retirar la copia de Supabase. Reintenta la migración");
    const slash = path.lastIndexOf("/");
    const { data: files, error: listError } = await storage.list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 100 });
    if (listError || !files || files.some(file => file.name === path.slice(slash + 1))) throw new Error("R2 está verificado, pero no se pudo confirmar el retiro de la copia de Supabase");
  }
  const { error } = await client.from("purchase_receipt_files").update({ legacy_removed: true }).eq("path", path);
  if (error) throw new Error("No se pudo registrar el término de la migración. Reintenta");
  return { ...saved!, legacy_removed: true };
}

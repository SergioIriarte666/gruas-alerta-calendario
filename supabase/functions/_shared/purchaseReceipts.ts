import { headVerifiedObject, r2ObjectUrl, sha256Base64, type R2Config } from "./r2.ts";

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const receiptPath = new RegExp(`^(${uuid})/manual-purchases/(${uuid})\\.jpg$`);

export function parsePurchaseReceiptPath(path: string) {
  const match = receiptPath.exec(path);
  if (!match) throw new Error("Ruta de comprobante inválida");
  return { ownerId: match[1], requestId: match[2] };
}

export async function readLimitedBody(body: ReadableStream<Uint8Array> | null, maximum: number): Promise<Uint8Array> {
  if (!body) throw new Error("Contenido vacío");
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new Error("El archivo supera el tamaño permitido"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function verifyPurchaseReceipt(r2: R2Config, key: string, size: number, sha256: string) {
  if (!await headVerifiedObject(r2, key, size, sha256)) throw new Error("R2 no confirmó el respaldo de la compra");
  const response = await r2.client.fetch(r2ObjectUrl(r2, key), { method: "GET" });
  if (!response.ok) throw new Error("No se pudo releer el respaldo desde R2");
  const bytes = await readLimitedBody(response.body, MAX_RECEIPT_BYTES);
  if (bytes.byteLength !== size || await sha256Base64(bytes) !== sha256) throw new Error("El respaldo en R2 no coincide con el original");
}

export async function putPurchaseReceipt(r2: R2Config, path: string, bytes: Uint8Array) {
  parsePurchaseReceiptPath(path);
  if (!bytes.byteLength || bytes.byteLength > MAX_RECEIPT_BYTES || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new Error("El respaldo debe ser una foto JPEG de hasta 5 MB");
  const key = `purchase-receipts/${path}`;
  const sha256 = await sha256Base64(bytes);
  if (!await headVerifiedObject(r2, key, bytes.byteLength, sha256)) {
    const response = await r2.client.fetch(r2ObjectUrl(r2, key), {
      method: "PUT",
      headers: { "content-type": "image/jpeg", "cache-control": "private, no-store", "if-none-match": "*", "x-amz-meta-sha256": sha256 },
      body: Uint8Array.from(bytes).buffer,
    });
    if (!response.ok && response.status !== 412) throw new Error("No se pudo guardar el respaldo en Cloudflare R2");
  }
  await verifyPurchaseReceipt(r2, key, bytes.byteLength, sha256);
  return { key, size: bytes.byteLength, sha256 };
}

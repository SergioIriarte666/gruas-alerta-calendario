import { parsePurchaseReceiptPath, putPurchaseReceipt, readLimitedBody } from "./purchaseReceipts.ts";
import { sha256Base64, type R2Config } from "./r2.ts";

const assert = (value: unknown) => { if (!value) throw new Error("Assertion failed"); };
const rejects = async (operation: Promise<unknown>) => { let rejected = false; try { await operation; } catch { rejected = true; } assert(rejected); };
const path = "00000000-0000-0000-0000-000000000001/manual-purchases/00000000-0000-0000-0000-000000000002.jpg";
const jpeg = new Uint8Array([255, 216, 255, 0, 255, 217]);

Deno.test("la ruta solo acepta fotos de compras con usuario y solicitud UUID", () => {
  assert(parsePurchaseReceiptPath(path).ownerId.endsWith("001"));
  for (const invalid of ["../foto.jpg", "otro/foto.jpg", path + "/../otra.jpg"]) {
    let rejected = false; try { parsePurchaseReceiptPath(invalid); } catch { rejected = true; } assert(rejected);
  }
});

Deno.test("sube sin sobrescribir y relee el contenido para verificar SHA-256", async () => {
  const calls: string[] = [];
  const hash = await sha256Base64(jpeg);
  let exists = false;
  const r2: R2Config = { bucket: "private", endpoint: "https://r2.example", client: {
    sign: async () => new Request("https://r2.example/signed"),
    fetch: async (_url, init) => {
      calls.push(init?.method || "GET");
      if (init?.method === "HEAD") return exists ? new Response(null, { headers: { "content-length": String(jpeg.length), "x-amz-meta-sha256": hash } }) : new Response(null, { status: 404 });
      if (init?.method === "PUT") { assert(new Headers(init.headers).get("if-none-match") === "*"); exists = true; return new Response(); }
      return new Response(Uint8Array.from(jpeg).buffer);
    },
  } };
  const result = await putPurchaseReceipt(r2, path, jpeg);
  assert(result.sha256 === hash);
  assert(calls.join(",") === "HEAD,PUT,HEAD,GET");
  calls.length = 0;
  await putPurchaseReceipt(r2, path, jpeg);
  assert(calls.join(",") === "HEAD,HEAD,GET");
});

Deno.test("rechaza un objeto existente distinto o una copia cuyo contenido no coincide", async () => {
  const hash = await sha256Base64(jpeg);
  for (const existingHash of ["otro", hash]) {
    const r2: R2Config = { bucket: "private", endpoint: "https://r2.example", client: {
      sign: async () => new Request("https://r2.example/signed"),
      fetch: async (_url, init) => {
        if (init?.method === "HEAD") return new Response(null, { headers: { "content-length": String(jpeg.length), "x-amz-meta-sha256": existingHash } });
        if (init?.method === "PUT") return new Response(null, { status: 412 });
        return new Response(new Uint8Array([255, 216, 255, 9, 255, 217]));
      },
    } };
    await rejects(putPurchaseReceipt(r2, path, jpeg));
  }
});

Deno.test("limita la lectura del cuerpo aunque el cliente no envíe content-length", async () => {
  await rejects(readLimitedBody(new Response(new Uint8Array(10)).body, 5));
});

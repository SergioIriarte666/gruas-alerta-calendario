import { createClient } from "npm:@supabase/supabase-js@2.50.0";
import { migratePurchaseReceipt, type ReceiptRecord } from "./purchaseReceiptStore.ts";
import { sha256Base64, type R2Config } from "./r2.ts";

const path = "00000000-0000-0000-0000-000000000001/manual-purchases/00000000-0000-0000-0000-000000000002.jpg";
const jpeg = new Uint8Array([255, 216, 255, 0, 255, 217]);
const assert = (value: unknown) => { if (!value) throw new Error("Assertion failed"); };

for (const failure of ["none", "copy", "checksum", "manifest", "delete", "mark"]) {
  Deno.test(`migración R2 conserva originales y permite reintentos: ${failure}`, async () => {
    const previousBucket = Deno.env.get("R2_PURCHASES_BUCKET");
    Deno.env.set("R2_PURCHASES_BUCKET", "g5n-comprobantes-compras");
    try {
      let manifest: ReceiptRecord | null = null;
      let originalExists = true;
      let r2Exists = false;
      let fail = failure;
      const operations: string[] = [];
      const hash = await sha256Base64(jpeg);
      const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
      const client = createClient("https://supabase.example", "test-service-role", {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: async (input, init) => {
          const url = String(input);
          const method = init?.method || "GET";
          if (url.includes("/rest/v1/purchase_receipt_files")) {
            if (method === "GET") return json(manifest ? [manifest] : []);
            if (method === "POST") {
              if (fail === "manifest") return json({ message: "manifest unavailable" }, 500);
              manifest = JSON.parse(String(init?.body)); operations.push("manifest"); return new Response(null, { status: 201 });
            }
            if (fail === "mark") return json({ message: "mark unavailable" }, 500);
            manifest = { ...manifest!, legacy_removed: true }; operations.push("mark"); return new Response(null, { status: 204 });
          }
          if (url.includes("/object/list/")) return json(originalExists ? [{ name: path.split("/").at(-1) }] : []);
          if (method === "GET") return originalExists ? new Response(Uint8Array.from(jpeg).buffer, { headers: { "content-type": "image/jpeg" } }) : json({ message: "not found" }, 404);
          if (method === "DELETE") {
            if (fail === "delete") return json({ message: "delete unavailable" }, 500);
            assert(manifest && r2Exists); operations.push("delete"); originalExists = false; return json([]);
          }
          throw new Error(`Unexpected request ${method} ${url}`);
        } },
      });
      const r2: R2Config = { bucket: "g5n-comprobantes-compras", endpoint: "https://r2.example", client: {
        sign: async () => new Request("https://r2.example/signed"),
        fetch: async (_input, init) => {
          if (init?.method === "HEAD") return r2Exists ? new Response(null, { headers: { "content-length": String(jpeg.length), "x-amz-meta-sha256": hash } }) : new Response(null, { status: 404 });
          if (init?.method === "PUT") { if (fail === "copy") return new Response(null, { status: 500 }); r2Exists = true; operations.push("copy"); return new Response(); }
          operations.push("verify"); return new Response(Uint8Array.from(fail === "checksum" ? new Uint8Array([255, 216, 255, 9, 255, 217]) : jpeg).buffer);
        },
      } };
      let rejected = false;
      try { await migratePurchaseReceipt(client, path, () => r2); } catch { rejected = true; }
      assert(rejected === (failure !== "none"));
      assert(originalExists === !["none", "mark"].includes(failure));
      if (failure === "none" || failure === "mark") {
        assert(operations.indexOf("verify") < operations.indexOf("manifest"));
        assert(operations.indexOf("manifest") < operations.indexOf("delete"));
      }
      if (failure !== "none") {
        fail = "none";
        const result = await migratePurchaseReceipt(client, path, () => r2);
        assert(result.legacy_removed && !originalExists && r2Exists);
      }
    } finally {
      if (previousBucket === undefined) Deno.env.delete("R2_PURCHASES_BUCKET"); else Deno.env.set("R2_PURCHASES_BUCKET", previousBucket);
    }
  });
}

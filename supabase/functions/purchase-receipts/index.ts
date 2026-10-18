import { createClient } from "npm:@supabase/supabase-js@2.50.0";
import { requireUserRoles, jsonResponse, withHeaders } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createR2Config, createR2DownloadUrl } from "../_shared/r2.ts";
import { MAX_RECEIPT_BYTES, parsePurchaseReceiptPath, readLimitedBody } from "../_shared/purchaseReceipts.ts";
import { checkPurchaseReceiptStorage, findPurchaseReceipt, migratePurchaseReceipt, storePurchaseReceipt } from "../_shared/purchaseReceiptStore.ts";

Deno.serve(async (req: Request) => {
  const headers = { ...getCorsHeaders(req), "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store" };
  const json = (body: Record<string, unknown>, status = 200) => withHeaders(jsonResponse(body, status), headers);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const auth = await requireUserRoles(req, ["admin", "operator"]);
  if ("response" in auth) return withHeaders(auth.response, headers);
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.startsWith("multipart/form-data")) {
      const bytes = await readLimitedBody(req.body, MAX_RECEIPT_BYTES + 65536);
      const form = await new Response(Uint8Array.from(bytes).buffer, { headers: { "content-type": contentType } }).formData();
      const requestId = form.get("requestId");
      const photo = form.get("photo");
      if (typeof requestId !== "string" || !(photo instanceof File) || photo.type !== "image/jpeg" || photo.size > MAX_RECEIPT_BYTES) return json({ error: "Foto JPEG o solicitud inválida" }, 400);
      const path = `${auth.user.id}/manual-purchases/${requestId}.jpg`;
      parsePurchaseReceiptPath(path);
      await storePurchaseReceipt(auth.supabaseAdmin, path, new Uint8Array(await photo.arrayBuffer()), true);
      return json({ path, storage: "r2" });
    }
    const body = JSON.parse(new TextDecoder().decode(await readLimitedBody(req.body, 16384)));
    if (body.action === "check") {
      if (auth.role !== "admin") return json({ error: "Solo un administrador puede comprobar la configuración" }, 403);
      return json({ success: true, ...await checkPurchaseReceiptStorage() });
    }
    if (body.action === "migrate") {
      if (auth.role !== "admin") return json({ error: "Solo un administrador puede migrar respaldos" }, 403);
      const limit = Math.min(Math.max(Number(body.limit) || 5, 1), 10);
      const { data, error } = await auth.supabaseAdmin.rpc("list_purchase_receipts_for_r2", { p_limit: limit, p_after: typeof body.after === "string" ? body.after : "" });
      if (error) return json({ error: "No se pudo consultar los respaldos pendientes" }, 500);
      const results: { path: string; migrated: boolean; error?: string }[] = [];
      for (const row of data || []) {
        try { await migratePurchaseReceipt(auth.supabaseAdmin, row.path); results.push({ path: row.path, migrated: true }); }
        catch (cause) { results.push({ path: row.path, migrated: false, error: cause instanceof Error ? cause.message : "Migración incompleta" }); }
      }
      return json({ results, nextCursor: results.length === limit ? results.at(-1)?.path : null });
    }
    if (body.action !== "urls" || !Array.isArray(body.paths) || body.paths.length < 1 || body.paths.length > 20 || body.paths.some((path: unknown) => typeof path !== "string")) return json({ error: "Solicitud de respaldos inválida" }, 400);
    const userClient = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: auth.authHeader } }, auth: { persistSession: false, autoRefreshToken: false },
    });
    const results: { path: string; signedUrl: string; error?: string }[] = [];
    for (const path of [...new Set<string>(body.paths)]) {
      try {
        const identity = parsePurchaseReceiptPath(path);
        if (auth.role !== "admin" && identity.ownerId !== auth.user.id) {
          const { data, error } = await userClient.from("costs").select("id").contains("receipt_photo_paths", [path]).limit(1);
          if (error || !data?.length) { results.push({ path, signedUrl: "", error: "No autorizado para este respaldo" }); continue; }
        }
        const saved = await findPurchaseReceipt(auth.supabaseAdmin, path);
        if (saved) {
          const signedUrl = await createR2DownloadUrl(createR2Config(saved.r2_bucket), saved.r2_key, 600);
          results.push({ path, signedUrl });
        } else {
          const { data, error } = await auth.supabaseAdmin.storage.from("quick-entry-photos").createSignedUrl(path, 600);
          if (error || !data?.signedUrl) throw new Error("No se encontró el respaldo");
          results.push({ path, signedUrl: data.signedUrl });
        }
      } catch { results.push({ path, signedUrl: "", error: "No se pudo abrir el respaldo de la compra" }); }
    }
    return json({ data: results });
  } catch (cause) {
    console.error("[purchase-receipts] operación incompleta", cause instanceof Error ? cause.message : "error");
    return json({ error: cause instanceof Error ? cause.message : "No se pudo procesar el respaldo de la compra" }, 400);
  }
});

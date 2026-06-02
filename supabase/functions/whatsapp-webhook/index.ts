import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as _cors } from "../_shared/cors.ts";

const corsHeaders = { ..._cors, "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };

/**
 * Meta WhatsApp Cloud API webhook.
 * - GET: verifica el `hub.challenge` contra `WHATSAPP_VERIFY_TOKEN`.
 * - POST: actualiza `whatsapp_message_log` con estados `sent | delivered | read | failed`
 *         a partir del `provider_message_id` reportado por Meta.
 *
 * Configurar en Meta App → WhatsApp → Configuration → Webhook:
 *   Callback URL: https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook
 *   Verify token: el valor del secreto WHATSAPP_VERIFY_TOKEN
 *   Subscribir el campo `messages`.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const entries = Array.isArray(body?.entry) ? body.entry : [];
  let processed = 0;

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const statuses = Array.isArray(change?.value?.statuses) ? change.value.statuses : [];
      for (const st of statuses) {
        const providerId = st?.id as string | undefined;
        const status = st?.status as string | undefined; // sent | delivered | read | failed
        if (!providerId || !status) continue;

        const patch: Record<string, unknown> = { status };
        if (status === "failed") {
          const err = Array.isArray(st?.errors) ? st.errors[0] : null;
          if (err) {
            patch.error_code = String(err.code ?? "UNKNOWN");
            patch.error_message = String(err.title ?? err.message ?? "Meta reportó fallo");
          }
        }

        try {
          await supabase
            .from("whatsapp_message_log")
            .update(patch)
            .eq("provider_message_id", providerId);
          processed += 1;
        } catch (e) {
          console.warn("[whatsapp-webhook] update failed:", e);
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, processed }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const jsonResponse = (
  req: Request,
  body: Record<string, unknown>,
  status = 200,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
  });

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { repaired: false, error: "Metodo no permitido" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase environment variables are not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(req, { repaired: false, error: "Sesion no valida" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const token = authHeader.slice("Bearer ".length);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse(req, { repaired: false, error: "Sesion no valida" }, 401);
    }

    // La identidad se deriva siempre del JWT. La funcion SQL valida email,
    // vencimiento, rol solicitado y disponibilidad de la ficha de operador.
    const { data: repaired, error: repairError } = await supabaseAdmin.rpc(
      "repair_operator_invitation",
      { target_user_id: user.id },
    );
    if (repairError) throw repairError;

    return jsonResponse(req, {
      repaired: Boolean(repaired),
      reason: repaired ? "operator_invitation_accepted" : "no_valid_operator_invitation",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("Error in repair-invited-user-profile", message);
    return jsonResponse(req, { repaired: false, error: message }, 500);
  }
});

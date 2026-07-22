import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const jsonResponse = (req: Request, body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Método no permitido" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(req, { error: "Sesión no válida" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    if (body?.confirmation !== "ELIMINAR") {
      return jsonResponse(req, { error: "Confirmación de eliminación inválida" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse(req, { error: "La sesión expiró. Vuelve a iniciar sesión." }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // El avatar es el único archivo personal almacenado por la cuenta. Se
    // elimina antes de la transacción; si Storage falla, la cuenta permanece
    // activa y el usuario puede reintentar sin quedar en un estado intermedio.
    const { data: avatarFiles, error: avatarListError } = await adminClient.storage
      .from("avatars")
      .list(user.id, { limit: 100 });

    if (avatarListError && avatarListError.message !== "Bucket not found") {
      throw new Error("No se pudieron eliminar los archivos personales");
    }

    if (avatarFiles?.length) {
      const paths = avatarFiles.map((file) => `${user.id}/${file.name}`);
      const { error: avatarDeleteError } = await adminClient.storage.from("avatars").remove(paths);
      if (avatarDeleteError) {
        throw new Error("No se pudieron eliminar los archivos personales");
      }
    }

    // La identidad siempre se obtiene del JWT. Nunca se acepta un userId del
    // navegador, evitando que una cuenta intente borrar a otra.
    const { error: deletionError } = await adminClient.rpc("delete_account_permanently", {
      target_user_id: user.id,
    });

    if (deletionError) {
      console.error("delete_account_permanently failed", deletionError.code, deletionError.message);
      throw new Error("No se pudo completar la eliminación. Inténtalo nuevamente.");
    }

    return jsonResponse(req, {
      success: true,
      message: "Tu cuenta y tus datos personales fueron eliminados definitivamente.",
    }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("Error en delete-my-account:", message);
    return jsonResponse(req, { error: message }, 500);
  }
});

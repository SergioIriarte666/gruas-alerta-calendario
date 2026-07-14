import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AppRole = "admin" | "operator" | "viewer" | "client";
export type AuthorizationFailure = { response: Response };
export type AuthorizationSuccess = {
  authHeader: string;
  role: AppRole;
  supabaseAdmin: any;
  user: any;
};
export type RequireUserRolesResult = AuthorizationFailure | AuthorizationSuccess;

export const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const withHeaders = (response: Response, headers: Record<string, string>) => {
  const mergedHeaders = new Headers(response.headers);
  Object.entries(headers).forEach(([key, value]) => mergedHeaders.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: mergedHeaders,
  });
};

export async function requireUserRoles(
  req: Request,
  allowedRoles: AppRole[],
): Promise<RequireUserRolesResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      response: jsonResponse({ error: "No autorizado" }, 401),
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return {
      response: jsonResponse({ error: "Configuración de autenticación incompleta" }, 500),
    };
  }

  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !userData?.user) {
    return {
      response: jsonResponse({ error: "No autorizado" }, 401),
    };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  const role = profile?.role as AppRole | undefined;
  if (profileError || !role) {
    return {
      response: jsonResponse({ error: "No se pudo verificar el rol del usuario" }, 403),
    };
  }

  if (!allowedRoles.includes(role)) {
    return {
      response: jsonResponse({ error: "No autorizado para esta acción" }, 403),
    };
  }

  return {
    authHeader,
    role,
    supabaseAdmin,
    user: userData.user,
  };
}

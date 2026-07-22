import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { getCorsHeaders } from "../_shared/cors.ts";

type AppRole = "admin" | "operator" | "viewer" | "client";

interface InviteUserRequest {
  email?: string;
  fullName?: string;
  role?: AppRole;
  clientId?: string | null;
  operatorId?: string | null;
}

const VALID_ROLES = new Set<AppRole>(["admin", "operator", "viewer", "client"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const jsonResponse = (
  req: Request,
  body: Record<string, unknown>,
  status: number,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
  });

const resolveRedirectOrigin = (req: Request) => {
  const requestedOrigin = req.headers.get("origin") ?? "";
  const configuredOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "https://gruas5norte.cl";
  const isLocalDevelopment = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestedOrigin);

  return requestedOrigin === configuredOrigin || isLocalDevelopment
    ? requestedOrigin
    : configuredOrigin;
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Metodo no permitido" }, 405);
  }

  let createdUserId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase environment variables are not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(req, { error: "Sesion no valida" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.slice("Bearer ".length);
    const { data: { user: callerUser }, error: authError } =
      await supabaseAdmin.auth.getUser(token);
    if (authError || !callerUser) {
      return jsonResponse(req, { error: "Sesion no valida" }, 401);
    }

    const { data: callerRole, error: callerRoleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .eq("role", "admin")
      .maybeSingle();
    if (callerRoleError) throw callerRoleError;
    if (!callerRole) {
      return jsonResponse(req, { error: "Solo un administrador puede invitar usuarios" }, 403);
    }

    const body = await req.json().catch(() => ({})) as InviteUserRequest;
    const email = body.email?.trim().toLowerCase() ?? "";
    const fullName = body.fullName?.trim() ?? "";
    const role = body.role;
    const clientId = body.clientId || null;
    const operatorId = body.operatorId || null;

    if (!EMAIL_PATTERN.test(email)) {
      return jsonResponse(req, { error: "Email invalido" }, 400);
    }
    if (fullName.length < 3) {
      return jsonResponse(req, { error: "Nombre completo requerido" }, 400);
    }
    if (!role || !VALID_ROLES.has(role)) {
      return jsonResponse(req, { error: "Rol invalido" }, 400);
    }

    if (role === "operator") {
      if (!operatorId) {
        return jsonResponse(
          req,
          { error: "Debes seleccionar una ficha de operador para habilitar la autoaprobacion" },
          400,
        );
      }

      const { data: operator, error: operatorError } = await supabaseAdmin
        .from("operators")
        .select("id, user_id, is_active")
        .eq("id", operatorId)
        .maybeSingle();
      if (operatorError) throw operatorError;
      if (!operator || !operator.is_active) {
        return jsonResponse(req, { error: "La ficha de operador no existe o esta inactiva" }, 400);
      }
      if (operator.user_id) {
        return jsonResponse(req, { error: "La ficha de operador ya esta vinculada" }, 409);
      }
    } else if (operatorId) {
      return jsonResponse(req, { error: "Solo el rol operator puede vincular una ficha de operador" }, 400);
    }

    if (role === "client") {
      if (!clientId) {
        return jsonResponse(req, { error: "Debes seleccionar un cliente activo" }, 400);
      }
      const { data: client, error: clientError } = await supabaseAdmin
        .from("clients")
        .select("id, is_active")
        .eq("id", clientId)
        .eq("is_active", true)
        .maybeSingle();
      if (clientError) throw clientError;
      if (!client) {
        return jsonResponse(req, { error: "El cliente seleccionado no esta activo" }, 400);
      }
    } else if (clientId) {
      return jsonResponse(req, { error: "El cliente asociado solo corresponde al rol client" }, 400);
    }

    const redirectOrigin = resolveRedirectOrigin(req);
    const redirectTo = `${redirectOrigin}/auth?invited=true&setup_password=true`;
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          full_name: fullName,
          requested_role: role,
          invited: true,
        },
      });

    if (inviteError) {
      if (inviteError.message.includes("already been registered")) {
        return jsonResponse(req, { error: "Este email ya esta registrado en el sistema" }, 409);
      }
      throw inviteError;
    }
    if (!inviteData.user) {
      throw new Error("Supabase Auth no devolvio el usuario invitado");
    }

    createdUserId = inviteData.user.id;
    const { data: approvalStatus, error: finalizeError } = await supabaseAdmin.rpc(
      "finalize_user_invitation",
      {
        target_user_id: createdUserId,
        target_email: email,
        target_full_name: fullName,
        requested_role: role,
        target_client_id: clientId,
        target_operator_id: operatorId,
        invitation_creator_id: callerUser.id,
      },
    );

    if (finalizeError) {
      // La llamada Auth no comparte transaccion con Postgres. Si el bloque
      // atomico falla, compensamos eliminando el usuario recien creado para no
      // dejar cuentas parciales o sin invitacion valida.
      console.error("finalize_user_invitation failed", finalizeError.code, finalizeError.message);
      await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      await supabaseAdmin.from("profiles").delete().eq("id", createdUserId);
      createdUserId = null;
      throw new Error("No se pudo completar la invitacion de forma segura");
    }

    return jsonResponse(req, {
      success: true,
      userId: createdUserId,
      approvalStatus,
      message: role === "operator"
        ? `Operador invitado y aprobado automaticamente: ${email}`
        : `Invitacion enviada; la cuenta quedara pendiente de aprobacion: ${email}`,
    }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("Error in send-user-invitation", { message, createdUserId });
    return jsonResponse(req, { error: message }, 500);
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { corsHeaders } from "../_shared/cors.ts";

type AppRole = "admin" | "operator" | "viewer" | "client";

const ROLE_PRIORITY: AppRole[] = ["admin", "operator", "client", "viewer"];

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase environment variables are not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) {
      throw new Error("Invalid authentication");
    }

    const userId = authData.user.id;

    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("user_invitations")
      .select("user_id, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (invitationError) {
      throw invitationError;
    }

    if (!invitation || invitation.status === "expired") {
      return new Response(
        JSON.stringify({ repaired: false, reason: "no_active_invitation" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, status")
      .eq("id", userId)
      .single();

    if (profileError) {
      throw profileError;
    }

    if (profile.status === "rejected") {
      return new Response(
        JSON.stringify({ repaired: false, reason: "profile_rejected" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (roleError) {
      throw roleError;
    }

    const roleSet = new Set((roleRows ?? []).map((row: { role: AppRole }) => row.role));
    const resolvedRole =
      ROLE_PRIORITY.find((role) => roleSet.has(role)) ?? (profile.role as AppRole) ?? "viewer";

    const needsRepair = profile.status !== "approved" || profile.role !== resolvedRole;

    if (needsRepair) {
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
          status: "approved",
          role: resolvedRole,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) {
        throw updateError;
      }
    }

    if (invitation.status !== "accepted") {
      const { error: invitationUpdateError } = await supabaseAdmin
        .from("user_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (invitationUpdateError) {
        throw invitationUpdateError;
      }
    }

    return new Response(
      JSON.stringify({
        repaired: true,
        role: resolvedRole,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ repaired: false, error: message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
});

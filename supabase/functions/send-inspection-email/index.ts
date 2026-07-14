import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  sanitizeInspectionEmailAddress,
  sendInspectionEmailWithPdf,
  type InspectionEmailData,
} from "../_shared/email.ts";
import {
  acquireNotificationDedupe,
  notificationDedupeKey,
  releaseNotificationDedupe,
} from "../_shared/dedupe.ts";
import {
  getEmailNotificationGate,
  getInspectionEmailSkipReason,
} from "../_shared/emailSettings.ts";

interface InspectionEmailRequest {
  inspectionData: InspectionEmailData;
  pdfBlob: string;
}

const json = (body: unknown, status = 200, req: Request) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
});

const decodeBase64Pdf = (base64: string): Uint8Array =>
  Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "No autorizado" }, 401, req);
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Usuario no autenticado" }, 401, req);
    }

    const callerUid = (claimsData.claims as { sub?: string }).sub;
    if (!callerUid) {
      return json({ error: "Usuario no autenticado" }, 401, req);
    }

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: roleRows } = await supabaseService
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUid)
      .in("role", ["admin", "operator"]);
    if (!roleRows || roleRows.length === 0) {
      return json({ error: "No autorizado: se requiere rol de administrador u operador" }, 403, req);
    }

    const { inspectionData, pdfBlob }: InspectionEmailRequest = await req.json();
    if (!inspectionData?.serviceId || !inspectionData?.folio || !pdfBlob) {
      return json({ success: false, error: "inspectionData y pdfBlob son requeridos" }, 400, req);
    }

    sanitizeInspectionEmailAddress(inspectionData.clientEmail);

    const phase = inspectionData.phase === "final" ? "final" : "initial";
    const emailGate = await getEmailNotificationGate(supabaseService);
    const gateReason = getInspectionEmailSkipReason(
      phase === "final" ? "delivery_email" : "inspection_email",
      emailGate,
    );
    if (gateReason) {
      return json({ success: true, skipped: gateReason }, 200, req);
    }

    const { data: inspection, error: inspectionError } = await supabaseService
      .from("inspections")
      .select("id")
      .eq("service_id", inspectionData.serviceId)
      .maybeSingle();

    if (inspectionError || !inspection?.id) {
      return json({ success: false, error: "Inspección no encontrada para dedupe" }, 404, req);
    }

    const dedupeKind = phase === "final" ? "delivery_email" : "inspection_email";
    const alertKey = notificationDedupeKey(dedupeKind, inspection.id);
    const dedupe = await acquireNotificationDedupe(supabaseService, alertKey, {
      service_id: inspectionData.serviceId,
      inspection_id: inspection.id,
      folio: inspectionData.folio,
      phase,
      channel: "email",
      source: "send-inspection-email",
    });

    if (dedupe.duplicate) {
      return json({ success: true, skipped: "already_sent" }, 200, req);
    }
    if (!dedupe.acquired) {
      console.warn("[send-inspection-email] dedupe insert error:", dedupe.error);
      return json({ success: true, skipped: "dedupe_error" }, 200, req);
    }

    try {
      const pdfBytes = decodeBase64Pdf(pdfBlob);
      const result = await sendInspectionEmailWithPdf({ ...inspectionData, phase }, pdfBytes);
      return json({
        success: true,
        messageId: result.messageId,
        message: "Inspección enviada por email exitosamente",
      }, 200, req);
    } catch (sendError) {
      await releaseNotificationDedupe(supabaseService, alertKey);
      throw sendError;
    }
  } catch (error) {
    console.error("[send-inspection-email] Error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Error al enviar email de inspección",
    }, 500, req);
  }
};

serve(handler);

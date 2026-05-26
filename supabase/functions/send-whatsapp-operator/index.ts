import { requireUserRoles, withHeaders, jsonResponse } from "../_shared/auth.ts";
import { normalizeChileanPhone, sendWhatsAppTemplate } from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type OperatorWhatsAppRequest = {
  operatorId: string;
  folio: string;
  clientName: string;
  clientPhone: string;
  serviceDate: string;
  origin: string;
  destination: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authContext = await requireUserRoles(req, ["admin"]);
    if ("response" in authContext) {
      return withHeaders(authContext.response, corsHeaders);
    }

    // Respect notify_operator_assigned flag
    const { data: waSettings } = await authContext.supabaseAdmin
      .from("whatsapp_settings")
      .select("notify_operator_assigned")
      .limit(1)
      .maybeSingle();

    if (waSettings && (waSettings as any).notify_operator_assigned === false) {
      return withHeaders(
        jsonResponse({
          success: true,
          skipped: true,
          reason: "Notificación de operador desactivada en configuración",
        }),
        corsHeaders,
      );
    }

    const body: OperatorWhatsAppRequest = await req.json();
    const {
      operatorId,
      folio,
      clientName,
      clientPhone,
      serviceDate,
      origin,
      destination,
    } = body ?? ({} as OperatorWhatsAppRequest);

    if (!operatorId || !folio || !serviceDate) {
      return withHeaders(
        jsonResponse({ error: "operatorId, folio y serviceDate son requeridos" }, 400),
        corsHeaders,
      );
    }

    const { data: operator, error: operatorError } = await authContext.supabaseAdmin
      .from("operators")
      .select("name, phone")
      .eq("id", operatorId)
      .maybeSingle();

    if (operatorError) {
      return withHeaders(
        jsonResponse({ error: "No se pudo obtener el operador", details: operatorError }, 500),
        corsHeaders,
      );
    }

    const operatorName = (operator?.name || "Operador") as string;
    const operatorPhone = (operator?.phone || "").trim();
    if (!operatorPhone) {
      return withHeaders(
        jsonResponse({ success: false, code: "NO_PHONE", error: "Operador sin teléfono" }, 422),
        corsHeaders,
      );
    }

    const to = normalizeChileanPhone(operatorPhone);

    const formattedDate = new Date(serviceDate).toLocaleDateString("es-CL", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const result = await sendWhatsAppTemplate(to, "servicio_asignado", [
      operatorName,
      String(folio),
      formattedDate,
      origin || "",
      destination || "",
      clientName || "",
      clientPhone || "",
    ]);

    if (!result.success) {
      return withHeaders(
        jsonResponse({ success: false, error: result.error }, 502),
        corsHeaders,
      );
    }

    return withHeaders(
      jsonResponse({
        success: true,
        message: "WhatsApp enviado al operador",
        messageId: result.messageId,
      }),
      corsHeaders,
    );
  } catch (error) {
    return withHeaders(jsonResponse({ success: false, error }, 500), corsHeaders);
  }
});

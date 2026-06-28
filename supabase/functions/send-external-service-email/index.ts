import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@6";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface Body {
  serviceId: string;
  recipientEmail: string;
  recipientName?: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Usuario no autenticado" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      });
    }
    const callerUid = (claimsData.claims as any).sub as string;

    const body = (await req.json()) as Body;
    if (!body.serviceId || !body.recipientEmail) {
      return new Response(JSON.stringify({ error: "serviceId y recipientEmail son requeridos" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Validar admin
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUid)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Solo administradores pueden enviar el Acta" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      });
    }

    // Cargar closure + servicio
    const { data: closure, error: clErr } = await supabaseAdmin
      .from("service_external_closures")
      .select("id, pdf_path, third_party_provider_name, email_sent_to, email_send_count")
      .eq("service_id", body.serviceId)
      .single();
    if (clErr || !closure) {
      return new Response(JSON.stringify({ error: "El servicio no tiene cierre registrado" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      });
    }
    if (!closure.pdf_path) {
      return new Response(JSON.stringify({ error: "El Acta PDF aún no se ha generado" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      });
    }

    const { data: service } = await supabaseAdmin
      .from("services")
      .select("folio, service_date, clients(name)")
      .eq("id", body.serviceId)
      .single();

    // Descargar PDF
    const { data: pdfBlob, error: dlErr } = await supabaseAdmin.storage
      .from("external-evidence")
      .download(closure.pdf_path);
    if (dlErr || !pdfBlob) {
      return new Response(JSON.stringify({ error: "No se pudo recuperar el PDF" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      });
    }
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfArrayBuffer)));

    const folio = (service as any)?.folio ?? body.serviceId.slice(0, 8);
    const clientName = (service as any)?.clients?.name ?? "Cliente";
    const recipientName = body.recipientName ?? clientName;

    // Enviar email
    const emailRes = await resend.emails.send({
      from: "Gruas 5 Norte <asistencia@gruas5norte.cl>",
      to: [body.recipientEmail],
      subject: `Acta de Servicio Externo - Folio ${folio}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #783CB4; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Acta de Servicio Externo</h1>
          </div>
          <div style="padding: 24px; color: #333; line-height: 1.6;">
            <p>Estimado/a <strong>${recipientName}</strong>,</p>
            <p>Adjunto encontrará el Acta de Servicio Externo correspondiente al folio <strong>${folio}</strong>,
            ejecutado por nuestro proveedor asociado <strong>${closure.third_party_provider_name}</strong>.</p>
            <p>El documento contiene el detalle del trabajo realizado y la evidencia recibida.</p>
            <p style="margin-top: 24px;">Atentamente,<br/><strong>Gruas 5 Norte</strong></p>
          </div>
          <div style="background: #f5f5f5; padding: 12px; text-align: center; font-size: 11px; color: #666;">
            Panamericana Norte Km. 841, Copiapó · +56 9 62380627 · asistencia@gruas5norte.cl
          </div>
        </div>
      `,
      attachments: [{
        filename: `Acta-Servicio-Externo-${folio}.pdf`,
        content: pdfBase64,
      }],
    });

    if (emailRes.error) {
      return new Response(JSON.stringify({ error: emailRes.error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      });
    }

    // Tracking: append email + actualizar fecha
    const newList = Array.from(new Set([...(closure.email_sent_to || []), body.recipientEmail]));
    await supabaseAdmin
      .from("service_external_closures")
      .update({
        email_sent_to: newList,
        email_sent_at: new Date().toISOString(),
        email_send_count: (closure.email_send_count ?? 0) + 1,
      })
      .eq("id", closure.id);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  }
};

serve(handler);

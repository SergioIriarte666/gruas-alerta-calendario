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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Usuario no autenticado" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      });
    }
    const callerUid = (claimsData.claims as any).sub as string;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Validar admin via user_roles (no RPC - incompatible con service-role)
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

    const body = (await req.json()) as Body;
    if (!body.serviceId || !body.recipientEmail) {
      return new Response(JSON.stringify({ error: "serviceId y recipientEmail son requeridos" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      });
    }

    console.log(`[external-email] serviceId=${body.serviceId} → ${body.recipientEmail}`);

    // Cargar closure
    const { data: closure, error: clErr } = await supabaseAdmin
      .from("service_external_closures")
      .select("id, pdf_path, third_party_provider_name, email_sent_to, email_send_count")
      .eq("service_id", body.serviceId)
      .single();
    if (clErr || !closure) {
      console.error("[external-email] closure no encontrado:", clErr);
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

    // Cargar servicio — usar service_id del closure para garantizar coincidencia
    // Seleccionar también el folio directamente y loguearlo para diagnóstico
    const { data: service, error: svcErr } = await supabaseAdmin
      .from("services")
      .select("id, folio, service_date, clients(name)")
      .eq("id", body.serviceId)
      .maybeSingle();

    console.log(`[external-email] service query result:`, JSON.stringify(service), "error:", svcErr);

    // Derivar folio de forma robusta:
    // 1. Del campo folio del servicio
    // 2. Del pdf_path (actas/{folio}.pdf)
    // 3. Fallback: UUID parcial
    let folio: string;
    if (service?.folio) {
      folio = service.folio;
    } else if (closure.pdf_path) {
      // pdf_path = "actas/SRV-6808.pdf" → extraer "SRV-6808"
      const match = closure.pdf_path.match(/actas\/(.+)\.pdf$/);
      folio = match ? match[1] : body.serviceId.slice(0, 8);
    } else {
      folio = body.serviceId.slice(0, 8);
    }

    const clientName = (service as any)?.clients?.name ?? "Cliente";
    const recipientName = body.recipientName?.trim() || clientName;

    console.log(`[external-email] folio=${folio}, recipientName=${recipientName}`);

    // Descargar PDF desde Storage
    const { data: pdfBlob, error: dlErr } = await supabaseAdmin.storage
      .from("external-evidence")
      .download(closure.pdf_path);
    if (dlErr || !pdfBlob) {
      console.error("[external-email] error descargando PDF:", dlErr);
      return new Response(JSON.stringify({ error: "No se pudo recuperar el PDF" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      });
    }

    // Convertir PDF a bytes de forma segura (sin spread que causa stack overflow)
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
    const pdfBytes = Array.from(new Uint8Array(pdfArrayBuffer));
    console.log(`[external-email] PDF listo: ${pdfBytes.length} bytes. Enviando via Resend...`);

    // Enviar email
    const emailRes = await resend.emails.send({
      from: "Gruas 5 Norte <noreply@gruas5norte.cl>",
      to: [body.recipientEmail],
      reply_to: "asistencia@gruas5norte.cl",
      subject: `Acta de Servicio Externo - Folio ${folio}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #783CB4; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 22px;">Acta de Servicio Externo</h1>
          </div>
          <div style="padding: 24px; color: #333; line-height: 1.6;">
            <p>Estimado/a <strong>${recipientName}</strong>,</p>
            <p>Adjunto encontrará el Acta de Servicio Externo correspondiente al folio
            <strong>${folio}</strong>, ejecutado por nuestro proveedor asociado
            <strong>${closure.third_party_provider_name}</strong>.</p>
            <p>El documento contiene el detalle del trabajo realizado y la evidencia recibida.</p>
            <p>Para cualquier consulta, responda a este correo o escriba a
            <a href="mailto:asistencia@gruas5norte.cl">asistencia@gruas5norte.cl</a>.</p>
            <p style="margin-top: 24px;">Atentamente,<br/><strong>Gruas 5 Norte</strong></p>
          </div>
          <div style="background: #f5f5f5; padding: 12px; text-align: center; font-size: 11px; color: #666;">
            Panamericana Norte Km. 841, Copiapó · +56 9 62380627 · asistencia@gruas5norte.cl
          </div>
        </div>
      `,
      attachments: [{
        filename: `Acta-Servicio-Externo-${folio}.pdf`,
        content: pdfBytes,
      }],
    });

    if (emailRes.error) {
      console.error("[external-email] error Resend:", emailRes.error);
      return new Response(JSON.stringify({ error: emailRes.error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      });
    }

    console.log(`[external-email] enviado OK. Resend id: ${emailRes.data?.id}`);

    // Tracking: acumular emails enviados
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
    console.error("[external-email] error inesperado:", e);
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  }
};

serve(handler);


import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InspectionEmailRequest {
  inspectionData: {
    serviceId: string;
    folio: string;
    clientName: string;
    clientEmail: string;
    operatorName: string;
    serviceDate: string;
    equipmentCount: number;
  };
  pdfBlob: string; // Base64 encoded PDF
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📧 Iniciando envío de inspección por email");
    
    const { inspectionData, pdfBlob }: InspectionEmailRequest = await req.json();
    
    console.log("📋 Datos de inspección:", {
      folio: inspectionData.folio,
      clientEmail: inspectionData.clientEmail,
      serviceDate: inspectionData.serviceDate
    });

    // Validate email address
    if (!inspectionData.clientEmail || !inspectionData.clientEmail.includes('@')) {
      console.error("❌ Email inválido:", inspectionData.clientEmail);
      throw new Error("Email del cliente inválido");
    }

    // Convert base64 to buffer for attachment
    const pdfBuffer = Uint8Array.from(atob(pdfBlob), c => c.charCodeAt(0));
    console.log("📎 PDF buffer creado, tamaño:", pdfBuffer.length, "bytes");

    const emailResponse = await resend.emails.send({
      from: "Grúas 5 Norte <noreply@gruas5norte.cl>",
      to: [inspectionData.clientEmail],
      subject: `Reporte de Inspección Pre-Servicio - ${inspectionData.folio}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #0e7c7b; text-align: center;">REPORTE DE INSPECCIÓN PRE-SERVICIO</h1>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #333; margin-top: 0;">Estimado/a ${inspectionData.clientName},</h2>
            <p>Se ha completado exitosamente la inspección pre-servicio para su solicitud.</p>
            
            <h3 style="color: #0e7c7b;">Detalles del Servicio:</h3>
            <ul style="line-height: 1.6;">
              <li><strong>Folio:</strong> ${inspectionData.folio}</li>
              <li><strong>Fecha de Servicio:</strong> ${inspectionData.serviceDate}</li>
              <li><strong>Operador:</strong> ${inspectionData.operatorName}</li>
              <li><strong>Elementos Verificados:</strong> ${inspectionData.equipmentCount}</li>
            </ul>
            
            <p>Adjunto encontrará el reporte completo de inspección en formato PDF.</p>
            
            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
            
            <div style="text-align: center; color: #6c757d; font-size: 14px;">
              <p><strong>Grúas 5 Norte</strong></p>
              <p>Teléfono: +56 52 2353533</p>
              <p>Email: asistencia@gruas5norte.cl</p>
              <p>Copiapo, Chile</p>
            </div>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `Inspeccion-${inspectionData.folio}.pdf`,
          content: Array.from(pdfBuffer),
        },
      ],
    });

    if (emailResponse.error) {
      console.error("❌ Error enviando email:", emailResponse.error);
      throw new Error(`Error de Resend: ${emailResponse.error.message}`);
    }

    console.log("✅ Email enviado exitosamente:", emailResponse.data?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: emailResponse.data?.id,
        message: "Inspección enviada por email exitosamente" 
      }), 
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("💥 Error crítico en envío de email:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Error desconocido al enviar email" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

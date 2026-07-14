import { Resend } from "npm:resend@6";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export interface InspectionEmailData {
  serviceId: string;
  folio: string;
  clientName: string;
  clientEmail: string;
  operatorName: string;
  serviceDate: string;
  equipmentCount: number;
  phase?: "initial" | "final";
}

export interface InspectionEmailResult {
  success: boolean;
  messageId?: string;
}

export function sanitizeInspectionEmailAddress(email: string | null | undefined): string {
  const sanitized = email?.trim().toLowerCase() ?? "";
  if (!sanitized || !EMAIL_REGEX.test(sanitized)) {
    throw new Error("Formato de email inválido");
  }
  if (sanitized.length > 254) {
    throw new Error("Email demasiado largo");
  }
  return sanitized;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function sendInspectionEmailWithPdf(
  inspectionData: InspectionEmailData,
  pdfBytes: Uint8Array,
): Promise<InspectionEmailResult> {
  const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
  const sanitizedEmail = sanitizeInspectionEmailAddress(inspectionData.clientEmail);
  const isFinal = inspectionData.phase === "final";
  const reportLabel = isFinal ? "Entrega del Vehículo" : "Inspección Pre-Servicio";

  const emailResponse = await resend.emails.send({
    from: "Grúas 5 Norte <noreply@gruas5norte.cl>",
    to: [sanitizedEmail],
    subject: `Reporte de ${reportLabel} - ${inspectionData.folio}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0e7c7b; text-align: center;">REPORTE DE ${reportLabel.toUpperCase()}</h1>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Estimado/a ${inspectionData.clientName},</h2>
          <p>Se ha completado exitosamente ${isFinal ? "la entrega del vehículo" : "la inspección pre-servicio"} para su solicitud.</p>

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
        filename: `${isFinal ? "Entrega" : "Inspeccion"}-${inspectionData.folio}.pdf`,
        content: bytesToBase64(pdfBytes),
        contentType: "application/pdf",
      },
    ],
  });

  if (emailResponse.error) {
    throw new Error(`Error de Resend: ${emailResponse.error.message}`);
  }

  return { success: true, messageId: emailResponse.data?.id };
}

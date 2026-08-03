/**
 * Contenido y decisiones del correo de checklist, SIN dependencias de Deno ni de
 * Resend, para que se pueda probar desde la suite del front (vitest) igual que
 * cualquier otro módulo. `email.ts` importa Resend en el tope y por eso no es
 * testeable fuera del runtime de la edge function.
 */

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function isValidEmailAddress(email: string | null | undefined): boolean {
  const sanitized = email?.trim().toLowerCase() ?? "";
  return Boolean(sanitized) && sanitized.length <= 254 && EMAIL_REGEX.test(sanitized);
}

/**
 * `company_data.daily_report_emails` es TEXT, no un arreglo: puede traer varias
 * casillas separadas por coma y, con el tiempo, basura tecleada a mano. Se
 * descarta lo inválido en vez de reventar el envío completo — un destinatario
 * mal escrito no puede dejar sin correo a los que sí están bien.
 */
export function parseRecipientList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const candidate = part.trim().toLowerCase();
    if (isValidEmailAddress(candidate)) seen.add(candidate);
  }
  return [...seen];
}

export interface ChecklistDispatchInput {
  pdfUrl: string | null | undefined;
  recipients: string[];
}

/**
 * Motivo por el que NO corresponde enviar, o null si se puede.
 *
 * Sin PDF NO es un error: la generación pudo fallar después de la firma y se
 * reintenta desde el botón de la UI. Por eso devuelve un motivo de "skipped" y
 * no lanza; una excepción consumiría reintentos del outbox para nada.
 */
export function getChecklistDispatchSkipReason(
  input: ChecklistDispatchInput,
): "checklist_pdf_missing" | "no_recipient" | null {
  if (!input.pdfUrl) return "checklist_pdf_missing";
  if (input.recipients.length === 0) return "no_recipient";
  return null;
}

/**
 * Membrete de los informes. Es el MISMO archivo que usan los PDF
 * (DEFAULT_REPORT_LOGO_URL en src/utils/pdf/reportPdfTheme.ts): vive en el bucket
 * público `company-assets`, así que sirve como URL absoluta en un correo.
 *
 * Los dos valores están acoplados a mano porque una edge function no puede
 * importar desde src/. Si se cambia el logo allá, hay que cambiarlo acá.
 *
 * NO se usa LOCAL_REPORT_LOGO_URL ('/logo-gruas-5-norte.png'): es una ruta
 * relativa al sitio y en un correo no resuelve.
 */
export const DEFAULT_EMAIL_LOGO_URL =
  "https://jqszxljtfuknhuvuheko.supabase.co/storage/v1/object/public/company-assets/public/logo-9431b8dc-aa03-47c4-abac-e5b0cb843772-1783457114194-logo%20512x512.png?t=1784935057516";

/**
 * Identificador del logo cuando viaja INLINE dentro del mensaje.
 *
 * Un <img> con URL remota depende de que el cliente de correo acepte cargar
 * imágenes externas, y la mayoría las bloquea por defecto: por eso el primer
 * envío llegó sin membrete. Con `cid:` la imagen va adjunta en el propio correo
 * y se ve siempre, sin pedir permiso ni pasar por el proxy de Gmail.
 */
export const CHECKLIST_LOGO_CID = "logo-gruas5norte";

export interface ChecklistEmailContent {
  templateId: string;
  templateName: string;
  /** company_data.logo_url; si viene vacío se cae al membrete por defecto. */
  logoUrl?: string | null;
  /**
   * true cuando el logo se adjuntó inline. Si la descarga del archivo falla, se
   * queda en false y el <img> vuelve a la URL remota: un logo que no carga no
   * puede dejar sin correo a nadie.
   */
  logoInline?: boolean;
  operatorName: string;
  operatorRut?: string | null;
  licensePlate?: string | null;
  faena?: string | null;
  areaEmpresa?: string | null;
  performedDate: string;
  performedTime?: string | null;
  isSafeToOperate?: boolean | null;
}

export const PREOPERACIONAL_TEMPLATE_ID = "preoperacional_grua_cama";

export const UNSAFE_TO_OPERATE_HEADLINE = "EQUIPO DECLARADO NO APTO PARA OPERAR.";

const plateOf = (content: ChecklistEmailContent): string =>
  content.licensePlate?.trim() || "sin patente";

export function buildChecklistEmailSubject(content: ChecklistEmailContent): string {
  return `[Checklist] ${content.templateName} - ${plateOf(content)} - ${content.performedDate}`;
}

export function buildChecklistAttachmentName(content: ChecklistEmailContent): string {
  const shortLabel = content.templateId === PREOPERACIONAL_TEMPLATE_ID ? "Preoperacional" : "Fatiga";
  return `${shortLabel}-${plateOf(content).replace(/\s+/g, "-")}-${content.performedDate}.pdf`;
}

const listRow = (label: string, value: string | null | undefined): string =>
  value ? `<li><strong>${label}:</strong> ${value}</li>` : "";

export function buildChecklistEmailHtml(content: ChecklistEmailContent): string {
  // El equipo declarado NO APTO es el dato que justifica que este correo exista:
  // va destacado arriba de todo, no perdido entre los antecedentes.
  const unsafeBanner = content.isSafeToOperate === false
    ? `
          <div style="background-color: #fdecea; border-left: 4px solid #b43232; padding: 14px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 0; color: #8a2020; font-size: 15px;">
              <strong>${UNSAFE_TO_OPERATE_HEADLINE}</strong><br>
              El operador respondió que el camión NO se encuentra en condiciones seguras
              para operar. Revise el detalle en el PDF adjunto.
            </p>
          </div>`
    : "";

  // width/height como atributos ADEMÁS del style: Outlook ignora buena parte del
  // CSS y sin ellos el logo sale a tamaño original. El alt cubre el caso de que
  // ni siquiera el inline cargue.
  const logoSrc = content.logoInline
    ? `cid:${CHECKLIST_LOGO_CID}`
    : (content.logoUrl?.trim() || DEFAULT_EMAIL_LOGO_URL);
  const logo = `
          <img src="${logoSrc}"
               alt="Grúas 5 Norte"
               width="96" height="96"
               style="display: block; margin: 0 auto 12px; width: 96px; height: auto; max-width: 96px; border: 0;">`;

  return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
${logo}
        <h1 style="color: #0e7c7b; text-align: center;">CHECKLIST DE SEGURIDAD</h1>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">${content.templateName}</h2>
${unsafeBanner}
          <h3 style="color: #0e7c7b;">Antecedentes:</h3>
          <ul style="line-height: 1.6;">
            <li><strong>Operador:</strong> ${content.operatorName}</li>
            ${listRow("RUT operador", content.operatorRut)}
            ${listRow("Grúa / Patente", content.licensePlate?.trim())}
            ${listRow("Faena", content.faena)}
            ${listRow("Área / Empresa", content.areaEmpresa)}
            <li><strong>Fecha:</strong> ${content.performedDate}</li>
            ${listRow("Hora", content.performedTime)}
          </ul>

          <p>Adjunto encontrará el checklist completo en formato PDF.</p>

          <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">

          <div style="text-align: center; color: #6c757d; font-size: 14px;">
            <p><strong>Grúas 5 Norte</strong></p>
            <p>Teléfono: +56 52 2353533</p>
            <p>Email: asistencia@gruas5norte.cl</p>
            <p>Copiapo, Chile</p>
          </div>
        </div>
      </div>
    `;
}

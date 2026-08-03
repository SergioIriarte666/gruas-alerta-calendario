import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ChecklistPDF');

/**
 * Bucket propio, no `inspection-pdfs`: los crones de archivado a R2 y de purga
 * apuntan a inspecciones y mezclar los objetos rompería esa retención.
 */
export const CHECKLIST_PDF_BUCKET = 'checklist-pdfs';

const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7; // 7 días

const sanitizePathSegment = (value: string): string =>
  value.trim().replace(/[\\/?#%]+/g, '-').replace(/\s+/g, '-');

/**
 * Hash corto DETERMINISTA del documento.
 *
 * Deliberadamente no es aleatorio: al regenerar, la ruta tiene que ser la misma
 * para que `upsert: true` reemplace el objeto en vez de dejar copias huérfanas
 * acumulándose en el bucket.
 */
export const shortChecklistHash = (checklistId: string, templateId: string): string => {
  const seed = `${checklistId}:${templateId}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

export const buildChecklistPdfPath = (
  checklistId: string,
  templateId: string,
  performedDate: string,
): string =>
  `${checklistId}/${sanitizePathSegment(templateId)}-${sanitizePathSegment(performedDate)}-${shortChecklistHash(checklistId, templateId)}.pdf`;

export interface ChecklistPdfUploadResult {
  path: string;
  signedUrl: string;
}

/**
 * Sube el PDF con upsert. El bucket tiene política de UPDATE desde el día uno
 * (Fase 1), así que regenerar no rebota con "violates row-level security".
 */
export const uploadChecklistPdf = async (
  pdfBlob: Blob,
  checklistId: string,
  templateId: string,
  performedDate: string,
): Promise<ChecklistPdfUploadResult> => {
  const path = buildChecklistPdfPath(checklistId, templateId, performedDate);

  const { error: uploadError } = await supabase.storage
    .from(CHECKLIST_PDF_BUCKET)
    .upload(path, pdfBlob, { contentType: 'application/pdf', upsert: true });

  if (uploadError) {
    logger.error('Error subiendo PDF de checklist:', { path, error: uploadError.message });
    throw new Error(`No se pudo subir el PDF del checklist: ${uploadError.message}`);
  }

  const { data, error: urlError } = await supabase.storage
    .from(CHECKLIST_PDF_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);

  if (urlError || !data?.signedUrl) {
    logger.error('Error generando signed URL del PDF de checklist:', urlError?.message);
    throw new Error(`No se pudo generar la URL del PDF: ${urlError?.message || 'sin URL'}`);
  }

  logger.debug('PDF de checklist subido', { path });
  return { path, signedUrl: data.signedUrl };
};

/** URL firmada a demanda: el bucket es privado, la URL guardada caduca. */
export const getChecklistPdfSignedUrl = async (path: string): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(CHECKLIST_PDF_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) {
    logger.error('Error generando signed URL del PDF de checklist:', error?.message);
    throw new Error(`No se pudo generar la URL del PDF: ${error?.message || 'sin URL'}`);
  }

  return data.signedUrl;
};

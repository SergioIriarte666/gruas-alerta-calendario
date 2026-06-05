import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('InspectionPdfUpload');
const BUCKET = 'inspection-pdfs';
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7; // 7 días

export interface UploadResult {
  signedUrl: string;
  path: string;
}

export const uploadInspectionPdf = async (
  pdfBlob: Blob,
  serviceId: string,
  folio: string,
): Promise<UploadResult | null> => {
  try {
    const date = new Date().toISOString().slice(0, 10);
    const path = `${serviceId}/${folio}-${date}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, pdfBlob, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      logger.error('Error subiendo PDF:', uploadError.message);
      return null;
    }

    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_SECONDS);

    if (!data?.signedUrl) {
      logger.error('No se pudo generar signed URL para el PDF');
      return null;
    }

    logger.debug(`PDF subido: ${path}`);
    return { signedUrl: data.signedUrl, path };
  } catch (err) {
    logger.error('uploadInspectionPdf error:', err);
    return null;
  }
};

export const savePdfUrlToInspection = async (
  serviceId: string,
  pdfUrl: string,
  phase: 'initial' | 'final' = 'final',
): Promise<void> => {
  const updatePayload = phase === 'initial'
    ? { pdf_retiro_url: pdfUrl, pdf_retiro_uploaded_at: new Date().toISOString() }
    : { pdf_url: pdfUrl, pdf_uploaded_at: new Date().toISOString() };

  const { error } = await supabase
    .from('inspections')
    .update(updatePayload)
    .eq('service_id', serviceId);

  if (error) logger.warn(`No se pudo guardar pdf_url (${phase}) en inspections:`, error.message);
};

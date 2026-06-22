import { businessClock } from '@/utils/businessClock';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('InspectionPdfUpload');
export const PDF_BUCKET = 'inspection-pdfs';
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7; // 7 días

export interface UploadResult {
  signedUrl: string;
  path: string;
}

export const uploadInspectionPdf = async (
  pdfBlob: Blob,
  serviceId: string,
  folio: string,
): Promise<UploadResult> => {
  const date = businessClock.today();
  const path = `${serviceId}/${folio}-${date}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(PDF_BUCKET)
    .upload(path, pdfBlob, { contentType: 'application/pdf', upsert: true });

  if (uploadError) {
    logger.error('Error subiendo PDF:', uploadError.message);
    throw new Error(`Error al subir el PDF a Storage: ${uploadError.message}`);
  }

  const { data, error: urlError } = await supabase.storage
    .from(PDF_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);

  if (urlError || !data?.signedUrl) {
    logger.error('Error generando signed URL del PDF:', urlError?.message);
    throw new Error(`No se pudo generar la URL del PDF: ${urlError?.message || 'sin URL'}`);
  }

  logger.debug(`PDF subido: ${path}`);
  return { signedUrl: data.signedUrl, path };
};

export const getInspectionPdfSignedUrl = async (path: string): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(PDF_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) {
    logger.error('Error generando signed URL del PDF:', error?.message);
    throw new Error(`No se pudo generar la URL del PDF: ${error?.message || 'sin URL'}`);
  }

  return data.signedUrl;
};

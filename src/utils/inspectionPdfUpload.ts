import { businessClock } from '@/utils/businessClock';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { toast } from 'sonner';

const logger = createLogger('InspectionPdfUpload');
export const PDF_BUCKET = 'inspection-pdfs';
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7; // 7 días

export interface UploadResult {
  signedUrl: string;
  path: string;
}

const sanitizePathSegment = (value: string): string =>
  value.trim().replace(/[\/\\?#%]+/g, '-').replace(/\s+/g, '-');

const buildInspectionPdfPath = (
  serviceId: string,
  folio: string,
  kind: 'inicial' | 'entrega',
): string => {
  const timestamp = businessClock.nowISO().replace(/[:.]/g, '-');
  const uuidShort = crypto.randomUUID().slice(0, 8);
  return `${serviceId}/${sanitizePathSegment(folio)}-inspeccion-${kind}-${timestamp}-${uuidShort}.pdf`;
};

const storageObjectExists = async (path: string): Promise<boolean> => {
  const lastSlash = path.lastIndexOf('/');
  const folder = lastSlash >= 0 ? path.slice(0, lastSlash) : '';
  const fileName = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;

  const { data, error } = await supabase.storage
    .from(PDF_BUCKET)
    .list(folder, { limit: 100, search: fileName });

  if (error) {
    logger.warn('No se pudo verificar existencia de PDF en Storage:', { path, error: error.message });
    return false;
  }

  return Boolean(data?.some((item) => item.name === fileName));
};

const isMaskedDuplicateStorageError = async (errorMessage: string, path: string): Promise<boolean> => {
  if (!errorMessage.toLowerCase().includes('violates row-level security policy')) {
    return false;
  }
  return storageObjectExists(path);
};

const uploadPdfAtPath = async (pdfBlob: Blob, path: string): Promise<void> => {
  const { error: uploadError } = await supabase.storage
    .from(PDF_BUCKET)
    .upload(path, pdfBlob, { contentType: 'application/pdf', upsert: false });

  if (uploadError) {
    throw uploadError;
  }
};

export const uploadInspectionPdf = async (
  pdfBlob: Blob,
  serviceId: string,
  folio: string,
  kind: 'inicial' | 'entrega',
): Promise<UploadResult> => {
  let path = buildInspectionPdfPath(serviceId, folio, kind);

  try {
    await uploadPdfAtPath(pdfBlob, path);
  } catch (uploadError) {
    const message = uploadError instanceof Error ? uploadError.message : String(uploadError);
    const shouldRetry = await isMaskedDuplicateStorageError(message, path);

    if (!shouldRetry) {
      logger.error('Error subiendo PDF:', message);
      throw new Error(`Error al subir el PDF a Storage: ${message}`);
    }

    toast.error('Conflicto de archivo en Storage. Reintentando con nombre único...');
    const originalMessage = message;
    path = buildInspectionPdfPath(serviceId, folio, kind);

    try {
      await uploadPdfAtPath(pdfBlob, path);
    } catch (retryError) {
      const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
      logger.error('Error subiendo PDF tras reintento:', { originalMessage, retryMessage, path });
      throw new Error(`Error al subir el PDF a Storage: ${originalMessage}`);
    }
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

export const deleteInspectionPdf = async (path: string): Promise<void> => {
  const { error } = await supabase.storage.from(PDF_BUCKET).remove([path]);
  if (error) {
    logger.error('Error eliminando PDF de inspección:', { path, error: error.message });
    throw new Error(`No se pudo eliminar el PDF ${path}: ${error.message}`);
  }
  logger.debug(`PDF eliminado: ${path}`);
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

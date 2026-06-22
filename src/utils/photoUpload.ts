import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('PhotoUpload');
export const PHOTO_BUCKET = 'inspection-photos';
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7; // 7 días

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
};

/**
 * Sube la foto a Storage y devuelve el PATH del objeto (no una signed URL): la evidencia
 * puede consultarse meses después de subida, mucho después de que cualquier token expire.
 */
export const uploadInspectionPhoto = async (
  fileName: string,
  dataUrl: string,
  serviceId: string
): Promise<string> => {
  const blob = dataUrlToBlob(dataUrl);
  const path = `${serviceId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });

  if (uploadError) {
    logger.error('Error subiendo foto a storage:', uploadError.message);
    throw new Error(`Error al subir foto ${fileName}: ${uploadError.message}`);
  }

  logger.debug(`Foto subida: ${path}`);
  return path;
};

export const getInspectionPhotoSignedUrl = async (path: string): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) {
    logger.error('Error generando signed URL de foto:', error?.message);
    throw new Error(`No se pudo generar la URL de la foto: ${error?.message || 'sin URL'}`);
  }

  return data.signedUrl;
};

export const deleteInspectionPhoto = async (
  fileName: string,
  serviceId: string
): Promise<void> => {
  const path = `${serviceId}/${fileName}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  if (error) logger.warn(`No se pudo eliminar foto del bucket: ${path}`, error.message);
};

import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('PhotoUpload');
export const PHOTO_BUCKET = 'inspection-photos';
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7; // 7 días

/**
 * Sube la foto a Storage y devuelve el PATH del objeto (no una signed URL): la evidencia
 * puede consultarse meses después de subida, mucho después de que cualquier token expire.
 *
 * Recibe el Blob comprimido directamente (nunca un data: URL): evita el round-trip
 * atob→Uint8Array que materializaba una copia completa en memoria por cada subida.
 */
export const uploadInspectionPhoto = async (
  fileName: string,
  photoBlob: Blob,
  serviceId: string
): Promise<string> => {
  const path = `${serviceId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, photoBlob, { upsert: true, contentType: photoBlob.type || 'image/jpeg' });

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

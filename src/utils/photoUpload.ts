import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('PhotoUpload');
const BUCKET = 'inspection-photos';

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

export const uploadInspectionPhoto = async (
  fileName: string,
  dataUrl: string,
  serviceId: string
): Promise<string> => {
  const blob = dataUrlToBlob(dataUrl);
  const path = `${serviceId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });

  if (uploadError) {
    logger.error('Error subiendo foto a storage:', uploadError.message);
    throw new Error(`Error al subir foto ${fileName}: ${uploadError.message}`);
  }

  const { data, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 días

  if (urlError || !data?.signedUrl) {
    logger.error('Error generando signed URL de foto:', urlError?.message);
    throw new Error(`No se pudo generar la URL de la foto ${fileName}: ${urlError?.message || 'sin URL'}`);
  }

  logger.debug(`Foto subida: ${path}`);
  return data.signedUrl;
};

export const deleteInspectionPhoto = async (
  fileName: string,
  serviceId: string
): Promise<void> => {
  const path = `${serviceId}/${fileName}`;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) logger.warn(`No se pudo eliminar foto del bucket: ${path}`, error.message);
};

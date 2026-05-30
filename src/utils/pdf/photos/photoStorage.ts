import { createLogger } from '@/lib/logger';

const logger = createLogger('PdfPhotoStorage');

/**
 * Obtiene una foto para el PDF.
 * Prioridad: storageUrl (Supabase) → localStorage (caché local).
 */
export const getPhotoFromStorage = (
  photoName: string,
  storageUrl?: string
): string | null => {
  // Prioridad 1: URL de Supabase Storage
  if (storageUrl) return storageUrl;

  if (!photoName || typeof photoName !== 'string') {
    logger.warn(`Nombre de foto inválido: ${photoName}`);
    return null;
  }

  // Prioridad 2: localStorage (compatibilidad con fotos anteriores)
  const localData =
    localStorage.getItem(`photo-${photoName}`) ??
    localStorage.getItem(photoName);

  logger.debug(`Buscando foto: photo-${photoName}, encontrada: ${!!localData}`);

  return localData?.startsWith('data:image') ? localData : null;
};

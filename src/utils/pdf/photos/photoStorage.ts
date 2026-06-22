import { createLogger } from '@/lib/logger';

const logger = createLogger('PdfPhotoStorage');

/**
 * Obtiene una foto para el PDF.
 * Prioridad: localStorage (data: URL, jsPDF la puede embeber directamente) → storageUrl (Supabase, fallback).
 * Nunca priorizar storageUrl: jsPDF.addImage no puede cargar una URL remota sin pre-cargarla,
 * así que pasarla directo produce una imagen vacía/placeholder en el PDF.
 */
export const getPhotoFromStorage = (
  photoName: string,
  storageUrl?: string
): string | null => {
  if (photoName && typeof photoName === 'string') {
    const localData =
      localStorage.getItem(`photo-${photoName}`) ??
      localStorage.getItem(photoName);

    logger.debug(`Buscando foto: photo-${photoName}, encontrada en caché local: ${!!localData}`);

    if (localData?.startsWith('data:image')) {
      return localData;
    }
  } else {
    logger.warn(`Nombre de foto inválido: ${photoName}`);
  }

  // Fallback: si no hay caché local (ej. recarga de página), usar storageUrl.
  return storageUrl ?? null;
};

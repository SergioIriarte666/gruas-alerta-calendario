import { createLogger } from '@/lib/logger';
import { loadInspectionPhotoBlob } from '@/utils/inspectionPhotoDb';
import { getInspectionPhotoSignedUrl } from '@/utils/photoUpload';
import { extractStoragePath } from '@/utils/storagePath';
import { PHOTO_BUCKET } from '@/utils/photoUpload';

const logger = createLogger('PdfPhotoStorage');

/**
 * Obtiene el Blob de una foto para embeber en el PDF.
 * Prioridad: caché local en IndexedDB (misma sesión de captura) → storageUrl (Supabase,
 * fallback cuando no hay caché local, ej. recarga de página o entrega en otro dispositivo).
 * Nunca retorna un data: URL: el llamador decide si necesita convertir a Uint8Array.
 */
export const getPhotoBlobForPdf = async (
  photoName: string,
  storageUrl?: string,
  blob?: Blob,
): Promise<Blob | null> => {
  if (blob) return blob;

  if (photoName) {
    const cached = await loadInspectionPhotoBlob(photoName).catch((error) => {
      logger.warn(`Error leyendo foto ${photoName} de IndexedDB:`, error);
      return null;
    });

    if (cached) {
      logger.debug(`Foto encontrada en caché local: ${photoName}`);
      return cached;
    }
  } else {
    logger.warn(`Nombre de foto inválido: ${photoName}`);
  }

  if (!storageUrl) return null;

  try {
    // El path de Storage (persistido en `inspections`) no tiene protocolo. Algunos
    // flujos administrativos (regeneración de PDF) pasan en cambio una URL ya
    // firmada o un data: URL directamente utilizable — en ese caso se descarga tal cual.
    const extractedPath = extractStoragePath(storageUrl, PHOTO_BUCKET);
    const fetchableUrl = extractedPath
      ? await getInspectionPhotoSignedUrl(extractedPath)
      : storageUrl.startsWith('data:') || storageUrl.startsWith('http')
        ? storageUrl
        : await getInspectionPhotoSignedUrl(storageUrl);

    const response = await fetch(fetchableUrl);
    if (!response.ok) throw new Error(`No se pudo descargar la foto (${response.status})`);
    return await response.blob();
  } catch (error) {
    logger.warn(`No se pudo recuperar la foto ${photoName} desde Storage:`, error);
    return null;
  }
};

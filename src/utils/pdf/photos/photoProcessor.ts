import { createLogger } from '@/lib/logger';
import { compressImage } from '@/utils/imageCompression';

const logger = createLogger('PdfPhotoProcessor');

/**
 * Comprime un Blob de imagen para incluirlo en el PDF (máx. 600x450, JPEG q0.85).
 * Trabaja siempre sobre Blob/Uint8Array, nunca sobre un data: URL completo: convertir
 * cada foto a base64 de a una — y liberar el Blob de origen apenas se usa — es lo que
 * mantiene la memoria plana al generar un PDF con 12+ fotos en iOS.
 */
export const compressBlobForPDF = async (blob: Blob): Promise<Blob> => {
  try {
    return await compressImage(blob, { maxDimension: 600, quality: 0.85 });
  } catch (error) {
    logger.warn('Error comprimiendo foto para PDF, se usará el blob original', error);
    return blob;
  }
};

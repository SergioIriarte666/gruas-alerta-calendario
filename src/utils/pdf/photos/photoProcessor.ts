import { createLogger } from '@/lib/logger';

const logger = createLogger('PdfPhotoProcessor');

/**
 * Comprime una imagen para incluirla en el PDF.
 * - Si imageData es un data: URL → comprime con canvas (seguro, mismo origen).
 * - Si es https:// → devuelve tal cual (canvas con URL externa tainea el contexto).
 */
export const compressImageForPDF = async (imageData: string): Promise<string> => {
  // URL externa: no pasar por canvas para evitar SecurityError
  if (!imageData.startsWith('data:')) {
    logger.debug('Imagen externa, saltando compresión de canvas:', imageData.slice(0, 60));
    return imageData;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            resolve(imageData);
            return;
          }

          const maxWidth = 600;
          const maxHeight = 450;
          let { width, height } = img;

          if (width > height) {
            if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
          } else {
            if (height > maxHeight) { width = (width * maxHeight) / height; height = maxHeight; }
          }

          canvas.width = width;
          canvas.height = height;

          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          try {
            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            logger.debug(`Imagen comprimida: ${imageData.length} → ${compressed.length} chars`);
            resolve(compressed);
          } catch (securityErr) {
            logger.warn('Canvas tainted, devolviendo imagen original');
            resolve(imageData);
          }
        } catch {
          logger.warn('Error en compresión, usando original');
          resolve(imageData);
        }
      };

      img.onerror = () => {
        logger.warn('Error cargando imagen para compresión');
        resolve(imageData);
      };

      img.src = imageData;
    } catch {
      resolve(imageData);
    }
  });
};

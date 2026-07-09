import { createLogger } from '@/lib/logger';

const logger = createLogger('ImageCompression');

export interface CompressImageOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: string;
}

/**
 * Comprime una imagen a un Blob usando createImageBitmap + canvas, sin pasar nunca
 * por un string base64 completo. Libera explícitamente el bitmap y el canvas al
 * terminar: en WKWebView (iOS) retener varias imágenes full-res decodificadas
 * simultáneamente es la causa más común de crash por presión de memoria.
 */
export const compressImage = async (
  input: Blob | File,
  options: CompressImageOptions = {},
): Promise<Blob> => {
  const { maxDimension = 1600, quality = 0.6, mimeType = 'image/jpeg' } = options;

  const bitmap = await createImageBitmap(input);

  try {
    let { width, height } = bitmap;

    if (width > height) {
      if (width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      }
    } else if (height > maxDimension) {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }

    const useOffscreen = typeof OffscreenCanvas !== 'undefined';
    const canvas = useOffscreen ? new OffscreenCanvas(width, height) : document.createElement('canvas');
    if (!useOffscreen) {
      (canvas as HTMLCanvasElement).width = width;
      (canvas as HTMLCanvasElement).height = height;
    }

    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) {
      throw new Error('No se pudo crear el contexto del canvas para comprimir la imagen');
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = useOffscreen
      ? await (canvas as OffscreenCanvas).convertToBlob({ type: mimeType, quality })
      : await new Promise<Blob>((resolve, reject) => {
          (canvas as HTMLCanvasElement).toBlob(
            (result) => (result ? resolve(result) : reject(new Error('No se pudo generar el blob comprimido'))),
            mimeType,
            quality,
          );
        });

    // Liberar referencias de inmediato en lugar de esperar al GC.
    if (useOffscreen) {
      (canvas as OffscreenCanvas).width = 0;
      (canvas as OffscreenCanvas).height = 0;
    } else {
      (canvas as HTMLCanvasElement).width = 0;
      (canvas as HTMLCanvasElement).height = 0;
    }

    logger.debug(`Imagen comprimida: ${width}x${height}, ${Math.round(blob.size / 1024)} KB`);
    return blob;
  } finally {
    bitmap.close();
  }
};

import { createLogger } from '@/lib/logger';

const logger = createLogger('ImageCompression');

export interface CompressImageOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: string;
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

const decodeWithImageElement = async (input: Blob | File): Promise<DecodedImage> => {
  const objectUrl = URL.createObjectURL(input);
  const image = new Image();
  image.decoding = 'async';

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Safari no pudo decodificar la fotografía (${input.type || 'formato desconocido'})`));
      image.src = objectUrl;
    });

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => {
        image.src = '';
        URL.revokeObjectURL(objectUrl);
      },
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
};

const decodeImage = async (input: Blob | File): Promise<DecodedImage> => {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(input, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch (error) {
      // Safari/iOS puede exponer createImageBitmap pero rechazar capturas HEIC. El
      // elemento <img> usa el decodificador nativo de WebKit y cubre ese caso.
      logger.warn('createImageBitmap rechazó la captura; usando decodificador compatible con Safari', error);
    }
  }

  return decodeWithImageElement(input);
};

/**
 * Comprime una imagen a un Blob sin pasar nunca por un string base64 completo.
 * Intenta createImageBitmap y usa el decodificador nativo de WebKit como fallback
 * para capturas HEIC/iPhone. Libera explícitamente imagen y canvas al terminar.
 */
export const compressImage = async (
  input: Blob | File,
  options: CompressImageOptions = {},
): Promise<Blob> => {
  const { maxDimension = 1600, quality = 0.6, mimeType = 'image/jpeg' } = options;

  const decoded = await decodeImage(input);

  try {
    let { width, height } = decoded;

    if (!width || !height) {
      throw new Error('La fotografía no contiene dimensiones válidas');
    }

    if (width > height) {
      if (width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      }
    } else if (height > maxDimension) {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }

    // HTMLCanvasElement tiene soporte más consistente que OffscreenCanvas en iOS.
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo crear el contexto del canvas para comprimir la imagen');
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(decoded.source, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('No se pudo generar el blob comprimido'))),
        mimeType,
        quality,
      );
    });

    canvas.width = 0;
    canvas.height = 0;

    logger.debug(`Imagen comprimida: ${width}x${height}, ${Math.round(blob.size / 1024)} KB`);
    return blob;
  } finally {
    decoded.release();
  }
};

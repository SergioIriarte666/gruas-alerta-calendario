import { businessClock } from '@/utils/businessClock';
import { compressImage } from '@/utils/imageCompression';

export class PhotoProcessor {
  static generateFileName(prefix: string): string {
    const timestamp = businessClock.nowISO().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(7);
    return `${prefix}-${timestamp}-${random}.jpg`;
  }

  /**
   * Comprime la imagen capturada (máx. 1600px de lado mayor, JPEG q0.6) y devuelve
   * un Blob, nunca un base64 completo: retener dataURLs full-res en memoria fue la
   * causa del crash por presión de memoria en iOS.
   */
  static async processImage(source: Blob | File, titlePrefix: string): Promise<{ name: string; blob: Blob }> {
    const blob = await compressImage(source, { maxDimension: 1600, quality: 0.6 });
    const name = this.generateFileName(titlePrefix.toLowerCase().replace(/\s+/g, '-'));
    return { name, blob };
  }

  static validateImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }
}

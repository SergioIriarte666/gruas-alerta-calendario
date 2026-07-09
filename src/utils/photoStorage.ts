import { PhotoData } from '@/types/photo';
import { createLogger } from '@/lib/logger';
import { saveInspectionPhotoBlob, loadInspectionPhotoBlob, removeInspectionPhotoBlob } from '@/utils/inspectionPhotoDb';

const logger = createLogger('PhotoStorage');

export class PhotoStorage {
  static async save(photo: { name: string; blob: Blob }): Promise<void> {
    await saveInspectionPhotoBlob(photo.name, photo.blob);
    logger.debug(`Foto guardada en IndexedDB: ${photo.name} (${Math.round(photo.blob.size / 1024)} KB)`);
  }

  static async load(photoName: string): Promise<PhotoData | null> {
    const blob = await loadInspectionPhotoBlob(photoName);
    if (!blob) return null;
    return { name: photoName, blob, previewUrl: URL.createObjectURL(blob) };
  }

  static async loadMultiple(photoNames: string[]): Promise<PhotoData[]> {
    const loadedPhotos: PhotoData[] = [];

    for (const photoName of photoNames) {
      const photo = await this.load(photoName);
      if (photo) {
        loadedPhotos.push(photo);
      }
    }

    return loadedPhotos;
  }

  static async exists(photoName: string): Promise<boolean> {
    const blob = await loadInspectionPhotoBlob(photoName);
    return !!blob;
  }

  static async remove(photoName: string): Promise<void> {
    await removeInspectionPhotoBlob(photoName);
    logger.debug(`Foto eliminada de IndexedDB: ${photoName}`);
  }

  static async saveMultiple(photos: { name: string; blob: Blob }[]): Promise<void> {
    for (const photo of photos) {
      await this.save(photo);
    }
  }
}

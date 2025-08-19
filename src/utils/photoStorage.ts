
import { PhotoData } from '@/types/photo';

export class PhotoStorage {
  static save(photo: PhotoData): void {
    localStorage.setItem(`photo-${photo.name}`, photo.dataUrl);
    console.log(`Saved photo to localStorage: photo-${photo.name}`);
  }

  static load(photoName: string): PhotoData | null {
    const storedPhoto = localStorage.getItem(`photo-${photoName}`);
    if (storedPhoto) {
      return { name: photoName, dataUrl: storedPhoto };
    }
    return null;
  }

  static loadMultiple(photoNames: string[]): PhotoData[] {
    const loadedPhotos: PhotoData[] = [];
    
    photoNames.forEach(photoName => {
      const photo = this.load(photoName);
      if (photo) {
        loadedPhotos.push(photo);
      }
    });
    
    return loadedPhotos;
  }

  static remove(photoName: string): void {
    localStorage.removeItem(`photo-${photoName}`);
    console.log(`Removed photo from localStorage: photo-${photoName}`);
  }

  static saveMultiple(photos: PhotoData[]): void {
    photos.forEach(photo => this.save(photo));
  }
}

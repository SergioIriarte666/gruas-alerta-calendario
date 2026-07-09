export interface PhotoData {
  name: string;
  blob: Blob;
  previewUrl: string;
  storageUrl?: string;
}

export interface PhotoCaptureProps {
  title: string;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
}

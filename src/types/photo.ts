
export interface PhotoData {
  name: string;
  dataUrl: string;
}

export interface PhotoCaptureProps {
  title: string;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
}

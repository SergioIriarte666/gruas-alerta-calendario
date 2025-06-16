
import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { PhotoData } from '@/types/photo';

interface PhotoGridProps {
  photos: PhotoData[];
  onRemovePhoto: (index: number) => void;
}

export const PhotoGrid = ({ photos, onRemovePhoto }: PhotoGridProps) => {
  if (photos.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
      {photos.map((photo, index) => (
        <div key={photo.name} className="relative">
          <img
            src={photo.dataUrl}
            alt={`Foto ${index + 1}`}
            className="w-full h-24 object-cover rounded border border-slate-600"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onRemovePhoto(index)}
            className="absolute -top-2 -right-2 w-6 h-6 p-0"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ))}
    </div>
  );
};

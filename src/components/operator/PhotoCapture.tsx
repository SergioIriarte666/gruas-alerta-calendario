
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

interface PhotoCaptureProps {
  title: string;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
}

interface PhotoData {
  name: string;
  dataUrl: string;
}

export const PhotoCapture = ({ title, photos, onPhotosChange, maxPhotos = 5 }: PhotoCaptureProps) => {
  const [photoData, setPhotoData] = useState<PhotoData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateFileName = (prefix: string) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}-${timestamp}.jpg`;
  };

  const processImage = (file: File): Promise<PhotoData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Redimensionar imagen para optimizar tamaño
          const maxWidth = 800;
          const maxHeight = 600;
          let { width, height } = img;
          
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx?.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const fileName = generateFileName(title.toLowerCase().replace(/\s+/g, '-'));
          
          resolve({ name: fileName, dataUrl });
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    
    if (photos.length + files.length > maxPhotos) {
      toast.error(`Máximo ${maxPhotos} fotos permitidas`);
      return;
    }

    try {
      const newPhotos: PhotoData[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          toast.error('Solo se permiten archivos de imagen');
          continue;
        }
        
        const photoData = await processImage(file);
        newPhotos.push(photoData);
      }
      
      const updatedPhotoData = [...photoData, ...newPhotos];
      const updatedPhotoNames = [...photos, ...newPhotos.map(p => p.name)];
      
      setPhotoData(updatedPhotoData);
      onPhotosChange(updatedPhotoNames);
      
      // Guardar en localStorage para el PDF
      updatedPhotoData.forEach(photo => {
        localStorage.setItem(`photo-${photo.name}`, photo.dataUrl);
      });
      
      toast.success(`${newPhotos.length} foto(s) agregada(s)`);
    } catch (error) {
      toast.error('Error al procesar las imágenes');
    }
  };

  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const removePhoto = (index: number) => {
    const photoToRemove = photoData[index];
    if (photoToRemove) {
      localStorage.removeItem(`photo-${photoToRemove.name}`);
    }
    
    const updatedPhotoData = photoData.filter((_, i) => i !== index);
    const updatedPhotoNames = photos.filter((_, i) => i !== index);
    
    setPhotoData(updatedPhotoData);
    onPhotosChange(updatedPhotoNames);
  };

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCameraCapture}
            disabled={photos.length >= maxPhotos}
            className="flex items-center gap-2"
          >
            <Camera className="w-4 h-4" />
            Tomar Foto
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={photos.length >= maxPhotos}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Subir Foto
          </Button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        
        {photoData.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
            {photoData.map((photo, index) => (
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
                  onClick={() => removePhoto(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 p-0"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        
        <p className="text-sm text-gray-400">
          {photos.length}/{maxPhotos} fotos
        </p>
      </CardContent>
    </Card>
  );
};

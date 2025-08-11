
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { PhotoCaptureProps, PhotoData } from '@/types/photo';
import { PhotoProcessor } from '@/utils/photoProcessor';
import { PhotoStorage } from '@/utils/photoStorage';
import { PhotoGrid } from './PhotoGrid';
import { PhotoCaptureControls } from './PhotoCaptureControls';

export const PhotoCapture = ({ title, photos, onPhotosChange, maxPhotos = 5 }: PhotoCaptureProps) => {
  const [photoData, setPhotoData] = useState<PhotoData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Sincronizar con localStorage al montar el componente
  useEffect(() => {
    const loadedPhotos = PhotoStorage.loadMultiple(photos);
    if (loadedPhotos.length > 0) {
      setPhotoData(loadedPhotos);
      console.log(`Loaded ${loadedPhotos.length} existing photos for ${title}`);
    }
  }, [photos, title]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    
    if (photos.length + files.length > maxPhotos) {
      toast.error(`Máximo ${maxPhotos} fotos permitidas`);
      return;
    }

    setIsLoading(true);
    
    try {
      const newPhotos: PhotoData[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!PhotoProcessor.validateImageFile(file)) {
          toast.error('Solo se permiten archivos de imagen');
          continue;
        }
        
        const photoData = await PhotoProcessor.processImage(file, title);
        newPhotos.push(photoData);
      }
      
      if (newPhotos.length === 0) {
        setIsLoading(false);
        return;
      }
      
      const updatedPhotoData = [...photoData, ...newPhotos];
      const updatedPhotoNames = [...photos, ...newPhotos.map(p => p.name)];
      
      setPhotoData(updatedPhotoData);
      onPhotosChange(updatedPhotoNames);
      
      // Guardar en localStorage para el PDF
      PhotoStorage.saveMultiple(newPhotos);
      
      toast.success(`${newPhotos.length} foto(s) agregada(s)`);
    } catch (error) {
      console.error('Error processing images:', error);
      toast.error('Error al procesar las imágenes');
    } finally {
      setIsLoading(false);
    }
  };

  const removePhoto = (index: number) => {
    const photoToRemove = photoData[index];
    if (photoToRemove) {
      PhotoStorage.remove(photoToRemove.name);
    }
    
    const updatedPhotoData = photoData.filter((_, i) => i !== index);
    const updatedPhotoNames = photos.filter((_, i) => i !== index);
    
    setPhotoData(updatedPhotoData);
    onPhotosChange(updatedPhotoNames);
    
    toast.success('Foto eliminada');
  };

  const refreshPhotos = () => {
    setIsLoading(true);
    
    const loadedPhotos = PhotoStorage.loadMultiple(photos);
    setPhotoData(loadedPhotos);
    setIsLoading(false);
    
    if (loadedPhotos.length !== photos.length) {
      toast.warning('Algunas fotos no pudieron ser recuperadas');
    } else {
      toast.success('Fotos sincronizadas');
    }
  };

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <PhotoCaptureControls
          onFileSelect={handleFileSelect}
          onRefresh={refreshPhotos}
          disabled={photos.length >= maxPhotos}
          isLoading={isLoading}
          showRefresh={photos.length > 0}
        />
        
        {isLoading && (
          <div className="text-center text-gray-400">
            Procesando fotos...
          </div>
        )}
        
        <PhotoGrid photos={photoData} onRemovePhoto={removePhoto} />
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">
            {photos.length}/{maxPhotos} fotos
          </span>
          {photoData.length !== photos.length && photos.length > 0 && (
            <span className="text-yellow-400 text-xs">
              Algunas fotos necesitan sincronización
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

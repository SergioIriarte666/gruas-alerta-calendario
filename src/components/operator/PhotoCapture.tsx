
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Upload, X, RefreshCw } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sincronizar con localStorage al montar el componente
  useEffect(() => {
    const loadExistingPhotos = () => {
      const loadedPhotos: PhotoData[] = [];
      
      photos.forEach(photoName => {
        const storedPhoto = localStorage.getItem(`photo-${photoName}`);
        if (storedPhoto) {
          loadedPhotos.push({
            name: photoName,
            dataUrl: storedPhoto
          });
        }
      });
      
      if (loadedPhotos.length > 0) {
        setPhotoData(loadedPhotos);
        console.log(`Loaded ${loadedPhotos.length} existing photos for ${title}`);
      }
    };

    loadExistingPhotos();
  }, [photos, title]);

  const generateFileName = (prefix: string) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(7);
    return `${prefix}-${timestamp}-${random}.jpg`;
  };

  const processImage = (file: File): Promise<PhotoData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              reject(new Error('No se pudo crear el contexto del canvas'));
              return;
            }
            
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
            
            ctx.drawImage(img, 0, 0, width, height);
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const fileName = generateFileName(title.toLowerCase().replace(/\s+/g, '-'));
            
            resolve({ name: fileName, dataUrl });
          } catch (error) {
            reject(new Error('Error procesando la imagen'));
          }
        };
        img.onerror = () => reject(new Error('Error cargando la imagen'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Error leyendo el archivo'));
      reader.readAsDataURL(file);
    });
  };

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
        if (!file.type.startsWith('image/')) {
          toast.error('Solo se permiten archivos de imagen');
          continue;
        }
        
        const photoData = await processImage(file);
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
      newPhotos.forEach(photo => {
        localStorage.setItem(`photo-${photo.name}`, photo.dataUrl);
        console.log(`Saved photo to localStorage: photo-${photo.name}`);
      });
      
      toast.success(`${newPhotos.length} foto(s) agregada(s)`);
    } catch (error) {
      console.error('Error processing images:', error);
      toast.error('Error al procesar las imágenes');
    } finally {
      setIsLoading(false);
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
      console.log(`Removed photo from localStorage: photo-${photoToRemove.name}`);
    }
    
    const updatedPhotoData = photoData.filter((_, i) => i !== index);
    const updatedPhotoNames = photos.filter((_, i) => i !== index);
    
    setPhotoData(updatedPhotoData);
    onPhotosChange(updatedPhotoNames);
    
    toast.success('Foto eliminada');
  };

  const refreshPhotos = () => {
    setIsLoading(true);
    
    // Recargar fotos desde localStorage
    const loadedPhotos: PhotoData[] = [];
    
    photos.forEach(photoName => {
      const storedPhoto = localStorage.getItem(`photo-${photoName}`);
      if (storedPhoto) {
        loadedPhotos.push({
          name: photoName,
          dataUrl: storedPhoto
        });
      }
    });
    
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-white">{title}</CardTitle>
          {photos.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refreshPhotos}
              disabled={isLoading}
              className="flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCameraCapture}
            disabled={photos.length >= maxPhotos || isLoading}
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
            disabled={photos.length >= maxPhotos || isLoading}
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
        
        {isLoading && (
          <div className="text-center text-gray-400">
            Procesando fotos...
          </div>
        )}
        
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

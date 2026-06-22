import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PhotoProcessor } from '@/utils/photoProcessor';
import { PhotoStorage } from '@/utils/photoStorage';
import { PhotoData } from '@/types/photo';
import { uploadInspectionPhoto, deleteInspectionPhoto } from '@/utils/photoUpload';
import { createLogger } from '@/lib/logger';

const logger = createLogger('PhotographicSet');

interface PhotographicSetPhoto {
  fileName: string;
  category: 'izquierdo' | 'derecho' | 'frontal' | 'trasero' | 'interior' | 'motor';
  storageUrl?: string;
}

interface PhotographicSetProps {
  photos: PhotographicSetPhoto[];
  onPhotosChange: (photos: PhotographicSetPhoto[]) => void;
  serviceId: string;
}

const PHOTO_CATEGORIES = [
  { id: 'izquierdo', label: 'Izquierda', shortLabel: 'Izq', icon: '←' },
  { id: 'derecho', label: 'Derecha', shortLabel: 'Der', icon: '→' },
  { id: 'frontal', label: 'Frontal', shortLabel: 'Front', icon: '↑' },
  { id: 'trasero', label: 'Trasera', shortLabel: 'Tras', icon: '↓' },
  { id: 'interior', label: 'Interior', shortLabel: 'Inter', icon: '🚗' },
  { id: 'motor', label: 'Motor', shortLabel: 'Motor', icon: '⚙️' }
] as const;

export const PhotographicSet = ({ photos, onPhotosChange, serviceId }: PhotographicSetProps) => {
  const [loadedPhotoData, setLoadedPhotoData] = useState<Record<string, PhotoData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('izquierdo');

  useEffect(() => {
    logger.debug('Loading photos...', { photosCount: photos.length });

    const loadExistingPhotos = async () => {
      const photoDataMap: Record<string, PhotoData> = {};
      let loadedCount = 0;
      let failedCount = 0;

      for (const photo of photos) {
        try {
          const photoData = PhotoStorage.load(photo.fileName);
          if (photoData) {
            photoDataMap[photo.fileName] = photoData;
            loadedCount++;
          } else {
            failedCount++;
            logger.warn(`Photo not found in storage: ${photo.fileName} (${photo.category})`);
          }
        } catch (error) {
          failedCount++;
          logger.error(`Error loading photo ${photo.fileName}:`, error);
        }
      }

      logger.debug(`Photo loading summary: ${loadedCount} loaded, ${failedCount} failed`);
      setLoadedPhotoData(photoDataMap);
    };

    if (photos.length > 0) {
      loadExistingPhotos();
    } else {
      setLoadedPhotoData({});
    }
  }, [photos]);

  const handleFileSelect = async (files: FileList | null, category: string) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!PhotoProcessor.validateImageFile(file)) {
      toast.error('Solo se permiten archivos de imagen');
      return;
    }

    setIsLoading(true);

    try {
      logger.debug(`Processing new photo for category: ${category}`);
      const processedPhoto = await PhotoProcessor.processImage(file, `Set_Fotografico_${category}`);

      // Guardar en localStorage (caché inmediata)
      PhotoStorage.save(processedPhoto);
      logger.debug(`Photo saved to storage: ${processedPhoto.name}`);

      setLoadedPhotoData(prev => ({ ...prev, [processedPhoto.name]: processedPhoto }));

      const newPhoto: PhotographicSetPhoto = {
        fileName: processedPhoto.name,
        category: category as PhotographicSetPhoto['category'],
      };

      const filteredPhotos = photos.filter(p => p.category !== category);
      const updatedPhotos = [...filteredPhotos, newPhoto];

      onPhotosChange(updatedPhotos);
      toast.success(`Foto ${category} agregada`);

      // Subir a Supabase Storage en segundo plano
      uploadInspectionPhoto(processedPhoto.name, processedPhoto.dataUrl, serviceId)
        .then((url) => {
          logger.debug(`Foto subida a Supabase: ${processedPhoto.name}`);
          // Actualizar el array con la storageUrl para que quede registrada en la inspección
          onPhotosChange(
            updatedPhotos.map(p =>
              p.fileName === processedPhoto.name ? { ...p, storageUrl: url } : p
            )
          );
        })
        .catch((uploadErr) => {
          logger.warn(`Foto sin backup en Supabase: ${processedPhoto.name} (se reintentará al enviar la inspección)`, uploadErr);
        });
    } catch (error) {
      logger.error('Error processing photo:', error);
      toast.error('Error al procesar la fotografía');
    } finally {
      setIsLoading(false);
    }
  };

  const removePhoto = (fileName: string, category: string) => {
    logger.debug(`Removing photo: ${fileName} (${category})`);

    PhotoStorage.remove(fileName);
    deleteInspectionPhoto(fileName, serviceId); // fire-and-forget

    setLoadedPhotoData(prev => {
      const updated = { ...prev };
      delete updated[fileName];
      return updated;
    });

    const updatedPhotos = photos.filter(p => p.fileName !== fileName);
    onPhotosChange(updatedPhotos);
    toast.success(`Foto ${category} eliminada`);
  };

  const getPhotoForCategory = (category: string) => photos.find(p => p.category === category);

  const getCategoryCount = () => new Set(photos.map(p => p.category)).size;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center justify-between">
          <span>Set Fotográfico</span>
          <Badge variant="secondary">
            {photos.length} foto(s) • {getCategoryCount()}/6 categorías
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 bg-muted h-auto p-1">
            {PHOTO_CATEGORIES.map((category) => {
              const hasPhoto = getPhotoForCategory(category.id);
              return (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className={`flex flex-col items-center gap-1 p-2 text-xs h-auto min-h-[60px] ${
                    hasPhoto ? 'bg-green-600 text-white' : 'text-muted-foreground'
                  }`}
                >
                  <span className="text-base">{category.icon}</span>
                  <span className="hidden sm:inline">{category.shortLabel}</span>
                  <span className="sm:hidden text-[10px] leading-tight text-center">
                    {category.shortLabel}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {PHOTO_CATEGORIES.map((category) => {
            const photo = getPhotoForCategory(category.id);
            const photoData = photo ? loadedPhotoData[photo.fileName] : null;

            return (
              <TabsContent key={category.id} value={category.id} className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">
                      {category.icon} Vista {category.label}
                    </h3>
                    {!photo && (
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileSelect(e.target.files, category.id)}
                        className="hidden"
                        id={`camera-${category.id}`}
                        disabled={isLoading}
                      />
                    )}
                  </div>

                  {photoData ? (
                    <div className="relative">
                      <img
                        src={photoData.dataUrl}
                        alt={`Vista ${category.label}`}
                        className="w-full max-w-md h-64 object-cover rounded-lg border border-border"
                      />
                      <div className="absolute top-2 right-2 flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removePhoto(photo!.fileName, category.label)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                        <span>{photo!.fileName}</span>
                        {photo!.storageUrl && (
                          <span className="text-emerald-600 dark:text-emerald-400">✓ guardada</span>
                        )}
                      </div>
                    </div>
                  ) : photo ? (
                    <div className="border border-red-500 rounded-lg p-4 bg-red-50">
                      <p className="text-red-600 text-sm mb-2">
                        ⚠️ Foto registrada pero no disponible: {photo.fileName}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removePhoto(photo.fileName, category.label)}
                        >
                          <Trash2 className="size-4 mr-1" />
                          Eliminar registro
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById(`camera-${category.id}`)?.click()}
                          disabled={isLoading}
                        >
                          <Camera className="size-4 mr-1" />
                          Tomar nueva
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                      <Camera className="size-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-4">
                        Toma una foto de la vista {category.label.toLowerCase()}
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => document.getElementById(`camera-${category.id}`)?.click()}
                        disabled={isLoading}
                      >
                        <Camera className="size-4 mr-2" />
                        {isLoading ? 'Procesando...' : 'Tomar Fotografía'}
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>

        {photos.length === 0 && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">
              ⚠️ Debes tomar al menos 1 fotografía para completar el set fotográfico
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

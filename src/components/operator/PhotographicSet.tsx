import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera as CameraIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { PhotoProcessor } from '@/utils/photoProcessor';
import { PhotoStorage } from '@/utils/photoStorage';
import { PhotoData } from '@/types/photo';
import { uploadInspectionPhoto, deleteInspectionPhoto } from '@/utils/photoUpload';
import { getPhotoBlobForPdf } from '@/utils/pdf/photos/photoStorage';
import { createLogger } from '@/lib/logger';

const logger = createLogger('InspectionPhotos');

interface PhotographicSetPhoto {
  fileName: string;
  category: 'izquierdo' | 'derecho' | 'frontal' | 'trasero' | 'interior' | 'motor';
  storageUrl?: string;
}

interface PhotographicSetProps {
  photos: PhotographicSetPhoto[];
  onPhotosChange: (photos: PhotographicSetPhoto[]) => void;
  serviceId: string;
  phase?: 'initial' | 'final';
  isOptional?: boolean;
}

const PHOTO_CATEGORIES = [
  { id: 'izquierdo', label: 'Izquierda', shortLabel: 'Izq', icon: '←' },
  { id: 'derecho', label: 'Derecha', shortLabel: 'Der', icon: '→' },
  { id: 'frontal', label: 'Frontal', shortLabel: 'Front', icon: '↑' },
  { id: 'trasero', label: 'Trasera', shortLabel: 'Tras', icon: '↓' },
  { id: 'interior', label: 'Interior', shortLabel: 'Inter', icon: '🚗' },
  { id: 'motor', label: 'Motor', shortLabel: 'Motor', icon: '⚙️' }
] as const;

const isUserCancellation = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel/i.test(message);
};

export const PhotographicSet = ({ photos, onPhotosChange, serviceId, phase = 'initial', isOptional = false }: PhotographicSetProps) => {
  const [loadedPhotoData, setLoadedPhotoData] = useState<Record<string, PhotoData>>({});
  const [isCapturing, setIsCapturing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('izquierdo');

  useEffect(() => {
    logger.debug('Loading photos...', { photosCount: photos.length });

    const loadExistingPhotos = async () => {
      const photoDataMap: Record<string, PhotoData> = {};
      let loadedCount = 0;
      let failedCount = 0;

      for (const photo of photos) {
        try {
          let photoData = await PhotoStorage.load(photo.fileName);
          if (!photoData && photo.storageUrl) {
            const remoteBlob = await getPhotoBlobForPdf(photo.fileName, photo.storageUrl);
            if (remoteBlob) {
              photoData = {
                name: photo.fileName,
                blob: remoteBlob,
                previewUrl: URL.createObjectURL(remoteBlob),
              };
              await PhotoStorage.save({ name: photo.fileName, blob: remoteBlob }).catch((error) => {
                logger.warn(`No se pudo restaurar ${photo.fileName} en la caché local`, error);
              });
            }
          }
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

  // Revocar los object URLs de la instantánea anterior cada vez que loadedPhotoData
  // cambia, y también al desmontar. Nunca reventamos WKWebView reteniendo blob URLs
  // huérfanos de fotos que ya no se muestran.
  useEffect(() => {
    return () => {
      Object.values(loadedPhotoData).forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, [loadedPhotoData]);

  const handleCapture = async (category: string) => {
    if (isCapturing) return;
    setIsCapturing(true);

    try {
      logger.debug(`Iniciando captura de cámara para categoría: ${category}`);

      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        quality: 60,
        width: 1600,
        correctOrientation: true,
      });

      if (!photo.webPath) {
        throw new Error('La cámara no devolvió una imagen válida');
      }

      const response = await fetch(photo.webPath);
      if (!response.ok) {
        throw new Error(`No se pudo leer la captura de cámara (${response.status})`);
      }
      const rawBlob = await response.blob();
      if (rawBlob.size === 0) {
        throw new Error('La cámara devolvió una fotografía vacía');
      }
      logger.debug(`Foto capturada para ${category}: ${Math.round(rawBlob.size / 1024)} KB`);

      const processedPhoto = await PhotoProcessor.processImage(rawBlob, `Set_Fotografico_${category}`);
      logger.debug(`Foto comprimida para ${category}: ${processedPhoto.name} (${Math.round(processedPhoto.blob.size / 1024)} KB)`);

      // Safari puede negar IndexedDB por cuota o privacidad. La captura sigue siendo
      // válida si logra respaldarse en Storage; sólo fallamos cuando ambos destinos fallan.
      let savedLocally = true;
      try {
        await PhotoStorage.save(processedPhoto);
      } catch (storageError) {
        savedLocally = false;
        logger.warn(`No se pudo guardar ${processedPhoto.name} en IndexedDB`, storageError);
      }

      let storageUrl: string | undefined;
      if (navigator.onLine) {
        try {
          storageUrl = await uploadInspectionPhoto(processedPhoto.name, processedPhoto.blob, serviceId);
        } catch (uploadError) {
          logger.warn(`No se pudo respaldar ${processedPhoto.name} en Storage`, uploadError);
          if (!savedLocally) {
            throw new Error('El dispositivo no permitió guardar la foto y tampoco fue posible respaldarla en línea');
          }
        }
      } else if (!savedLocally) {
        throw new Error('Sin conexión y sin almacenamiento local disponible para guardar la foto');
      }

      const previewUrl = URL.createObjectURL(processedPhoto.blob);
      setLoadedPhotoData(prev => ({
        ...prev,
        [processedPhoto.name]: { name: processedPhoto.name, blob: processedPhoto.blob, previewUrl },
      }));

      const newPhoto: PhotographicSetPhoto = {
        fileName: processedPhoto.name,
        category: category as PhotographicSetPhoto['category'],
        storageUrl,
      };

      const replacedPhoto = photos.find(p => p.category === category);
      const filteredPhotos = photos.filter(p => p.category !== category);
      const updatedPhotos = [...filteredPhotos, newPhoto];

      onPhotosChange(updatedPhotos);
      toast.success(storageUrl ? `Foto ${category} guardada` : `Foto ${category} guardada en el dispositivo`);

      if (replacedPhoto) {
        void PhotoStorage.remove(replacedPhoto.fileName);
        void deleteInspectionPhoto(replacedPhoto.fileName, serviceId);
      }
    } catch (error) {
      if (isUserCancellation(error)) {
        logger.debug(`Captura cancelada por el usuario para categoría: ${category}`);
      } else {
        logger.error('Error capturando fotografía:', error);
        toast.error('Error al guardar la fotografía', {
          description: error instanceof Error ? error.message : 'Intenta tomarla nuevamente.',
        });
      }
    } finally {
      setIsCapturing(false);
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
    <Card className="operator-inspection-card rounded-3xl bg-card">
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-3 text-foreground">
          <span className="min-w-0">
            <span className="operator-native-eyebrow block">Paso 3</span>
            <span className="mt-1 block text-lg">
            {isOptional
              ? 'Fotografías del Servicio (opcional)'
              : phase === 'final'
                ? 'Foto de entrega'
                : 'Set Fotográfico'}
            </span>
          </span>
          <Badge variant="secondary" className="shrink-0 rounded-full">
            {photos.length} foto(s)
            {isOptional
              ? ' • opcional'
              : phase === 'initial'
                ? ` • ${getCategoryCount()}/6 categorías`
                : ' • mínimo 1'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl bg-muted p-1 sm:grid-cols-6">
            {PHOTO_CATEGORIES.map((category) => {
              const hasPhoto = getPhotoForCategory(category.id);
              return (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className={`flex h-auto min-h-14 flex-col items-center gap-1 rounded-xl p-2 text-xs ${
                    hasPhoto ? 'bg-success text-success-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <span className="text-base">{category.icon}</span>
                  <span className="hidden sm:inline">{category.shortLabel}</span>
                  <span className="sm:hidden text-xs leading-tight text-center">
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
                  </div>

                  {photoData ? (
                    <div className="relative">
                      <img
                        src={photoData.previewUrl}
                        alt={`Vista ${category.label}`}
                        className="h-64 w-full max-w-md rounded-2xl border border-border object-cover"
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
                          <span className="text-success-text">✓ guardada</span>
                        )}
                      </div>
                    </div>
                  ) : photo ? (
                    <div className="border border-danger/30 rounded-lg p-4 bg-danger-soft">
                      <p className="text-danger-text text-sm mb-2">
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
                          onClick={() => handleCapture(category.id)}
                          disabled={isCapturing}
                        >
                          <CameraIcon className="size-4 mr-1" />
                          Tomar nueva
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-8 text-center">
                      <CameraIcon className="size-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-4">
                        Toma una foto de la vista {category.label.toLowerCase()}
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => handleCapture(category.id)}
                        disabled={isCapturing}
                        className="min-h-11 rounded-xl"
                      >
                        <CameraIcon className="size-4 mr-2" />
                        {isCapturing ? 'Procesando...' : 'Tomar Fotografía'}
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>

        {photos.length === 0 && !isOptional && (
          <div className="mt-4 p-4 bg-danger-soft border border-danger/30 rounded-lg">
            <p className="text-danger-text text-sm">
              ⚠️ Debes tomar al menos 1 fotografía para completar el set fotográfico
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

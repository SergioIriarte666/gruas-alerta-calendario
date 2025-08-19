
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

interface PhotographicSetPhoto {
  fileName: string;
  category: 'izquierdo' | 'derecho' | 'frontal' | 'trasero' | 'interior' | 'motor';
}

interface PhotographicSetProps {
  photos: PhotographicSetPhoto[];
  onPhotosChange: (photos: PhotographicSetPhoto[]) => void;
}

const PHOTO_CATEGORIES = [
  { id: 'izquierdo', label: 'Izquierda', shortLabel: 'Izq', icon: '←' },
  { id: 'derecho', label: 'Derecha', shortLabel: 'Der', icon: '→' },
  { id: 'frontal', label: 'Frontal', shortLabel: 'Front', icon: '↑' },
  { id: 'trasero', label: 'Trasera', shortLabel: 'Tras', icon: '↓' },
  { id: 'interior', label: 'Interior', shortLabel: 'Inter', icon: '🚗' },
  { id: 'motor', label: 'Motor', shortLabel: 'Motor', icon: '⚙️' }
] as const;

export const PhotographicSet = ({ photos, onPhotosChange }: PhotographicSetProps) => {
  const [loadedPhotoData, setLoadedPhotoData] = useState<Record<string, PhotoData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('izquierdo');

  // Enhanced photo loading with better error handling and logging
  useEffect(() => {
    console.log('📷 PhotographicSet - Loading photos...', {
      photosCount: photos.length,
      photoFileNames: photos.map(p => p.fileName)
    });

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
            console.log(`✅ Photo loaded: ${photo.fileName} (${photo.category})`);
          } else {
            failedCount++;
            console.warn(`⚠️ Photo not found in storage: ${photo.fileName} (${photo.category})`);
          }
        } catch (error) {
          failedCount++;
          console.error(`❌ Error loading photo ${photo.fileName}:`, error);
        }
      }
      
      console.log(`📊 Photo loading summary: ${loadedCount} loaded, ${failedCount} failed`);
      setLoadedPhotoData(photoDataMap);
    };

    if (photos.length > 0) {
      loadExistingPhotos();
    } else {
      console.log('📷 No photos to load, clearing loaded data');
      setLoadedPhotoData({});
    }
  }, [photos]);

  // Debug effect to monitor photo data changes
  useEffect(() => {
    const loadedPhotoCount = Object.keys(loadedPhotoData).length;
    console.log(`📷 Loaded photo data changed: ${loadedPhotoCount} photos available`);
  }, [loadedPhotoData]);

  const handleFileSelect = async (files: FileList | null, category: string) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!PhotoProcessor.validateImageFile(file)) {
      toast.error('Solo se permiten archivos de imagen');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log(`📷 Processing new photo for category: ${category}`);
      const processedPhoto = await PhotoProcessor.processImage(file, `Set_Fotografico_${category}`);
      
      // Guardar en localStorage
      PhotoStorage.save(processedPhoto);
      console.log(`💾 Photo saved to storage: ${processedPhoto.name}`);
      
      // Actualizar estado local
      setLoadedPhotoData(prev => ({
        ...prev,
        [processedPhoto.name]: processedPhoto
      }));
      
      // Actualizar fotos en el formulario
      const newPhoto: PhotographicSetPhoto = {
        fileName: processedPhoto.name,
        category: category as any
      };
      
      // Remover foto anterior de esta categoría si existe
      const filteredPhotos = photos.filter(p => p.category !== category);
      const updatedPhotos = [...filteredPhotos, newPhoto];
      
      console.log(`📝 Updating photos array: ${updatedPhotos.length} total photos`);
      onPhotosChange(updatedPhotos);
      
      toast.success(`Foto ${category} agregada exitosamente`);
    } catch (error) {
      console.error('Error processing photo:', error);
      toast.error('Error al procesar la fotografía');
    } finally {
      setIsLoading(false);
    }
  };

  const removePhoto = (fileName: string, category: string) => {
    console.log(`🗑️ Removing photo: ${fileName} (${category})`);
    
    // Remover del localStorage
    PhotoStorage.remove(fileName);
    
    // Actualizar estado local
    setLoadedPhotoData(prev => {
      const updated = { ...prev };
      delete updated[fileName];
      return updated;
    });
    
    // Actualizar fotos en el formulario
    const updatedPhotos = photos.filter(p => p.fileName !== fileName);
    console.log(`📝 Photos after removal: ${updatedPhotos.length} total photos`);
    onPhotosChange(updatedPhotos);
    
    toast.success(`Foto ${category} eliminada`);
  };

  const getPhotoForCategory = (category: string) => {
    return photos.find(p => p.category === category);
  };

  const getCategoryCount = () => {
    const categoriesWithPhotos = new Set(photos.map(p => p.category));
    return categoriesWithPhotos.size;
  };

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <span>Set Fotográfico</span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {photos.length} foto(s) • {getCategoryCount()}/6 categorías
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 bg-slate-700 h-auto p-1">
            {PHOTO_CATEGORIES.map((category) => {
              const hasPhoto = getPhotoForCategory(category.id);
              return (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className={`flex flex-col items-center gap-1 p-2 text-xs h-auto min-h-[60px] ${
                    hasPhoto ? 'bg-green-600 text-white' : 'text-slate-300'
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
                    <h3 className="text-lg font-semibold text-white">
                      {category.icon} Vista {category.label}
                    </h3>
                    {!photo && (
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
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
                        className="w-full max-w-md h-64 object-cover rounded-lg border border-slate-600"
                      />
                      <div className="absolute top-2 right-2 flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removePhoto(photo!.fileName, category.label)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="mt-2 text-sm text-gray-400">
                        Archivo: {photo!.fileName}
                      </div>
                    </div>
                  ) : photo ? (
                    // Photo exists in form data but not loaded from storage
                    <div className="border border-red-600 rounded-lg p-4 bg-red-900/20">
                      <p className="text-red-300 text-sm mb-2">
                        ⚠️ Foto registrada pero no disponible: {photo.fileName}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removePhoto(photo.fileName, category.label)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Eliminar registro
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById(`camera-${category.id}`)?.click()}
                          disabled={isLoading}
                          className="border-slate-600 text-slate-300"
                        >
                          <Camera className="w-4 h-4 mr-1" />
                          Tomar nueva
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // No photo for this category
                    <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
                      <Camera className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                      <p className="text-slate-400 mb-4">
                        Toma una foto de la vista {category.label.toLowerCase()}
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => document.getElementById(`camera-${category.id}`)?.click()}
                        disabled={isLoading}
                        className="border-slate-600 text-slate-300"
                      >
                        <Camera className="w-4 h-4 mr-2" />
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
          <div className="mt-4 p-4 bg-red-900/20 border border-red-700 rounded-lg">
            <p className="text-red-300 text-sm">
              ⚠️ Debes tomar al menos 1 fotografía para completar el set fotográfico
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

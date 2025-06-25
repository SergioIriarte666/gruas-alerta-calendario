
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, RefreshCw, Trash2 } from 'lucide-react';
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
  { id: 'izquierdo', label: 'Izquierdo', icon: '←' },
  { id: 'derecho', label: 'Derecho', icon: '→' },
  { id: 'frontal', label: 'Frontal', icon: '↑' },
  { id: 'trasero', label: 'Trasero', icon: '↓' },
  { id: 'interior', label: 'Interior', icon: '🚗' },
  { id: 'motor', label: 'Motor', icon: '⚙️' }
] as const;

export const PhotographicSet = ({ photos, onPhotosChange }: PhotographicSetProps) => {
  const [photoData, setPhotoData] = useState<Record<string, PhotoData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('izquierdo');

  // Cargar fotos existentes
  useEffect(() => {
    const loadExistingPhotos = async () => {
      const loadedPhotos: Record<string, PhotoData> = {};
      
      for (const photo of photos) {
        const photoData = PhotoStorage.load(photo.fileName);
        if (photoData) {
          loadedPhotos[photo.fileName] = photoData;
        }
      }
      
      setPhotoData(loadedPhotos);
    };

    if (photos.length > 0) {
      loadExistingPhotos();
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
      const processedPhoto = await PhotoProcessor.processImage(file, `Set_Fotografico_${category}`);
      
      // Guardar en localStorage
      PhotoStorage.save(processedPhoto);
      
      // Actualizar estado local
      setPhotoData(prev => ({
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
      onPhotosChange([...filteredPhotos, newPhoto]);
      
      toast.success(`Foto ${category} agregada exitosamente`);
    } catch (error) {
      console.error('Error processing photo:', error);
      toast.error('Error al procesar la fotografía');
    } finally {
      setIsLoading(false);
    }
  };

  const removePhoto = (fileName: string, category: string) => {
    // Remover del localStorage
    PhotoStorage.remove(fileName);
    
    // Actualizar estado local
    setPhotoData(prev => {
      const updated = { ...prev };
      delete updated[fileName];
      return updated;
    });
    
    // Actualizar fotos en el formulario
    const updatedPhotos = photos.filter(p => p.fileName !== fileName);
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
          <TabsList className="grid w-full grid-cols-6 bg-slate-700">
            {PHOTO_CATEGORIES.map((category) => {
              const hasPhoto = getPhotoForCategory(category.id);
              return (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className={`text-xs ${hasPhoto ? 'bg-green-600 text-white' : ''}`}
                >
                  <span className="mr-1">{category.icon}</span>
                  {category.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {PHOTO_CATEGORIES.map((category) => {
            const photo = getPhotoForCategory(category.id);
            const photoData = photo ? photoData[photo.fileName] : null;

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
                  ) : (
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

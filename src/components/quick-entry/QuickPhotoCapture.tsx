import React, { useState, useRef } from 'react';
import { Camera, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface QuickPhotoCaptureProps {
  onPhotosChange: (photos: Array<{ path: string; signedUrl: string; file?: File }>) => void;
  maxPhotos?: number;
}

export function QuickPhotoCapture({ onPhotosChange, maxPhotos = 3 }: QuickPhotoCaptureProps) {
  const [photos, setPhotos] = useState<Array<{ path: string; signedUrl: string; file?: File }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (photos.length + files.length > maxPhotos) {
      toast.error(`Máximo ${maxPhotos} fotos permitidas`);
      return;
    }

    setIsUploading(true);
    try {
      const newPhotos: Array<{ path: string; signedUrl: string; file?: File }> = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast.error('Solo se permiten archivos de imagen');
          continue;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error('El archivo es demasiado grande (máximo 5MB)');
          continue;
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('quick-entry-photos')
          .upload(fileName, file);

        if (error) {
          console.error('Upload error:', error);
          toast.error('Error al subir la foto');
          continue;
        }

        // Get signed URL (bucket is private)
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('quick-entry-photos')
          .createSignedUrl(data.path, 31536000); // 1 year expiry

        if (signedUrlError || !signedUrlData?.signedUrl) {
          console.error('Signed URL error:', signedUrlError);
          toast.error('Error al obtener URL de la foto');
          continue;
        }

        newPhotos.push({ path: data.path, signedUrl: signedUrlData.signedUrl, file });
      }

      const updatedPhotos = [...photos, ...newPhotos];
      setPhotos(updatedPhotos);
      onPhotosChange(updatedPhotos);

      if (newPhotos.length > 0) {
        toast.success(`${newPhotos.length} foto(s) agregada(s)`);
      }
    } catch (error) {
      console.error('Error processing photos:', error);
      toast.error('Error al procesar las fotos');
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = async (index: number) => {
    const photoToRemove = photos[index];
    
    if (photoToRemove?.path) {
      try {
        await supabase.storage
          .from('quick-entry-photos')
          .remove([photoToRemove.path]);
      } catch (error) {
        console.error('Error deleting photo from storage:', error);
      }
    }
    
    const updatedPhotos = photos.filter((_, i) => i !== index);
    setPhotos(updatedPhotos);
    onPhotosChange(updatedPhotos);
    toast.success('Foto eliminada');
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        capture="environment"
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={triggerFileSelect}
        disabled={isUploading || photos.length >= maxPhotos}
        className="w-full"
      >
        {isUploading ? (
          <>
            <Upload className="h-4 w-4 mr-2 animate-spin" />
            Procesando...
          </>
        ) : (
          <>
            <Camera className="h-4 w-4 mr-2" />
            {photos.length === 0 ? 'Tomar Foto' : `Agregar Foto (${photos.length}/${maxPhotos})`}
          </>
        )}
      </Button>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <div key={index} className="relative group">
              <img
                src={photo.signedUrl}
                alt={`Foto ${index + 1}`}
                className="w-full h-20 object-cover rounded-md border border-border"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removePhoto(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

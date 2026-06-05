import React, { useState, useRef } from 'react';
import { Camera, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from "@/lib/logger";


const logger = createLogger("QuickPhotoCapture");
interface QuickPhotoCaptureProps {
  onPhotosChange: (photos: Array<{ path: string; signedUrl: string; file?: File }>) => void;
  maxPhotos?: number;
}

export function QuickPhotoCapture({ onPhotosChange, maxPhotos = 3 }: QuickPhotoCaptureProps) {
  const [photos, setPhotos] = useState<Array<{ path: string; signedUrl: string; file?: File }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isHeicFile = (file: File) => {
    const type = file.type.toLowerCase();
    if (type === 'image/heic' || type === 'image/heif') return true;
    const name = file.name.toLowerCase();
    return name.endsWith('.heic') || name.endsWith('.heif');
  };

  const convertToJpegIfNeeded = async (file: File) => {
    if (!isHeicFile(file)) return file;

    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.decoding = 'async';
      image.src = objectUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('No se pudo decodificar la imagen HEIC/HEIF'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(image, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) return file;

      const baseName = file.name.replace(/\.(heic|heif)$/i, '');
      return new File([blob], `${baseName || 'foto'}.jpg`, { type: 'image/jpeg' });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

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
        const originalFile = files[i];
        
        // Validate file type
        if (originalFile.type && !originalFile.type.startsWith('image/')) {
          toast.error('Solo se permiten archivos de imagen');
          continue;
        }

        // Validate file size (max 5MB)
        if (originalFile.size > 5 * 1024 * 1024) {
          toast.error('El archivo es demasiado grande (máximo 5MB)');
          continue;
        }

        let file: File;
        try {
          file = await convertToJpegIfNeeded(originalFile);
        } catch (error) {
          logger.error('HEIC conversion error:', error);
          toast.error('No se pudo convertir la foto (HEIC)');
          file = originalFile;
        }

        if (file.size > 5 * 1024 * 1024) {
          toast.error('El archivo convertido es demasiado grande (máximo 5MB)');
          continue;
        }

        // Generate unique filename under user's folder (required by RLS policy)
        const { data: { user } } = await supabase.auth.getUser();
        const fileExt = file.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'jpg');
        const fileName = `${user?.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('quick-entry-photos')
          .upload(fileName, file);

        if (error) {
          logger.error('Upload error:', error);
          toast.error('Error al subir la foto');
          continue;
        }

        // Get signed URL (bucket is private)
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('quick-entry-photos')
          .createSignedUrl(data.path, 31536000); // 1 year expiry

        if (signedUrlError || !signedUrlData?.signedUrl) {
          logger.error('Signed URL error:', signedUrlError);
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
      logger.error('Error processing photos:', error);
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
        logger.error('Error deleting photo from storage:', error);
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
            <Upload className="size-4 mr-2 animate-spin" />
            Procesando...
          </>
        ) : (
          <>
            <Camera className="size-4 mr-2" />
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
                className="absolute -top-2 -right-2 size-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removePhoto(index)}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

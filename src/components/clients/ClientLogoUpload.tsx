import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ClientLogoUpload');
const BUCKET = 'company-assets';

interface ClientLogoUploadProps {
  clientId: string;
  currentLogoUrl?: string | null;
  clientName: string;
  onLogoChange: (newUrl: string | null) => void;
}

export const ClientLogoUpload: React.FC<ClientLogoUploadProps> = ({
  clientId,
  currentLogoUrl,
  clientName,
  onLogoChange,
}) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentLogoUrl || null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreview(currentLogoUrl || null);
  }, [currentLogoUrl]);

  const getStoragePathFromUrl = (url: string) => {
    return url.split('/company-assets/')[1]?.split('?')[0] || null;
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imagenes (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('El logo no puede superar 2 MB');
      return;
    }

    setUploading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        throw new Error('No se pudo identificar el usuario autenticado');
      }

      const ext = file.name.split('.').pop() || 'png';
      const path = `${user.id}/clients/${clientId}/logo.${ext}`;

      if (preview) {
        const oldPath = getStoragePathFromUrl(preview);
        if (oldPath) {
          await supabase.storage.from(BUCKET).remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { error: dbError } = await supabase
        .from('clients')
        .update({ logo_url: data.publicUrl, updated_at: new Date().toISOString() })
        .eq('id', clientId);

      if (dbError) throw dbError;

      setPreview(publicUrl);
      onLogoChange(data.publicUrl);
      toast.success('Logo actualizado correctamente');
    } catch (err: any) {
      logger.error('Error uploading logo:', err);
      toast.error('Error al subir el logo', { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setUploading(true);

    try {
      if (preview) {
        const oldPath = getStoragePathFromUrl(preview);
        if (oldPath) {
          await supabase.storage.from(BUCKET).remove([oldPath]);
        }
      }

      const { error } = await supabase
        .from('clients')
        .update({ logo_url: null, updated_at: new Date().toISOString() })
        .eq('id', clientId);

      if (error) throw error;

      setPreview(null);
      onLogoChange(null);
      toast.success('Logo eliminado');
    } catch (err: any) {
      logger.error('Error removing logo:', err);
      toast.error('Error al eliminar el logo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30 p-1.5">
            <img src={preview} alt={`Logo ${clientName}`} className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Upload className="mr-1.5 size-3.5" />}
              Cambiar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={uploading}
              className="text-xs text-destructive hover:text-destructive"
            >
              <X className="mr-1.5 size-3.5" />
              Eliminar
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3 transition-colors hover:border-primary/50 hover:bg-primary/5"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          {uploading ? (
            <Loader2 className="size-5 flex-shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ImageIcon className="size-5 flex-shrink-0 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm text-muted-foreground">
              {uploading ? 'Subiendo...' : 'Arrastra el logo o haz clic para seleccionar'}
            </p>
            <p className="text-xs text-muted-foreground/70">PNG, JPG, SVG · max. 2 MB</p>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
          event.target.value = '';
        }}
      />
    </div>
  );
};

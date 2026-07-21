import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, DollarSign, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { QuickEntry } from '@/hooks/useQuickEntry';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

const TYPE_LABELS = {
  service: 'Servicio',
  cost: 'Costo/Gasto',
  inventory: 'Bodega',
  maintenance: 'Mantenimiento',
};

const TYPE_COLORS = {
  service: 'border-info/30 bg-info-soft text-info-text',
  cost: 'border-danger/30 bg-danger-soft text-danger-text',
  inventory: 'border-success/30 bg-success-soft text-success-text',
  maintenance: 'border-warning/30 bg-warning-soft text-warning-text',
};

interface QuickEntryPreviewProps {
  entry: QuickEntry;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (entry: QuickEntry) => void;
  onDiscard: (entry: QuickEntry) => void;
}

export function QuickEntryPreview({ 
  entry, 
  isOpen, 
  onClose, 
  onComplete, 
  onDiscard 
}: QuickEntryPreviewProps) {
  const rawPhotos = useMemo(() => {
    const photos = (entry.data as any)?.photos as Array<{ path?: string; signedUrl?: string }> | undefined;
    return Array.isArray(photos) ? photos : [];
  }, [entry.data]);

  const [photoUrls, setPhotoUrls] = useState<Array<{ path: string | undefined; url: string }>>([]);
  const [failedPhotoKeys, setFailedPhotoKeys] = useState<Record<string, true>>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!isOpen) {
        setPhotoUrls([]);
        return;
      }
      if (rawPhotos.length === 0) {
        setPhotoUrls([]);
        return;
      }

      const results = await Promise.all(
        rawPhotos.map(async (photo) => {
          const existing = typeof photo.signedUrl === 'string' ? photo.signedUrl : '';
          if (!photo.path) {
            return existing ? { path: undefined, url: existing } : null;
          }

          const { data, error } = await supabase.storage
            .from('quick-entry-photos')
            .createSignedUrl(photo.path, 60 * 60 * 24 * 7);

          if (error || !data?.signedUrl) {
            return existing ? { path: photo.path, url: existing } : null;
          }

          return { path: photo.path, url: data.signedUrl };
        }),
      );

      if (cancelled) return;
      setPhotoUrls(results.filter((value): value is { path: string | undefined; url: string } => value !== null));
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [isOpen, rawPhotos]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="configuration-dialog max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle>Vista Previa del Registro</DialogTitle>
              <Badge variant="outline" className={TYPE_COLORS[entry.type]}>
                {TYPE_LABELS[entry.type]}
              </Badge>
            </div>
            <span className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(entry.created_at!), { 
                addSuffix: true, 
                locale: es 
              })}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Main Information */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">{entry.description}</h3>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Fecha:</span>
                  <span className="font-medium">{new Date(entry.date).toLocaleDateString()}</span>
                </div>
                
                {entry.amount && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Monto:</span>
                    <span className="font-medium">${entry.amount.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {entry.notes && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="font-medium">Notas:</span>
                </div>
                <p className="text-sm bg-muted p-3 rounded-md">{entry.notes}</p>
              </div>
            )}
          </div>

          {photoUrls.length > 0 && (
            <div>
              <h4 className="font-medium mb-3">Comprobante (Fotos)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {photoUrls.map((photo, index) => (
                  <a
                    key={`${photo.path ?? 'inline'}-${index}`}
                    href={photo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-md border border-border overflow-hidden bg-background"
                  >
                    {failedPhotoKeys[`${photo.path ?? 'inline'}-${index}`] ? (
                      <div className="flex h-64 w-full items-center justify-center bg-overlay/5 px-4 text-center text-sm text-muted-foreground">
                        No se pudo cargar la foto. Toca para abrirla.
                      </div>
                    ) : (
                      <img
                        src={photo.url}
                        alt={`Comprobante ${index + 1}`}
                        className="h-64 w-full bg-overlay/5 object-contain"
                        loading="eager"
                        onError={() => {
                          const key = `${photo.path ?? 'inline'}-${index}`;
                          setFailedPhotoKeys((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
                        }}
                      />
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={() => onComplete(entry)}
              className="flex-1"
            >
              Convertir a {TYPE_LABELS[entry.type]}
            </Button>
            <Button
              variant="outline"
              onClick={() => onDiscard(entry)}
              className="flex-1"
            >
              Descartar
            </Button>
            <Button
              variant="ghost"
              onClick={onClose}
            >
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

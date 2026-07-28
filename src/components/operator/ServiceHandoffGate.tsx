import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, HandshakeIcon, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PhotoProcessor } from '@/utils/photoProcessor';
import { uploadInspectionPhoto } from '@/utils/photoUpload';
import { businessClock } from '@/utils/businessClock';
import { useConfirmServiceHandoff } from '@/hooks/operator/useServiceHandoff';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ServiceHandoffGate');

const MIN_PHOTOS = 2;
const MAX_PHOTOS = 4;

interface CapturedPhoto {
  path: string;
  previewUrl: string;
}

interface ServiceHandoffGateProps {
  serviceId: string;
  folio: string;
}

/**
 * Recepción de un servicio que ya venía rodando con otro operador.
 *
 * Mientras el traspaso esté pendiente, el operador entrante no opera: primero
 * deja constancia del estado en que recibe la carga. Es la única ventana en que
 * esa evidencia se puede levantar —después, cualquier daño queda sin tramo al
 * que atribuirse— y por eso el bloqueo es previo a las acciones, no un recordatorio.
 *
 * Las fotos suben a inspection-photos bajo el prefijo del servicio con nombre
 * handoff-<timestamp>: caen en el mismo expediente que el resto de la evidencia
 * y quedan visibles para administración sin trabajo extra.
 */
export const ServiceHandoffGate = ({ serviceId, folio }: ServiceHandoffGateProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmHandoff = useConfirmServiceHandoff();

  useEffect(() => () => {
    photos.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
  }, [photos]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(`Máximo ${MAX_PHOTOS} fotos`);
      return;
    }

    setIsUploading(true);
    try {
      const accepted: CapturedPhoto[] = [];

      for (const file of Array.from(files).slice(0, room)) {
        if (!PhotoProcessor.validateImageFile(file)) {
          toast.error('Solo se permiten imágenes');
          continue;
        }

        const processed = await PhotoProcessor.processImage(file, `handoff-${businessClock.nowISO()}`);
        // Se sube en el momento: si el teléfono se apaga a mitad del relevo, la
        // evidencia ya está arriba y no depende de que la pantalla sobreviva.
        const path = await uploadInspectionPhoto(processed.name, processed.blob, serviceId);
        accepted.push({ path, previewUrl: URL.createObjectURL(processed.blob) });
      }

      if (accepted.length > 0) {
        setPhotos(prev => [...prev, ...accepted]);
      }
    } catch (error) {
      logger.error('Error subiendo fotos del traspaso', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo subir la foto');
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removePhoto = (path: string) => {
    setPhotos(prev => {
      const target = prev.find(photo => photo.path === path);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(photo => photo.path !== path);
    });
  };

  const handleConfirm = async () => {
    try {
      await confirmHandoff.mutateAsync({
        serviceId,
        folio,
        photoPaths: photos.map(photo => photo.path),
        notes: notes.trim() || undefined,
      });
      toast.success('Recepción confirmada. Ya puedes operar el servicio.');
      setIsOpen(false);
      setPhotos([]);
      setNotes('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo confirmar la recepción');
    }
  };

  const canConfirm = photos.length >= MIN_PHOTOS && photos.length <= MAX_PHOTOS && !confirmHandoff.isPending;

  return (
    <>
      <div className="operator-service-action mt-4 rounded-2xl bg-warning-soft px-4 py-3 text-center">
        <p className="flex items-center justify-center gap-2 text-sm font-bold text-warning-text">
          <HandshakeIcon className="size-4" />
          Recepción pendiente
        </p>
        <p className="mt-1 text-xs text-warning-text/80">
          Este servicio venía con otro operador. Registra el estado de la carga antes de continuar.
        </p>
        <Button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-3 min-h-12 w-full rounded-2xl text-sm font-bold"
        >
          Recibir servicio
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => { if (!confirmHandoff.isPending) setIsOpen(open); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recibir servicio {folio}</DialogTitle>
            <DialogDescription>
              Toma entre {MIN_PHOTOS} y {MAX_PHOTOS} fotos del estado en que recibes la carga.
              Quedan en el expediente del servicio con tu nombre y la hora.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="sr-only"
              onChange={(event) => void handleFiles(event.target.files)}
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading || photos.length >= MAX_PHOTOS}
              className="min-h-12 w-full rounded-2xl"
            >
              {isUploading ? (
                <><Loader2 className="size-4 animate-spin" /> Subiendo…</>
              ) : (
                <><Camera className="size-4" /> Tomar foto ({photos.length}/{MAX_PHOTOS})</>
              )}
            </Button>

            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {photos.map(photo => (
                  <div key={photo.path} className="relative overflow-hidden rounded-xl border border-border">
                    <img src={photo.previewUrl} alt="Estado de la carga" className="h-28 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.path)}
                      className="absolute right-1 top-1 rounded-full bg-background/90 p-1.5 text-destructive"
                      aria-label="Quitar foto"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="handoff-notes">Observaciones (opcional)</Label>
              <Textarea
                id="handoff-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ej: rayón previo en costado derecho"
                rows={3}
              />
            </div>

            {photos.length < MIN_PHOTOS && (
              <p className="text-xs text-muted-foreground">
                Faltan {MIN_PHOTOS - photos.length} foto{MIN_PHOTOS - photos.length === 1 ? '' : 's'} para poder confirmar.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={confirmHandoff.isPending}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleConfirm()} disabled={!canConfirm}>
              {confirmHandoff.isPending ? 'Confirmando…' : 'Confirmar recepción'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Camera, FileText, Send } from 'lucide-react';
import { fetchRegenerarInspectionPreview, useRegenerarPdfManager } from '@/hooks/useRegenerarInspeccion';
import { RegenerarInspeccionKind, ServicioConFotos } from '@/types/regenerar-inspeccion';
import { ConfirmarEnvioDialog } from './ConfirmarEnvioDialog';

interface PreviewInspeccionDialogProps {
  servicio: ServicioConFotos | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PreviewInspeccionDialog = ({ servicio, open, onOpenChange }: PreviewInspeccionDialogProps) => {
  const [kind, setKind] = useState<RegenerarInspeccionKind>('initial');
  const [enviarWhatsapp, setEnviarWhatsapp] = useState(true);
  const [motivo, setMotivo] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const manager = useRegenerarPdfManager();

  const query = useQuery({
    queryKey: ['regenerar-inspeccion-preview', servicio?.serviceId],
    queryFn: () => fetchRegenerarInspectionPreview(servicio!.serviceId),
    enabled: open && !!servicio?.serviceId,
    staleTime: 60 * 1000,
  });

  const hasExistingPdf = useMemo(() => {
    if (!query.data) return false;
    return kind === 'initial' ? Boolean(query.data.currentPdfPath) : Boolean(query.data.currentFinalPdfPath);
  }, [kind, query.data]);

  const handleConfirm = () => {
    if (!servicio) return;
    manager.mutate(
      { serviceId: servicio.serviceId, kind, enviarWhatsapp, motivo },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          onOpenChange(false);
          setMotivo('');
        },
      },
    );
  };

  if (!servicio) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Previsualizar inspección #{servicio.folio}</DialogTitle>
            <DialogDescription>
              Revise la evidencia disponible antes de generar un nuevo PDF.
            </DialogDescription>
          </DialogHeader>

          {query.isLoading && (
            <div className="rounded-lg border bg-muted/40 p-6 text-sm text-muted-foreground">
              Cargando fotos y datos de inspección...
            </div>
          )}

          {query.error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {query.error instanceof Error ? query.error.message : 'No se pudo cargar la previsualización'}
            </div>
          )}

          {query.data && (
            <div className="grid max-h-[70vh] gap-5 overflow-y-auto pr-1 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Camera className="size-4 text-primary" />
                    Fotos disponibles
                  </h3>
                  <Badge variant="secondary">{query.data.photos.length}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {query.data.photos.map((photo) => (
                    <figure key={photo.path} className="overflow-hidden rounded-lg border bg-card">
                      <img src={photo.signedUrl} alt={photo.category} className="aspect-[4/3] w-full object-cover" />
                      <figcaption className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                        {photo.category} · {photo.fileName}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <section className="rounded-lg border bg-card p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <FileText className="size-4 text-primary" />
                    Datos del servicio
                  </h3>
                  <dl className="grid gap-2 text-sm">
                    <div><dt className="text-muted-foreground">Cliente</dt><dd className="font-medium">{query.data.service.client.name}</dd></div>
                    <div><dt className="text-muted-foreground">Operador</dt><dd>{query.data.service.operator?.name || 'Sin operador'}</dd></div>
                    <div><dt className="text-muted-foreground">Vehículo</dt><dd>{query.data.service.vehicleBrand} {query.data.service.vehicleModel} · {query.data.service.licensePlate}</dd></div>
                    <div><dt className="text-muted-foreground">Origen / destino</dt><dd>{query.data.service.origin} → {query.data.service.destination}</dd></div>
                  </dl>
                </section>

                <section className="rounded-lg border bg-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">Datos de inspección</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-muted-foreground">Checklist:</span> {query.data.inspection.equipment?.length || 0} item(s)</p>
                    <p><span className="text-muted-foreground">Observaciones:</span> {query.data.inspection.vehicleObservations || 'Sin observaciones'}</p>
                    <p><span className="text-muted-foreground">PDF inicial actual:</span> {query.data.currentPdfPath ? 'Sí' : 'No'}</p>
                    <p><span className="text-muted-foreground">PDF entrega actual:</span> {query.data.currentFinalPdfPath ? 'Sí' : 'No'}</p>
                  </div>
                </section>

                <Separator />

                <div className="space-y-3">
                  <Label>Tipo de inspección a regenerar</Label>
                  <RadioGroup value={kind} onValueChange={(value) => setKind(value as RegenerarInspeccionKind)} className="grid grid-cols-2 gap-2">
                    <Label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3">
                      <RadioGroupItem value="initial" />
                      Inicial
                    </Label>
                    <Label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3">
                      <RadioGroupItem value="final" />
                      Entrega
                    </Label>
                  </RadioGroup>
                </div>

                <Label className="flex items-center gap-2 rounded-lg border p-3">
                  <Checkbox checked={enviarWhatsapp} onCheckedChange={(checked) => setEnviarWhatsapp(Boolean(checked))} />
                  Enviar al cliente por WhatsApp tras regenerar
                </Label>

                <div className="space-y-2">
                  <Label htmlFor="motivo-regeneracion">
                    Motivo de regeneración {hasExistingPdf ? <span className="text-destructive">*</span> : null}
                  </Label>
                  <Textarea
                    id="motivo-regeneracion"
                    value={motivo}
                    onChange={(event) => setMotivo(event.target.value)}
                    placeholder="Ej: PDF original dañado, recuperación administrativa, corrección solicitada..."
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={manager.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={!query.data || manager.isPending}>
              <Send className="mr-2 size-4" />
              Regenerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmarEnvioDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        folio={servicio.folio}
        kind={kind}
        enviarWhatsapp={enviarWhatsapp}
        isPending={manager.isPending}
        hasExistingPdf={hasExistingPdf}
        motivo={motivo}
        onConfirm={handleConfirm}
      />
    </>
  );
};

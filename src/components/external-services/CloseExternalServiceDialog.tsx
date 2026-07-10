import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { SignaturePad, type SignaturePadRef } from '@/components/operator/SignaturePad';
import { EvidenceUploadCard } from './EvidenceUploadCard';
import { useCloseExternalService, useServiceEvidence } from '@/hooks/useExternalServiceClosure';
import { useUser } from '@/contexts/UserContext';
import type { ExternalServiceListItem } from '@/hooks/useExternalServices';
import { toast } from 'sonner';
import { formatBusinessDateLong } from '@/utils/timezoneUtils';
import { Building2, FileCheck2 } from 'lucide-react';

interface Props {
  service: ExternalServiceListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CloseExternalServiceDialog = ({ service, open, onOpenChange }: Props) => {
  const [providerName, setProviderName] = useState('');
  const [providerRut, setProviderRut] = useState('');
  const [summary, setSummary] = useState('');
  const [notes, setNotes] = useState('');
  const [signature, setSignature] = useState('');
  const sigRef = useRef<SignaturePadRef>(null);
  const close = useCloseExternalService();
  const { data: evidences = [] } = useServiceEvidence(service?.id);
  const { user } = useUser();

  useEffect(() => {
    if (!open) {
      setProviderName('');
      setProviderRut('');
      setSummary('');
      setNotes('');
      setSignature('');
      sigRef.current?.clear();
    }
  }, [open]);

  if (!service) return null;

  const handleClose = async () => {
    if (!providerName.trim()) return toast.error('Indica el nombre del proveedor externo');
    if (!summary.trim()) return toast.error('Describe el trabajo realizado por el tercero');
    if (!signature) return toast.error('Firma del administrador requerida');
    if (evidences.length === 0) {
      return toast.error('Sube al menos un archivo de evidencia antes de cerrar el servicio');
    }
    if (!user?.name) return toast.error('Tu perfil no tiene nombre. Configúralo antes de cerrar.');

    try {
      await close.mutateAsync({
        serviceId: service.id,
        thirdPartyProviderName: providerName.trim(),
        thirdPartyProviderRut: providerRut.trim() || undefined,
        thirdPartyServiceSummary: summary.trim(),
        closureNotes: notes.trim() || undefined,
        adminSignature: signature,
        adminName: user.name,
      });
      onOpenChange(false);
    } catch {
      // no-op: onError already handled it
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-4xl flex-col p-0">
        <DialogHeader className="px-6 pb-2 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-5 text-purple-600" />
            Cerrar servicio externo · Folio {service.folio}
          </DialogTitle>
          <DialogDescription>
            Registra la evidencia entregada por el proveedor y emite el cierre administrativo del servicio.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 pb-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Servicio</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Tipo</Label>
                  <div className="font-medium">{service.serviceTypeName}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fecha</Label>
                  <div className="font-medium">{formatBusinessDateLong(service.serviceDate)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <div className="font-medium">{service.clientName ?? '—'}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Vehículo</Label>
                  <div className="font-medium">
                    {service.vehicleBrand ? `${service.vehicleBrand} ${service.vehicleModel ?? ''} (${service.licensePlate ?? 'S/P'})` : '—'}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Proveedor externo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Nombre del proveedor *</Label>
                    <Input
                      value={providerName}
                      onChange={(e) => setProviderName(e.target.value)}
                      className="mt-1"
                      placeholder="Ej. Grúas del Norte SpA"
                    />
                  </div>
                  <div>
                    <Label>RUT del proveedor</Label>
                    <Input
                      value={providerRut}
                      onChange={(e) => setProviderRut(e.target.value)}
                      className="mt-1"
                      placeholder="76.123.456-7"
                    />
                  </div>
                </div>
                <div>
                  <Label>Resumen del trabajo realizado *</Label>
                  <Textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Detalle de lo ejecutado por el proveedor externo..."
                    className="mt-1 min-h-[100px]"
                  />
                </div>
                <div>
                  <Label>Observaciones del cierre (opcional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas internas para el archivo..."
                    className="mt-1 min-h-[60px]"
                  />
                </div>
              </CardContent>
            </Card>

            <EvidenceUploadCard serviceId={service.id} />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Firma del administrador</CardTitle>
              </CardHeader>
              <CardContent>
                <SignaturePad
                  ref={sigRef}
                  label="Firma"
                  personName={user?.name ?? 'Administrador'}
                  signature={signature}
                  onSignatureChange={setSignature}
                />
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <Separator />

        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={close.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleClose} disabled={close.isPending} className="bg-purple-600 hover:bg-purple-700">
            <FileCheck2 className="mr-2 size-4" />
            {close.isPending ? 'Cerrando...' : 'Cerrar con evidencia'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Building2 } from 'lucide-react';
import { EvidenceUploadCard } from './EvidenceUploadCard';
import { useServiceClosure } from '@/hooks/useExternalServiceClosure';
import { formatBusinessDateLong } from '@/utils/timezoneUtils';
import type { ExternalServiceListItem } from '@/hooks/useExternalServices';

interface Props {
  service: ExternalServiceListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ExternalServiceDetailsDialog = ({ service, open, onOpenChange }: Props) => {
  const { data: closure } = useServiceClosure(service?.id);

  if (!service) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-4xl flex-col p-0">
        <DialogHeader className="px-6 pb-2 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-5 text-purple-600" />
            Servicio externo cerrado · Folio {service.folio}
          </DialogTitle>
          <DialogDescription>
            Detalle del cierre administrativo y evidencia del proveedor externo.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 pb-6">
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

            {closure && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Cierre administrativo</span>
                    <Badge className="border-green-300 bg-green-100 text-green-800">
                      Cerrado · {formatBusinessDateLong(closure.closedAt)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Proveedor externo</Label>
                      <div className="font-medium">{closure.thirdPartyProviderName}</div>
                    </div>
                    {closure.thirdPartyProviderRut && (
                      <div>
                        <Label className="text-xs text-muted-foreground">RUT proveedor</Label>
                        <div className="font-medium">{closure.thirdPartyProviderRut}</div>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Resumen del trabajo</Label>
                    <div className="whitespace-pre-wrap">{closure.thirdPartyServiceSummary}</div>
                  </div>
                  {closure.closureNotes && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Observaciones</Label>
                      <div className="whitespace-pre-wrap italic text-muted-foreground">{closure.closureNotes}</div>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground">Cerrado por</Label>
                    <div className="font-medium">{closure.adminName}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            <EvidenceUploadCard serviceId={service.id} readOnly />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

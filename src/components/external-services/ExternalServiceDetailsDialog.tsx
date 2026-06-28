import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Download, Mail } from 'lucide-react';
import { EvidenceUploadCard } from './EvidenceUploadCard';
import { SendExternalActaDialog } from './SendExternalActaDialog';
import { useServiceClosure, downloadExternalActa, regenerateActaPdf } from '@/hooks/useExternalServiceClosure';
import { formatBusinessDateLong } from '@/utils/timezoneUtils';
import { toast } from 'sonner';
import type { ExternalServiceListItem } from '@/hooks/useExternalServices';

interface Props {
  service: ExternalServiceListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ExternalServiceDetailsDialog = ({ service, open, onOpenChange }: Props) => {
  const { data: closure } = useServiceClosure(service?.id);
  const [sendOpen, setSendOpen] = useState(false);

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

            {closure && closure.pdfPath && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Acta de Servicio Externo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    El PDF del Acta ya está generado y disponible.
                    {closure.emailSendCount > 0 && (
                      <> Se ha enviado <strong>{closure.emailSendCount}</strong> vez(es) por email.</>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await downloadExternalActa(closure.pdfPath!);
                        } catch (e: any) {
                          // Si el archivo no existe, intentar regenerar
                          if (e.message?.includes('no encontrado') || e.message?.includes('404')) {
                            toast.info('PDF no encontrado, regenerando...');
                            try {
                              const newPath = await regenerateActaPdf(service.id);
                              await downloadExternalActa(newPath);
                              toast.success('Acta regenerada y descargada');
                            } catch (re: any) {
                              toast.error('Error al regenerar', { description: re.message });
                            }
                          } else {
                            toast.error('Error al descargar', { description: e.message });
                          }
                        }
                      }}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800"
                    >
                      <Download className="size-4 mr-2" />
                      Descargar Acta PDF
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setSendOpen(true)}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Mail className="size-4 mr-2" />
                      {closure.emailSendCount > 0 ? 'Reenviar por email' : 'Enviar por email'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <EvidenceUploadCard serviceId={service.id} readOnly />
          </div>
        </ScrollArea>
      </DialogContent>

      {closure && (
        <SendExternalActaDialog
          serviceId={service.id}
          folio={service.folio}
          emailSentTo={closure.emailSentTo}
          emailSentAt={closure.emailSentAt}
          emailSendCount={closure.emailSendCount}
          open={sendOpen}
          onOpenChange={setSendOpen}
        />
      )}
    </Dialog>
  );
};

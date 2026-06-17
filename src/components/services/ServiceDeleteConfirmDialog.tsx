import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { useReAuth } from '@/hooks/useReAuth';
import { Service } from '@/types';
import { useServiceDependencies } from '@/hooks/useServiceDependencies';

interface ServiceDeleteConfirmDialogProps {
  service: Service | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: (service: Service) => void;
}

export const ServiceDeleteConfirmDialog = ({
  service,
  open,
  onOpenChange,
  onConfirmDelete,
}: ServiceDeleteConfirmDialogProps) => {
  const { verifyPassword } = useReAuth();
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const serviceId = open && service ? service.id : null;
  const { dependencies, isLoading, hasRelatedData } = useServiceDependencies(serviceId);

  useEffect(() => {
    if (open) {
      setPassword('');
      setPasswordError('');
    }
  }, [open, service]);

  const handleDelete = async () => {
    if (!service) return;

    if (!password.trim()) {
      setPasswordError('Ingrese su contraseña');
      return;
    }

    setVerifying(true);
    setPasswordError('');

    try {
      await verifyPassword(password);
    } catch {
      setPasswordError('Error al verificar contraseña');
      setVerifying(false);
      return;
    }

    setVerifying(false);
    onConfirmDelete(service);
    onOpenChange(false);
  };

  const isInvoiced = service?.status === 'invoiced';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/70 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="size-5 text-danger" />
            Eliminar Servicio
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        {service && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-background/50 p-3">
              <p className="font-medium text-sm text-foreground">{service.folio}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {service.serviceDate} — {service.client?.name || 'Sin cliente'}
              </p>
            </div>

            {isInvoiced && (
              <div className="rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
                No se puede eliminar un servicio facturado.
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-sm">Verificando datos relacionados...</span>
              </div>
            ) : (
              <>
                {hasRelatedData ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-warning">
                      <ShieldAlert className="size-4" />
                      <span className="text-sm font-medium">Este servicio tiene datos relacionados:</span>
                    </div>

                    <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3">
                      {dependencies?.costsCount ? (
                        <div className="flex items-center justify-between text-sm">
                          <span>{dependencies.costsCount} costo(s)</span>
                          <Badge variant="destructive" className="text-xs">Se eliminará</Badge>
                        </div>
                      ) : null}
                      {dependencies?.inspectionsCount ? (
                        <div className="flex items-center justify-between text-sm">
                          <span>{dependencies.inspectionsCount} inspección(es)</span>
                          <Badge variant="destructive" className="text-xs">Se eliminará</Badge>
                        </div>
                      ) : null}
                      {dependencies?.calendarCount ? (
                        <div className="flex items-center justify-between text-sm">
                          <span>{dependencies.calendarCount} evento(s) calendario</span>
                          <Badge variant="destructive" className="text-xs">Se eliminará</Badge>
                        </div>
                      ) : null}
                      {dependencies?.closuresCount ? (
                        <div className="flex items-center justify-between text-sm">
                          <span>{dependencies.closuresCount} vínculo(s) a cierre</span>
                          <Badge variant="secondary" className="text-xs">Se desvinculará</Badge>
                        </div>
                      ) : null}
                      {dependencies?.invoicesCount ? (
                        <div className="flex items-center justify-between text-sm">
                          <span>{dependencies.invoicesCount} vínculo(s) a factura</span>
                          <Badge variant="secondary" className="text-xs">Se desvinculará</Badge>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Este servicio no tiene datos relacionados detectados.
                  </p>
                )}

                <div className="space-y-2 border-t border-border/70 pt-2">
                  <Label htmlFor="delete-service-password" className="text-sm">
                    Ingrese su contraseña para confirmar
                  </Label>
                  <Input
                    id="delete-service-password"
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
                    disabled={isInvoiced}
                  />
                  {passwordError && (
                    <p className="text-xs text-destructive">{passwordError}</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={verifying}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading || verifying || isInvoiced || !password.trim()}
          >
            {verifying ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <Trash2 className="size-4 mr-2" />
                Eliminar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

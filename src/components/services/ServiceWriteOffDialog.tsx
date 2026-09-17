import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Ban, Loader2, RotateCcw, ShieldAlert } from 'lucide-react';
import { useReAuth } from '@/hooks/useReAuth';
import { useServiceDependencies } from '@/hooks/useServiceDependencies';
import { formatCurrency } from '@/utils/statusHelpers';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { Service } from '@/types';

export type WriteOffMode = 'write_off' | 'revert';

interface ServiceWriteOffDialogProps {
  service: Service | null;
  mode: WriteOffMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ya re-autenticado: ejecuta el RPC. `reason` viene vacío al revertir. */
  onConfirm: (service: Service, reason: string) => void | Promise<void>;
  isSubmitting?: boolean;
}

/**
 * Castigar / revertir un servicio incobrable.
 *
 * Replica el mecanismo de contraseña del flujo de eliminación
 * (`ServiceDeleteConfirmDialog` + `useReAuth`): la re-autenticación ocurre en
 * el cliente antes de llamar al RPC. Lo que decide de verdad es el servidor
 * —rol admin, estado 'completed', motivo no vacío y ausencia de vínculo a
 * factura o cierre—; acá el admin ve por qué no se puede antes de intentarlo.
 */
export const ServiceWriteOffDialog = ({
  service,
  mode,
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
}: ServiceWriteOffDialogProps) => {
  const { verifyPassword } = useReAuth();
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [reasonError, setReasonError] = useState('');

  const isRevert = mode === 'revert';
  const serviceId = open && service && !isRevert ? service.id : null;
  const { dependencies, isLoading, hasRelatedData: _hasRelatedData } = useServiceDependencies(serviceId);

  useEffect(() => {
    if (open) {
      setPassword('');
      setReason('');
      setPasswordError('');
      setReasonError('');
    }
  }, [open, service, mode]);

  // Un vínculo vivo a factura o cierre contradice el castigo: dice que sí se
  // cobró. El RPC lo rechaza igual; acá se explica antes de pedir la clave.
  const linkedInvoices = dependencies?.invoicesCount ?? 0;
  const linkedClosures = dependencies?.closuresCount ?? 0;
  const isLinked = !isRevert && (linkedInvoices > 0 || linkedClosures > 0);
  const isWrongStatus = !isRevert && !!service && service.status !== 'completed';
  const isBlocked = isLinked || isWrongStatus;

  const handleConfirm = async () => {
    if (!service || isBlocked) return;

    const trimmedReason = reason.trim();
    if (!isRevert && !trimmedReason) {
      setReasonError('El motivo del castigo es obligatorio');
      return;
    }

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
    await onConfirm(service, trimmedReason);
    onOpenChange(false);
  };

  const busy = verifying || isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/70 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {isRevert ? (
              <>
                <RotateCcw className="size-5 text-info" />
                Revertir castigo
              </>
            ) : (
              <>
                <Ban className="size-5 text-danger" />
                Castigar servicio
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isRevert
              ? 'El servicio volverá a estado completado y quedará otra vez como pendiente de facturar.'
              : 'El servicio se declara incobrable: sale de pendientes de facturar y de los candidatos a cierre.'}
          </DialogDescription>
        </DialogHeader>

        {service && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-background/50 p-3">
              <p className="font-medium text-sm text-foreground">{service.folio}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {service.serviceDate} — {service.client?.name || 'Sin cliente'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Valor: {formatCurrency(getDisplayServiceValue(service))}
              </p>
            </div>

            {isRevert && service.writtenOffReason && (
              <div className="rounded-xl border border-border/70 bg-background/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">Motivo registrado</p>
                <p className="text-sm text-foreground mt-1">{service.writtenOffReason}</p>
              </div>
            )}

            {isWrongStatus && (
              <div className="rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
                Solo se puede castigar un servicio completado.
              </div>
            )}

            {!isRevert && isLoading ? (
              <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-sm">Verificando vínculos de facturación...</span>
              </div>
            ) : (
              <>
                {isLinked && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-warning">
                      <ShieldAlert className="size-4" />
                      <span className="text-sm font-medium">
                        Este servicio está vinculado a facturación:
                      </span>
                    </div>
                    <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3">
                      {linkedInvoices > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span>{linkedInvoices} vínculo(s) a factura</span>
                          <Badge variant="destructive" className="text-xs">Desvincular primero</Badge>
                        </div>
                      )}
                      {linkedClosures > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span>{linkedClosures} vínculo(s) a cierre</span>
                          <Badge variant="destructive" className="text-xs">Desvincular primero</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!isRevert && !isBlocked && (
                  <div className="space-y-2">
                    <Label htmlFor="write-off-reason" className="text-sm">
                      Motivo del castigo <span className="text-danger">*</span>
                    </Label>
                    <Textarea
                      id="write-off-reason"
                      placeholder="Ej: incobrable, nunca se facturó al cliente (auditoría contable)"
                      value={reason}
                      onChange={(e) => {
                        setReason(e.target.value);
                        setReasonError('');
                      }}
                      rows={3}
                    />
                    {reasonError && <p className="text-xs text-destructive">{reasonError}</p>}
                  </div>
                )}

                {!isBlocked && (
                  <div className="space-y-2 border-t border-border/70 pt-2">
                    <Label htmlFor="write-off-password" className="text-sm">
                      Ingrese su contraseña para confirmar
                    </Label>
                    <Input
                      id="write-off-password"
                      type="password"
                      placeholder="Contraseña"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                    />
                    {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
                  </div>
                )}

                {!isRevert && !isBlocked && (
                  <div className="flex items-start gap-2 rounded-xl border border-warning/20 bg-warning/10 p-3 text-xs text-warning-text">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>
                      Queda registrado en la auditoría con tu usuario. Un administrador puede
                      revertirlo desde el detalle del servicio.
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant={isRevert ? 'default' : 'destructive'}
            onClick={handleConfirm}
            disabled={(!isRevert && isLoading) || busy || isBlocked || !password.trim()}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                {verifying ? 'Verificando...' : 'Procesando...'}
              </>
            ) : isRevert ? (
              <>
                <RotateCcw className="size-4 mr-2" />
                Revertir castigo
              </>
            ) : (
              <>
                <Ban className="size-4 mr-2" />
                Castigar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

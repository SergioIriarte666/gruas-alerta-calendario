import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';

interface RelatedData {
  costs: number;
  inspections: number;
  calendarEvents: number;
  closureLinks: number;
  invoiceLinks: number;
}

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
  const [relatedData, setRelatedData] = useState<RelatedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const hasRelatedData = useMemo(() => {
    if (!relatedData) return false;
    return (
      relatedData.costs > 0 ||
      relatedData.inspections > 0 ||
      relatedData.calendarEvents > 0 ||
      relatedData.closureLinks > 0 ||
      relatedData.invoiceLinks > 0
    );
  }, [relatedData]);

  useEffect(() => {
    const fetchRelatedData = async (svc: Service) => {
      setLoading(true);
      setRelatedData(null);

      try {
        const [costsRes, inspRes, calRes, closRes, invRes] = await Promise.all([
          supabase.from('costs').select('id', { count: 'exact', head: true }).eq('service_id', svc.id),
          supabase.from('inspections').select('id', { count: 'exact', head: true }).eq('service_id', svc.id),
          supabase.from('calendar_events').select('id', { count: 'exact', head: true }).eq('service_id', svc.id),
          supabase.from('closure_services').select('id', { count: 'exact', head: true }).eq('service_id', svc.id),
          supabase.from('invoice_services').select('id', { count: 'exact', head: true }).eq('service_id', svc.id),
        ]);

        setRelatedData({
          costs: costsRes.count || 0,
          inspections: inspRes.count || 0,
          calendarEvents: calRes.count || 0,
          closureLinks: closRes.count || 0,
          invoiceLinks: invRes.count || 0,
        });
      } finally {
        setLoading(false);
      }
    };

    if (open && service) {
      setPassword('');
      setPasswordError('');
      fetchRelatedData(service);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No se pudo obtener el email del usuario');

      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (error) {
        setPasswordError('Contraseña incorrecta');
        setVerifying(false);
        return;
      }
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            Eliminar Servicio
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        {service && (
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium text-sm text-foreground">{service.folio}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {service.serviceDate} — {service.client?.name || 'Sin cliente'}
              </p>
            </div>

            {isInvoiced && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                No se puede eliminar un servicio facturado.
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-sm">Verificando datos relacionados...</span>
              </div>
            ) : (
              <>
                {hasRelatedData ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <ShieldAlert className="size-4" />
                      <span className="text-sm font-medium">Este servicio tiene datos relacionados:</span>
                    </div>

                    <div className="space-y-2">
                      {relatedData?.costs ? (
                        <div className="flex items-center justify-between text-sm">
                          <span>{relatedData.costs} costo(s)</span>
                          <Badge variant="destructive" className="text-xs">Se eliminará</Badge>
                        </div>
                      ) : null}
                      {relatedData?.inspections ? (
                        <div className="flex items-center justify-between text-sm">
                          <span>{relatedData.inspections} inspección(es)</span>
                          <Badge variant="destructive" className="text-xs">Se eliminará</Badge>
                        </div>
                      ) : null}
                      {relatedData?.calendarEvents ? (
                        <div className="flex items-center justify-between text-sm">
                          <span>{relatedData.calendarEvents} evento(s) calendario</span>
                          <Badge variant="destructive" className="text-xs">Se eliminará</Badge>
                        </div>
                      ) : null}
                      {relatedData?.closureLinks ? (
                        <div className="flex items-center justify-between text-sm">
                          <span>{relatedData.closureLinks} vínculo(s) a cierre</span>
                          <Badge variant="secondary" className="text-xs">Se desvinculará</Badge>
                        </div>
                      ) : null}
                      {relatedData?.invoiceLinks ? (
                        <div className="flex items-center justify-between text-sm">
                          <span>{relatedData.invoiceLinks} vínculo(s) a factura</span>
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

                <div className="space-y-2 pt-2 border-t">
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
            disabled={loading || verifying || isInvoiced || !password.trim()}
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

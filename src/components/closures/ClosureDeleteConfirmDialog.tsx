import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useReAuth } from '@/hooks/useReAuth';
import { ServiceClosure } from '@/types';

interface RelatedData {
  services: number;
  invoices: number;
}

interface ClosureDeleteConfirmDialogProps {
  closure: ServiceClosure | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: (closure: ServiceClosure) => void;
}

export const ClosureDeleteConfirmDialog = ({
  closure,
  open,
  onOpenChange,
  onConfirmDelete,
}: ClosureDeleteConfirmDialogProps) => {
  const { verifyPassword } = useReAuth();
  const [related, setRelated] = useState<RelatedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    const fetchRelated = async (cl: ServiceClosure) => {
      setLoading(true);
      try {
        const [servicesRes, invoicesRes] = await Promise.all([
          supabase.from('closure_services').select('id', { count: 'exact', head: true }).eq('closure_id', cl.id),
          supabase.from('invoice_closures').select('id', { count: 'exact', head: true }).eq('closure_id', cl.id),
        ]);
        setRelated({
          services: servicesRes.count || 0,
          invoices: invoicesRes.count || 0,
        });
      } finally {
        setLoading(false);
      }
    };
    if (open && closure) {
      setPassword('');
      setPasswordError('');
      fetchRelated(closure);
    }
  }, [open, closure]);

  const handleDelete = async () => {
    if (!closure) return;
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
    onConfirmDelete(closure);
    onOpenChange(false);
  };

  const isInvoiced = closure?.status === 'invoiced';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            Eliminar Cierre
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        {closure && (
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium text-sm text-foreground">{closure.folio}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {closure.dateRange.from} → {closure.dateRange.to}
              </p>
            </div>

            {isInvoiced && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                No se puede eliminar un cierre ya facturado.
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-sm">Verificando dependencias...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="size-4" />
                  <span className="text-sm font-medium">Este cierre tiene dependencias:</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{related?.services || 0} servicio(s) vinculados</span>
                    <Badge variant="secondary" className="text-xs">Se desvinculará</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>{related?.invoices || 0} factura(s) vinculadas</span>
                    <Badge variant="secondary" className="text-xs">Se desvinculará</Badge>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="delete-closure-password" className="text-sm">
                    Ingrese su contraseña para confirmar
                  </Label>
                  <Input
                    id="delete-closure-password"
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
                    disabled={isInvoiced}
                  />
                  {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
                </div>
              </div>
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

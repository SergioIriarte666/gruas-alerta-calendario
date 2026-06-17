import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Trash2, Package, CreditCard, Wrench, Loader2, ShieldAlert } from 'lucide-react';
import { useReAuth } from '@/hooks/useReAuth';
import { Cost } from '@/types/costs';
import { useCostDependencies } from '@/hooks/useCostDependencies';

interface CostDeleteConfirmDialogProps {
  cost: Cost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: (cost: Cost) => void;
}

export const CostDeleteConfirmDialog = ({ cost, open, onOpenChange, onConfirmDelete }: CostDeleteConfirmDialogProps) => {
  const { verifyPassword } = useReAuth();
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const costId = open && cost ? cost.id : null;
  const { dependencies, isLoading, hasRelatedData } = useCostDependencies(
    costId,
    cost?.supplier_payment_id,
  );

  useEffect(() => {
    if (open) {
      setPassword('');
      setPasswordError('');
    }
  }, [open, cost]);

  const handleDelete = async () => {
    if (!cost) return;

    if (hasRelatedData) {
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
    }

    onConfirmDelete(cost);
    onOpenChange(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/70 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="size-5 text-danger" />
            Eliminar Costo
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        {cost && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-background/50 p-3">
              <p className="font-medium text-sm text-foreground">{cost.description}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {formatCurrency(Number(cost.amount))} — {cost.date}
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-sm">Verificando datos relacionados...</span>
              </div>
            ) : hasRelatedData ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-warning">
                  <ShieldAlert className="size-4" />
                  <span className="text-sm font-medium">Este costo tiene datos relacionados:</span>
                </div>

                <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3">
                  {dependencies!.paymentsCount > 0 && (
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">
                        {dependencies!.paymentsCount} pago(s) de proveedor
                      </span>
                      <Badge variant="destructive" className="text-xs">Se eliminará</Badge>
                    </div>
                  )}
                  {dependencies!.movementsCount > 0 && (
                    <div className="flex items-center gap-2">
                      <Package className="size-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">
                        {dependencies!.movementsCount} movimiento(s) de inventario
                      </span>
                      <Badge variant="destructive" className="text-xs">Se cancelará</Badge>
                    </div>
                  )}
                  {dependencies!.partsCount > 0 && (
                    <div className="flex items-center gap-2">
                      <Wrench className="size-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">
                        {dependencies!.partsCount} pieza(s) de grúa
                      </span>
                      <Badge variant="secondary" className="text-xs">Se desvinculará</Badge>
                    </div>
                  )}
                </div>

                <div className="space-y-2 border-t border-border/70 pt-2">
                  <Label htmlFor="delete-password" className="text-sm">
                    Ingrese su contraseña para confirmar
                  </Label>
                  <Input
                    id="delete-password"
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
                  />
                  {passwordError && (
                    <p className="text-xs text-destructive">{passwordError}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Este costo no tiene datos relacionados y puede eliminarse directamente.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="border-border/70 bg-background/60" onClick={() => onOpenChange(false)} disabled={verifying}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading || verifying || (hasRelatedData && !password.trim())}
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

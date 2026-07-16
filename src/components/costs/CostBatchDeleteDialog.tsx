import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useReAuth } from '@/hooks/useReAuth';
import type { Cost } from '@/types/costs';

interface CostBatchDeleteDialogProps {
  costs: Cost[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (costIds: string[]) => Promise<void>;
}

export const CostBatchDeleteDialog = ({ costs, open, onOpenChange, onConfirm }: CostBatchDeleteDialogProps) => {
  const { verifyPassword } = useReAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const hasRelatedData = useMemo(
    () => costs.some((cost) => cost.inventory_movement_id || cost.supplier_payment_id),
    [costs],
  );

  useEffect(() => {
    if (open) {
      setPassword('');
      setError('');
    }
  }, [open]);

  const handleConfirm = async () => {
    if (costs.length === 0) return;

    setIsDeleting(true);
    setError('');

    try {
      if (hasRelatedData) {
        if (!password.trim()) {
          setError('Ingrese su contraseña');
          return;
        }
        await verifyPassword(password);
      }

      await onConfirm(costs.map((cost) => cost.id));
      onOpenChange(false);
    } catch {
      setError(hasRelatedData ? 'No fue posible completar la eliminación. Revise la notificación de error.' : '');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/70 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            Eliminar costos seleccionados
          </DialogTitle>
          <DialogDescription>
            Se eliminarán {costs.length} costos. Los movimientos de bodega vinculados se cancelarán y su stock se reversará.
          </DialogDescription>
        </DialogHeader>

        {hasRelatedData && (
          <div className="space-y-2">
            <Label htmlFor="batch-delete-password">Ingrese su contraseña para confirmar</Label>
            <Input
              id="batch-delete-password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError('');
              }}
              onKeyDown={(event) => event.key === 'Enter' && void handleConfirm()}
              disabled={isDeleting}
            />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void handleConfirm()} disabled={isDeleting || costs.length === 0}>
            {isDeleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
            Eliminar {costs.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

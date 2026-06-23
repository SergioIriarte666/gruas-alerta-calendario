
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePurchaseInvoices } from '@/hooks/usePurchaseInvoices';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


const logger = createLogger("BatchEditHistoricalPurchasesModal");
interface BatchEditHistoricalPurchasesModalProps {
  selectedIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialAction?: 'update_status' | 'update_description';
  lockAction?: boolean;
}

export const BatchEditHistoricalPurchasesModal: React.FC<BatchEditHistoricalPurchasesModalProps> = ({
  selectedIds,
  open,
  onOpenChange,
  onSuccess,
  initialAction = 'update_status',
  lockAction = false,
}) => {
  const { deleteInvoice, updateInvoice } = usePurchaseInvoices();
  const [action, setAction] = React.useState<'delete' | 'update_status' | 'update_description'>('update_status');
  const [newStatus, setNewStatus] = React.useState<string>('pending');
  const [newDescription, setNewDescription] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setAction(initialAction);
    setNewDescription('');
  }, [initialAction, open]);

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessing(true);

    try {
      if (action === 'delete') {
        await Promise.all(selectedIds.map(id => deleteInvoice(id)));
        toast.success(`${selectedIds.length} facturas eliminadas correctamente`);
      } else if (action === 'update_status') {
        await Promise.all(
            selectedIds.map(id => 
                updateInvoice({
                    id,
                    data: { status: newStatus },
                    suppressToast: true,
                })
            )
        );
        toast.success(`${selectedIds.length} facturas actualizadas correctamente`);
      } else if (action === 'update_description') {
        const trimmed = newDescription.trim();
        if (trimmed.length < 10 || trimmed.length > 500) {
          toast.error('La descripción debe tener entre 10 y 500 caracteres');
          return;
        }
        await Promise.all(
          selectedIds.map(id =>
            updateInvoice({
              id,
              data: { product_service_description: trimmed, description: trimmed },
              suppressToast: true,
            })
          )
        );
        toast.success(`${selectedIds.length} facturas actualizadas correctamente`);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      logger.error('Error en operación por lotes:', error);
      toast.error('Ocurrió un error al procesar las facturas');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{lockAction ? 'Editar glosa' : 'Edición Masiva'}</DialogTitle>
          <DialogDescription>
            {lockAction
              ? `La misma glosa se aplicará a ${selectedIds.length} facturas seleccionadas.`
              : `Acción para ${selectedIds.length} facturas seleccionadas.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {!lockAction && (
            <div className="grid gap-2">
              <Label>Acción</Label>
              <Select
                  value={action}
                  onValueChange={(val: 'delete' | 'update_status' | 'update_description') => setAction(val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="update_status">Cambiar Estado</SelectItem>
                  <SelectItem value="update_description">Editar glosa</SelectItem>
                  <SelectItem value="delete">Eliminar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {action === 'update_status' && (
            <div className="grid gap-2">
              <Label>Nuevo Estado</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="paid">Pagada</SelectItem>
                    <SelectItem value="overdue">Vencida</SelectItem>
                    <SelectItem value="cancelled">Anulada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {action === 'delete' && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-md text-sm">
              Advertencia: Esta acción no se puede deshacer. Se eliminarán permanentemente las facturas seleccionadas.
            </div>
          )}

          {action === 'update_description' && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="batch-purchase-description">Descripción de producto o servicio</Label>
                <span className={`text-xs ${newDescription.trim().length > 0 && newDescription.trim().length < 10 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {newDescription.trim().length}/500
                </span>
              </div>
              <Textarea
                id="batch-purchase-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Ej.: Compra de combustible para operación de grúas"
                className="resize-none"
                rows={4}
                maxLength={500}
                autoFocus={lockAction}
              />
              <p className="text-xs text-muted-foreground">Debe contener entre 10 y 500 caracteres.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isProcessing || (action === 'update_description' && newDescription.trim().length < 10)}
            variant={action === 'delete' ? 'destructive' : 'default'}
          >
            {isProcessing ? 'Procesando...' : action === 'update_description' ? 'Guardar glosa' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

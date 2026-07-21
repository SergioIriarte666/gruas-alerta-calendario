import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Edit, Trash2, Copy } from 'lucide-react';

interface ServiceBatchActionBarProps {
  selectedCount: number;
  totalAmount: number;
  onBatchClose: () => void;
  onBatchUpdate: () => void;
  onBatchDelete: () => void;
  onBatchDuplicate: () => void;
  onClearSelection: () => void;
  isProcessing?: boolean;
  canDelete?: boolean;
}

export const ServiceBatchActionBar = ({
  selectedCount,
  totalAmount,
  onBatchClose,
  onBatchUpdate,
  onBatchDelete,
  onBatchDuplicate,
  onClearSelection,
  isProcessing = false,
  canDelete = true,
}: ServiceBatchActionBarProps) => {
  return (
    <div className="sticky top-14 z-20 rounded-2xl border border-border/70 bg-card/95 shadow-sm backdrop-blur sm:top-16">
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="px-3 py-1.5">
              {selectedCount} {selectedCount === 1 ? 'servicio seleccionado' : 'servicios seleccionados'}
            </Badge>
            <div className="font-semibold text-primary">
              Total: ${totalAmount.toLocaleString('es-CL')}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onBatchClose}
              disabled={isProcessing}
              className="border-success/20 bg-success/10 text-success hover:bg-success/20"
            >
              <Check className="size-4 mr-2" />
              Cerrar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onBatchUpdate}
              disabled={isProcessing}
              className="border-border/70 bg-background/70"
            >
              <Edit className="size-4 mr-2" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onBatchDuplicate}
              disabled={isProcessing}
              className="border-border/70 bg-background/70"
            >
              <Copy className="size-4 mr-2" />
              Duplicar
            </Button>
            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onBatchDelete}
                disabled={isProcessing}
              >
                <Trash2 className="size-4 mr-2" />
                Eliminar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              disabled={isProcessing}
              className="text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-4 mr-2" />
              Limpiar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

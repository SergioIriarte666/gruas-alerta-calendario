import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, X, DollarSign } from 'lucide-react';

interface PipelineBatchActionBarProps {
  selectedCount: number;
  totalAmount: number;
  onBatchUpdate: () => void;
  onClearSelection: () => void;
}

export const PipelineBatchActionBar = ({
  selectedCount,
  totalAmount,
  onBatchUpdate,
  onClearSelection,
}: PipelineBatchActionBarProps) => {
  return (
    <div className="sticky top-0 z-50 bg-muted/95 backdrop-blur-sm border-b shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="px-3 py-1.5">
              {selectedCount} {selectedCount === 1 ? 'servicio seleccionado' : 'servicios seleccionados'}
            </Badge>
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <DollarSign className="size-4 text-violet-500" />
              <span>Total: ${totalAmount.toLocaleString('es-CL')}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={onBatchUpdate}
            >
              <RefreshCw className="size-4 mr-2" />
              Actualizar por Lotes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
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

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, X } from 'lucide-react';

interface CostBatchActionBarProps {
  selectedCount: number;
  totalAmount: number;
  onBatchUpdate: () => void;
  onClearSelection: () => void;
}

export const CostBatchActionBar = ({
  selectedCount,
  totalAmount,
  onBatchUpdate,
  onClearSelection,
}: CostBatchActionBarProps) => {
  return (
    <div className="sticky top-0 z-50 bg-muted/95 backdrop-blur-sm border-b shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="px-3 py-1.5">
              {selectedCount} {selectedCount === 1 ? 'costo seleccionado' : 'costos seleccionados'}
            </Badge>
            <div className="text-foreground font-semibold">
              Total: ${totalAmount.toLocaleString('es-CL')}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={onBatchUpdate}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar por Lotes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
            >
              <X className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

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
    <div className="sticky top-0 z-50 bg-primary/95 backdrop-blur-sm border-b shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 px-3 py-1.5">
              {selectedCount} {selectedCount === 1 ? 'costo seleccionado' : 'costos seleccionados'}
            </Badge>
            <div className="text-white font-semibold">
              Total: ${totalAmount.toLocaleString('es-CL')}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onBatchUpdate}
              className="bg-white hover:bg-white/90 text-primary"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar por Lotes
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="text-white hover:bg-white/20"
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

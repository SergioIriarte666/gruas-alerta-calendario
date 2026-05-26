import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, RefreshCw, X } from 'lucide-react';

interface CostBatchActionBarProps {
  selectedCount: number;
  totalAmount: number;
  onBatchUpdate: () => void;
  onBatchMarkPaid?: () => void;
  onClearSelection: () => void;
}

export const CostBatchActionBar = ({
  selectedCount,
  totalAmount,
  onBatchUpdate,
  onBatchMarkPaid,
  onClearSelection,
}: CostBatchActionBarProps) => {
  return (
    <div className="sticky top-14 z-20 rounded-2xl border border-border/70 bg-card/95 shadow-sm backdrop-blur sm:top-16">
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="px-3 py-1.5">
              {selectedCount} {selectedCount === 1 ? 'costo seleccionado' : 'costos seleccionados'}
            </Badge>
            <div className="font-semibold text-primary">
              Total: ${totalAmount.toLocaleString('es-CL')}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onBatchMarkPaid && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBatchMarkPaid}
                className="border-success/20 bg-success/10 text-success hover:bg-success/15"
              >
                <CheckCircle className="size-4 mr-2" />
                Marcar Pagados
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onBatchUpdate}
              className="border-border/70 bg-background/70"
            >
              <RefreshCw className="size-4 mr-2" />
              Actualizar por Lotes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
              className="border-border/70 bg-background/70"
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

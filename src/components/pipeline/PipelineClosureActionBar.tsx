import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FolderPlus, X, DollarSign } from 'lucide-react';

interface PipelineClosureActionBarProps {
  selectedCount: number;
  totalAmount: number;
  onCreateClosure: () => void;
  onClearSelection: () => void;
}

export const PipelineClosureActionBar = ({
  selectedCount,
  totalAmount,
  onCreateClosure,
  onClearSelection,
}: PipelineClosureActionBarProps) => {
  return (
    <div className="sticky bottom-0 z-40 bg-muted/95 backdrop-blur-sm border-t shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <Badge variant="secondary" className="px-3 py-1.5">
              {selectedCount} {selectedCount === 1 ? 'servicio seleccionado' : 'servicios seleccionados'}
            </Badge>
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <DollarSign className="size-4 text-primary" />
              <span>Total: ${totalAmount.toLocaleString('es-CL')}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={onCreateClosure}
              className="flex-1 sm:flex-none"
            >
              <FolderPlus className="size-4 mr-2" />
              Crear Cierre
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
              className="flex-1 sm:flex-none"
            >
              <X className="size-4 mr-2" />
              Limpiar selección
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCheck, UserX, X, Edit, Trash2 } from 'lucide-react';

interface ClientBatchActionBarProps {
  selectedCount: number;
  onBatchActivate: () => void;
  onBatchDeactivate: () => void;
  onBatchEdit: () => void;
  onBatchDelete: () => void;
  onClearSelection: () => void;
  isProcessing?: boolean;
}

export const ClientBatchActionBar = ({
  selectedCount,
  onBatchActivate,
  onBatchDeactivate,
  onBatchEdit,
  onBatchDelete,
  onClearSelection,
  isProcessing = false,
}: ClientBatchActionBarProps) => {
  return (
    <div className="sticky top-14 z-20 rounded-2xl border border-border/70 bg-card/95 shadow-sm backdrop-blur sm:top-16">
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="px-3 py-1.5">
              {selectedCount} {selectedCount === 1 ? 'cliente seleccionado' : 'clientes seleccionados'}
            </Badge>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={onBatchActivate}
              disabled={isProcessing}
              className="border-success/20 bg-success/10 text-success hover:bg-success/15"
            >
              <UserCheck className="size-4 mr-2" />
              Activar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onBatchDeactivate}
              disabled={isProcessing}
              className="border-warning/20 bg-warning/10 text-warning hover:bg-warning/15"
            >
              <UserX className="size-4 mr-2" />
              Desactivar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onBatchEdit}
              disabled={isProcessing}
              className="border-border/70 bg-background/70"
            >
              <Edit className="size-4 mr-2" />
              Editar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onBatchDelete}
              disabled={isProcessing}
            >
              <Trash2 className="size-4 mr-2" />
              Eliminar
            </Button>
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

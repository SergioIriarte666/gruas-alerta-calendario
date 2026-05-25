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
    <div className="sticky top-0 z-50 bg-muted/95 backdrop-blur-sm border-b shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="px-3 py-1.5">
              {selectedCount} {selectedCount === 1 ? 'cliente seleccionado' : 'clientes seleccionados'}
            </Badge>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="default"
              size="sm"
              onClick={onBatchActivate}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <UserCheck className="size-4 mr-2" />
              Activar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onBatchDeactivate}
              disabled={isProcessing}
            >
              <UserX className="size-4 mr-2" />
              Desactivar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onBatchEdit}
              disabled={isProcessing}
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

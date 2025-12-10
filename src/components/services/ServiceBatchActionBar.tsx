import React from 'react';
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
    <div className="sticky top-0 z-50 bg-muted/95 backdrop-blur-sm border-b shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="px-3 py-1.5">
              {selectedCount} {selectedCount === 1 ? 'servicio seleccionado' : 'servicios seleccionados'}
            </Badge>
            <div className="text-violet-600 font-semibold">
              Valor Total: ${totalAmount.toLocaleString('es-CL')}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="default"
              size="sm"
              onClick={onBatchClose}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="h-4 w-4 mr-2" />
              Cerrar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onBatchUpdate}
              disabled={isProcessing}
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onBatchDuplicate}
              disabled={isProcessing}
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicar
            </Button>
            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onBatchDelete}
                disabled={isProcessing}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              disabled={isProcessing}
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

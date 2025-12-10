import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';

interface ServiceBatchActionBarProps {
  selectedCount: number;
  totalAmount: number;
  onBatchClose: () => void;
  onClearSelection: () => void;
  isProcessing?: boolean;
}

export const ServiceBatchActionBar = ({
  selectedCount,
  totalAmount,
  onBatchClose,
  onClearSelection,
  isProcessing = false,
}: ServiceBatchActionBarProps) => {
  return (
    <div className="sticky top-0 z-50 bg-muted/95 backdrop-blur-sm border-b shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="px-3 py-1.5">
              {selectedCount} {selectedCount === 1 ? 'servicio seleccionado' : 'servicios seleccionados'}
            </Badge>
            <div className="text-violet-600 font-semibold">
              Valor Total: ${totalAmount.toLocaleString('es-CL')}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={onBatchClose}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="h-4 w-4 mr-2" />
              {isProcessing ? 'Cerrando...' : 'Cerrar Servicios'}
            </Button>
            <Button
              variant="outline"
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

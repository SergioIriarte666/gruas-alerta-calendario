import React from 'react';
import { AlertTriangle, Package, DollarSign, Warehouse } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import type { SimilarItem, SimilarityResult } from '@/utils/inventoryHelper';

interface SimilarProductAlertProps {
  similarityResult: SimilarityResult;
  onUseExisting: (item: SimilarItem) => void;
  onCreateNew: () => void;
  onViewDetails: (item: SimilarItem) => void;
}

export const SimilarProductAlert: React.FC<SimilarProductAlertProps> = ({
  similarityResult,
  onUseExisting,
  onCreateNew,
  onViewDetails
}) => {
  if (!similarityResult.shouldAlert) return null;

  const { exactMatch, similarItems, alertMessage } = similarityResult;
  const primaryItem = exactMatch || similarItems[0];

  if (!primaryItem) return null;

  return (
    <Alert className="border-warning bg-warning/5">
      <AlertTriangle className="size-4 text-warning" />
      <AlertDescription className="space-y-3">
        <p className="font-medium text-warning">{alertMessage}</p>
        
        {/* Información del producto principal */}
        <div className="bg-background rounded-lg p-3 border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium flex items-center gap-2">
              <Package className="size-4" />
              {primaryItem.name}
            </h4>
            <Badge variant={primaryItem.match_type === 'exact' ? 'destructive' : 'secondary'}>
              {primaryItem.match_type === 'exact' ? 'Coincidencia Exacta' : `${Math.round(primaryItem.similarity_score * 100)}% Similar`}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <DollarSign className="size-3" />
              <span>Precio: {formatCurrency(primaryItem.unit_cost)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Warehouse className="size-3" />
              <span>Stock: {primaryItem.current_stock} unidades</span>
            </div>
            {primaryItem.sku && (
              <div className="col-span-2">
                <span>SKU: {primaryItem.sku}</span>
              </div>
            )}
          </div>
        </div>

        {/* Productos similares adicionales */}
        {!exactMatch && similarItems.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Otros productos similares:</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {similarItems.slice(1, 4).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs bg-muted/50 rounded p-2">
                  <span className="truncate flex-1">{item.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {Math.round(item.similarity_score * 100)}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => onUseExisting(primaryItem)}
            className="flex-1 min-w-0"
          >
            Usar Existente
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewDetails(primaryItem)}
          >
            Ver Detalles
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCreateNew}
            className="flex-1 min-w-0"
          >
            Crear Nuevo
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};
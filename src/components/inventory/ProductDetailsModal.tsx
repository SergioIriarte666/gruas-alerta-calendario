import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Package, DollarSign, Warehouse, BarChart3 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { SimilarItem } from '@/utils/inventoryHelper';

interface ProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: SimilarItem | null;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  isOpen,
  onClose,
  product
}) => {
  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="inventory-dialog max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-5" />
            Detalles del Producto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Información General */}
          <div className="rounded-lg border border-border border-l-4 border-l-info bg-info-soft p-4">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-info">
              <div className="rounded bg-info/10 p-1 text-info">
                <BarChart3 className="size-4" />
              </div>
              Información General
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Nombre</label>
                <p className="font-medium">{product.name}</p>
              </div>
              
              {product.sku && (
                <div>
                  <label className="text-sm text-muted-foreground">SKU</label>
                  <p className="font-medium">{product.sku}</p>
                </div>
              )}
              
              <div>
                <label className="text-sm text-muted-foreground">Precio Unitario</label>
                <p className="font-medium flex items-center gap-1">
                  <DollarSign className="size-3" />
                  {formatCurrency(product.unit_cost)}
                </p>
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground">Stock Actual</label>
                <p className="font-medium flex items-center gap-1">
                  <Warehouse className="size-3" />
                  {product.current_stock} unidades
                </p>
              </div>
            </div>

            {/* Tipo de coincidencia */}
            <div className="mt-4 pt-3 border-t">
              <label className="text-sm text-muted-foreground">Tipo de Coincidencia</label>
              <div className="mt-1">
                <Badge variant={product.match_type === 'exact' ? 'destructive' : 'secondary'}>
                  {product.match_type === 'exact' 
                    ? 'Coincidencia Exacta (100%)' 
                    : `Similitud ${Math.round(product.similarity_score * 100)}%`
                  }
                </Badge>
              </div>
            </div>
          </div>

          {/* Valor del Inventario */}
          <div className="rounded-lg border border-border border-l-4 border-l-success bg-success-soft p-4">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-success">
              <div className="rounded bg-success/10 p-1 text-success">
                <DollarSign className="size-4" />
              </div>
              Valor del Inventario
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Valor Total en Stock</label>
                <p className="text-lg font-bold text-primary">
                  {formatCurrency(product.unit_cost * (product.current_stock || 0))}
                </p>
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground">Estado de Stock</label>
                <Badge variant={(product.current_stock || 0) > 0 ? 'default' : 'destructive'}>
                  {(product.current_stock || 0) > 0 ? 'Disponible' : 'Sin Stock'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Recomendación */}
          {product.match_type === 'exact' && (
            <div className="rounded-lg border border-border border-l-4 border-l-warning bg-warning-soft p-4">
              <h3 className="mb-2 flex items-center gap-2 font-semibold text-warning">
                <div className="rounded bg-warning/10 p-1 text-warning">
                  <Package className="size-4" />
                </div>
                Recomendación
              </h3>
              <p className="text-sm">
                Este producto ya existe en tu inventario con el mismo nombre. 
                Se recomienda <strong>usar el existente</strong> para evitar duplicados 
                y mantener un control de stock preciso.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

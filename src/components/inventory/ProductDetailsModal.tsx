import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Package, Calendar, DollarSign, AlertTriangle, BarChart3 } from 'lucide-react';
import { useInventoryMovements, type InventoryItem } from '@/hooks/useInventory';
import { format } from 'date-fns';

interface ProductDetailsModalProps {
  product: InventoryItem;
  onClose: () => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({ product, onClose }) => {
  // Get movements for this specific product
  const { data: movements = [] } = useInventoryMovements(20);
  const productMovements = movements.filter(m => m.item_id === product.id);

  const getStatusBadges = () => {
    const badges = [];
    
    if (product.is_active) {
      badges.push(<Badge key="active" variant="default">Activo</Badge>);
    } else {
      badges.push(<Badge key="inactive" variant="secondary">Inactivo</Badge>);
    }
    
    if (product.is_critical) {
      badges.push(<Badge key="critical" variant="destructive">Crítico</Badge>);
    }
    
    if (product.has_expiration) {
      badges.push(<Badge key="expiration" variant="outline">Con Vencimiento</Badge>);
    }
    
    return badges;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{product.name}</h3>
          {product.description && (
            <p className="text-muted-foreground mt-1">{product.description}</p>
          )}
          <div className="flex gap-2 mt-2">
            {getStatusBadges()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Información del Producto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Categoría</label>
              <p>{product.category?.name || 'Sin categoría'}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Unidad de Medida</label>
              <p className="capitalize">{product.unit_of_measure}</p>
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Stock Mínimo</label>
                <p className="text-orange-600 font-semibold">{product.minimum_stock}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Stock Máximo</label>
                <p className="text-green-600 font-semibold">{product.maximum_stock}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Stock Seguridad</label>
                <p className="text-blue-600 font-semibold">{product.safety_stock}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost and Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Información Financiera
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Costo Unitario</label>
              <p className="text-2xl font-bold text-green-600">
                ${(product.unit_cost || 0).toLocaleString()}
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Creado:</span>
                <span className="text-sm">
                  {format(new Date(product.created_at), 'dd/MM/yyyy HH:mm')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Actualizado:</span>
                <span className="text-sm">
                  {format(new Date(product.updated_at), 'dd/MM/yyyy HH:mm')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Movements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Movimientos Recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {productMovements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>No se encontraron movimientos para este producto</p>
            </div>
          ) : (
            <div className="space-y-3">
              {productMovements.slice(0, 5).map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant={movement.movement_type === 'entry' ? 'default' : 'secondary'}
                    >
                      {movement.movement_type === 'entry' ? 'Entrada' : 
                       movement.movement_type === 'exit' ? 'Salida' : 
                       movement.movement_type === 'transfer' ? 'Transferencia' : 'Ajuste'}
                    </Badge>
                    <div>
                      <p className="font-medium">
                        {movement.movement_type === 'entry' ? '+' : '-'}{movement.quantity} {product.unit_of_measure}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {movement.location?.name}
                      </p>
                      {movement.reason && (
                        <p className="text-xs text-muted-foreground">
                          {movement.reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {format(new Date(movement.movement_date), 'dd/MM/yyyy')}
                    </p>
                    {movement.total_cost && (
                      <p className="text-xs text-muted-foreground">
                        ${movement.total_cost.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              
              {productMovements.length > 5 && (
                <div className="text-center pt-2">
                  <Button variant="outline" size="sm">
                    Ver todos los movimientos ({productMovements.length})
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
        <Button variant="outline">
          Editar Producto
        </Button>
        <Button>
          Crear Movimiento
        </Button>
      </div>
    </div>
  );
};
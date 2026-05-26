import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface InventoryMovement {
  id: string;
  movement_date: string;
  movement_type: string;
  quantity: number;
  total_cost: number | null;
  reference_document: string | null;
  inventory_items: {
    name: string;
    sku: string | null;
    unit_of_measure: string;
  } | null;
  inventory_locations: {
    name: string;
  } | null;
}

interface SupplierInventoryTabProps {
  movements: InventoryMovement[];
  isLoading: boolean;
}

const getMovementTypeLabel = (type: string) => {
  switch (type) {
    case 'entry': return 'Entrada';
    case 'exit': return 'Salida';
    case 'adjustment': return 'Ajuste';
    case 'transfer': return 'Transferencia';
    default: return type;
  }
};

const getMovementTypeColor = (type: string) => {
  switch (type) {
    case 'entry': return 'border-success/30 bg-success/10 text-success';
    case 'exit': return 'border-danger/30 bg-danger/10 text-danger';
    case 'adjustment': return 'border-warning/30 bg-warning/10 text-warning';
    case 'transfer': return 'border-info/30 bg-info/10 text-info';
    default: return 'border-border/70 bg-muted/40 text-muted-foreground';
  }
};

export const SupplierInventoryTab: React.FC<SupplierInventoryTabProps> = ({ movements, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="size-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Sin movimientos</h3>
        <p className="text-muted-foreground">
          No hay movimientos de inventario registrados para este proveedor
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/70 bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border">
            <TableHead className="text-muted-foreground">Fecha</TableHead>
            <TableHead className="text-muted-foreground">Tipo</TableHead>
            <TableHead className="text-muted-foreground">Artículo</TableHead>
            <TableHead className="text-muted-foreground">Ubicación</TableHead>
            <TableHead className="text-muted-foreground text-right">Cantidad</TableHead>
            <TableHead className="text-muted-foreground text-right">Costo Total</TableHead>
            <TableHead className="text-muted-foreground">Documento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((movement) => (
            <TableRow key={movement.id} className="border-border">
              <TableCell className="text-foreground">
                {format(new Date(movement.movement_date), 'dd/MM/yyyy', { locale: es })}
              </TableCell>
              <TableCell>
                <Badge className={getMovementTypeColor(movement.movement_type)}>
                  {getMovementTypeLabel(movement.movement_type)}
                </Badge>
              </TableCell>
              <TableCell className="font-medium text-foreground">
                <div>
                  {movement.inventory_items?.name || '-'}
                  {movement.inventory_items?.sku && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({movement.inventory_items.sku})
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-foreground">
                {movement.inventory_locations?.name || '-'}
              </TableCell>
              <TableCell className="text-right text-foreground">
                {movement.quantity} {movement.inventory_items?.unit_of_measure || ''}
              </TableCell>
              <TableCell className="text-right text-foreground font-medium">
                {movement.total_cost ? formatCurrency(movement.total_cost) : '-'}
              </TableCell>
              <TableCell className="text-foreground text-sm">
                {movement.reference_document || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

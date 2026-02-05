import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface CranePart {
  id: string;
  date: string;
  part_name: string;
  quantity: number;
  unit_price: number;
  total_value: number | null;
  notes: string | null;
  cranes: {
    license_plate: string;
    brand: string;
    model: string;
  } | null;
}

interface SupplierPartsTabProps {
  parts: CranePart[];
  isLoading: boolean;
}

export const SupplierPartsTab: React.FC<SupplierPartsTabProps> = ({ parts, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (parts.length === 0) {
    return (
      <div className="text-center py-12">
        <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Sin piezas</h3>
        <p className="text-muted-foreground">
          No hay piezas de grúas registradas para este proveedor
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border">
            <TableHead className="text-muted-foreground">Fecha</TableHead>
            <TableHead className="text-muted-foreground">Grúa</TableHead>
            <TableHead className="text-muted-foreground">Pieza</TableHead>
            <TableHead className="text-muted-foreground text-right">Cantidad</TableHead>
            <TableHead className="text-muted-foreground text-right">Precio Unit.</TableHead>
            <TableHead className="text-muted-foreground text-right">Valor Total</TableHead>
            <TableHead className="text-muted-foreground">Notas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parts.map((part) => (
            <TableRow key={part.id} className="border-border">
              <TableCell className="text-foreground">
                {format(new Date(part.date), 'dd/MM/yyyy', { locale: es })}
              </TableCell>
              <TableCell className="text-foreground">
                {part.cranes ? (
                  <div>
                    <div className="font-medium">{part.cranes.license_plate}</div>
                    <div className="text-xs text-muted-foreground">
                      {part.cranes.brand} {part.cranes.model}
                    </div>
                  </div>
                ) : '-'}
              </TableCell>
              <TableCell className="font-medium text-foreground">
                {part.part_name}
              </TableCell>
              <TableCell className="text-right text-foreground">
                {part.quantity}
              </TableCell>
              <TableCell className="text-right text-foreground">
                {formatCurrency(part.unit_price)}
              </TableCell>
              <TableCell className="text-right text-foreground font-medium">
                {formatCurrency(part.total_value || part.quantity * part.unit_price)}
              </TableCell>
              <TableCell className="text-foreground text-sm max-w-[150px] truncate">
                {part.notes || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

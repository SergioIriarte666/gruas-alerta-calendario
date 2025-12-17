import React from 'react';
import { ServiceRateWithRelations } from '@/types/serviceRates';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Eye, Pencil, Trash2, MapPin, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface ServiceRatesTableProps {
  rates: ServiceRateWithRelations[];
  loading: boolean;
  onView: (rate: ServiceRateWithRelations) => void;
  onEdit: (rate: ServiceRateWithRelations) => void;
  onDelete: (rate: ServiceRateWithRelations) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}

export const ServiceRatesTable: React.FC<ServiceRatesTableProps> = ({
  rates,
  loading,
  onView,
  onEdit,
  onDelete,
  onToggleActive,
}) => {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (rates.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No hay tarifas registradas</p>
        <p className="text-sm">Crea una nueva tarifa para comenzar</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Cliente</TableHead>
            <TableHead>Tipo de Servicio</TableHead>
            <TableHead>Ruta</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-center">Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rates.map((rate) => (
            <TableRow key={rate.id} className="hover:bg-muted/30">
              <TableCell>
                <div>
                  <p className="font-medium">{rate.client?.name || 'N/A'}</p>
                  {rate.client?.department && (
                    <p className="text-xs text-muted-foreground">{rate.client.department}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {rate.service_type ? (
                  <Badge variant="outline">{rate.service_type.name}</Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">Todos</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm">
                  <span className="truncate max-w-[150px]" title={rate.origin}>
                    {rate.origin}
                  </span>
                  {rate.destination && (
                    <>
                      <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="truncate max-w-[150px]" title={rate.destination}>
                        {rate.destination}
                      </span>
                    </>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <span className="font-semibold text-violet-600">
                  {formatCurrency(rate.value)}
                </span>
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={rate.is_active}
                  onCheckedChange={(checked) => onToggleActive(rate.id, checked)}
                />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onView(rate)}
                    title="Ver detalles"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(rate)}
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(rate)}
                    title="Eliminar"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

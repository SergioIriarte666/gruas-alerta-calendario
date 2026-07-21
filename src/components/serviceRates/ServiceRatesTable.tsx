import React from 'react';
import { ServiceRateWithRelations } from '@/types/serviceRates';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Pencil, Trash2, MapPin, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';

interface ServiceRatesTableProps {
  rates: ServiceRateWithRelations[];
  loading: boolean;
  onView: (rate: ServiceRateWithRelations) => void;
  onEdit: (rate: ServiceRateWithRelations) => void;
  onDelete: (rate: ServiceRateWithRelations) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}

export const ServiceRatesTable: React.FC<ServiceRatesTableProps> = ({
  rates, loading, onView, onEdit, onDelete, onToggleActive,
}) => {
  const isMobile = useIsMobile();

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
        <MapPin className="size-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No hay tarifas registradas</p>
        <p className="text-sm">Crea una nueva tarifa para comenzar</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {rates.map((rate) => (
          <Card key={rate.id} className="configuration-panel border bg-card">
            <CardContent className="p-4 space-y-3">
              {/* Client + Service Type */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">
                    {rate.client?.name || 'N/A'}
                  </p>
                  {rate.client?.department && (
                    <p className="text-xs text-muted-foreground">{rate.client.department}</p>
                  )}
                </div>
                {rate.service_type ? (
                  <Badge variant="outline" className="text-xs flex-shrink-0 ml-2">{rate.service_type.name}</Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">Todos</span>
                )}
              </div>

              {/* Route */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="truncate">{rate.origin}</span>
                {rate.destination && (
                  <>
                    <ArrowRight className="size-3 flex-shrink-0" />
                    <span className="truncate">{rate.destination}</span>
                  </>
                )}
              </div>

              {/* Value + Status + Actions */}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-bold text-primary">{formatCurrency(rate.value)}</span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rate.is_active}
                    onCheckedChange={(checked) => onToggleActive(rate.id, checked)}
                  />
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => onView(rate)}>
                    <Eye className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => onEdit(rate)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => onDelete(rate)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="configuration-panel border rounded-lg overflow-hidden">
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
                  <span className="max-w-36 truncate" title={rate.origin}>{rate.origin}</span>
                  {rate.destination && (
                    <>
                      <ArrowRight className="size-3 text-muted-foreground flex-shrink-0" />
                      <span className="max-w-36 truncate" title={rate.destination}>{rate.destination}</span>
                    </>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <span className="font-semibold text-primary">{formatCurrency(rate.value)}</span>
              </TableCell>
              <TableCell className="text-center">
                <Switch checked={rate.is_active} onCheckedChange={(checked) => onToggleActive(rate.id, checked)} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onView(rate)} title="Ver detalles"><Eye className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(rate)} title="Editar"><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(rate)} title="Eliminar" className="text-destructive hover:text-destructive"><Trash2 className="size-4" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

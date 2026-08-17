
import { useVehicleHistory, VehicleHistoryEntry } from '@/hooks/useVehicleHistory';
import { useClientHistory, ClientHistoryEntry } from '@/hooks/useClientHistory';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { formatUserCurrency } from '@/utils/currencyUtils';
import { toTitleCase } from '@/lib/utils';
import { ServiceStatus } from '@/types';
import { AlertCircle, History, Car, User } from 'lucide-react';

interface VehicleHistoryProps {
  licensePlate: string;
  currentServiceId?: string;
  clientId?: string;
  clientName?: string;
}

/**
 * Valor de una fila del historial. Único lugar del que salen la celda "Valor" y
 * el total del header, para que no puedan divergir.
 *
 * `entry.value` YA viene normalizado por `getServiceValueForClosure` dentro de
 * useVehicleHistory / useClientHistory —el mismo criterio que aplican los
 * exports Excel/PDF vía getTotalAmount, incluidos los servicios con excedente—.
 * Volver a pasarlo por getTotalAmount aquí lo inflaría: para un servicio con
 * base y custodia (10 casos reales, p.ej. SRV-6304 = 40.000 + 49.000) sumaría la
 * custodia dos veces.
 */
const getRowValue = (entry: VehicleHistoryEntry | ClientHistoryEntry): number => Number(entry.value ?? 0);

const getStatusBadge = (status: ServiceStatus) => {
    const statusConfig = {
      pending: { label: 'Pendiente', className: 'border-warning/30 bg-warning/10 text-warning' },
      in_progress: { label: 'En Progreso', className: 'border-info/30 bg-info/10 text-info' },
      inspection_completed: { label: 'Inspección Completada', className: 'border-warning/30 bg-warning/10 text-warning' },
      completed: { label: 'Completado', className: 'border-success/30 bg-success/10 text-success' },
      cancelled: { label: 'Cancelado', className: 'border-danger/30 bg-danger/10 text-danger' },
      invoiced: { label: 'Facturado', className: 'border-primary/30 bg-primary/10 text-primary' },
      quoted: { label: 'Cotizado', className: 'border-info/30 bg-info/10 text-info' },
      purchase_order_pending: { label: 'OC Pendiente', className: 'border-warning/30 bg-warning/10 text-warning' },
      with_purchase_order: { label: 'Con O.C.', className: 'border-success/30 bg-success/10 text-success' },
      failed: { label: 'Fallido', className: 'border-danger/30 bg-danger/10 text-danger' }
    };

    const config = statusConfig[status] || { label: 'Desconocido', className: 'border-border/70 bg-muted text-muted-foreground' };

    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    );
};


export const VehicleHistory = ({ licensePlate, currentServiceId, clientId, clientName }: VehicleHistoryProps) => {
  // Detectar si es un servicio sin vehículo específico
  const isVehicleSpecific = licensePlate && licensePlate !== 'N/A' && licensePlate !== '' && licensePlate !== 'Sin Patente';
  
  const vehicleQuery = useVehicleHistory(isVehicleSpecific ? licensePlate : '');
  const clientQuery = useClientHistory(!isVehicleSpecific && clientId ? clientId : '');
  
  const { history: vehicleHistory, isLoading: vehicleLoading, error: vehicleError } = vehicleQuery;
  const { history: clientHistory, isLoading: clientLoading, error: clientError } = clientQuery;
  
  // Usar los datos apropiados según el tipo de servicio
  const history = isVehicleSpecific ? vehicleHistory : clientHistory;
  const isLoading = isVehicleSpecific ? vehicleLoading : clientLoading;
  const error = isVehicleSpecific ? vehicleError : clientError;

  // Total en memoria sobre la lista ya cargada: ninguna query nueva.
  const totalValue = history.reduce((acc, service) => acc + getRowValue(service), 0);

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        <div className="flex items-center gap-x-2 mb-4">
          {isVehicleSpecific ? (
            <Car className="size-5 text-primary" />
          ) : (
            <User className="size-5 text-primary" />
          )}
          <h3 className="text-lg font-semibold text-foreground">
            {isVehicleSpecific 
              ? `Historial de Servicios - Patente ${licensePlate}`
              : `Historial del Cliente${clientName ? ` - ${toTitleCase(clientName)}` : ''}`
            }
          </h3>
        </div>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-destructive/10 rounded-lg mt-4">
        <AlertCircle className="size-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold text-foreground">Error al cargar el historial</h3>
        <p className="text-destructive">No se pudo obtener el historial de servicios para este vehículo.</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="mt-4">
        <div className="flex items-center gap-x-2 mb-4">
          {isVehicleSpecific ? (
            <Car className="size-5 text-primary" />
          ) : (
            <User className="size-5 text-primary" />
          )}
          <h3 className="text-lg font-semibold text-foreground">
            {isVehicleSpecific 
              ? `Historial de Servicios - Patente ${licensePlate}`
              : `Historial del Cliente${clientName ? ` - ${toTitleCase(clientName)}` : ''}`
            }
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/50 rounded-lg">
          <History className="size-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Sin historial previo</h3>
          <p className="text-muted-foreground">
            {isVehicleSpecific 
              ? `No se encontraron servicios previos para la patente ${licensePlate}.`
              : `No se encontraron servicios previos para este cliente.`
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="rounded-lg border border-border border-l-4 border-l-info bg-info/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-info/10">
              {isVehicleSpecific ? (
                <Car className="size-4 text-info-text" />
              ) : (
                <User className="size-4 text-info-text" />
              )}
            </div>
            <h3 className="text-base font-semibold text-info-text">
              {isVehicleSpecific
                ? `Historial de Servicios - Patente ${licensePlate}`
                : `Historial del Cliente${clientName ? ` - ${toTitleCase(clientName)}` : ''}`
              }
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              {history.length} servicio{history.length !== 1 ? 's' : ''} encontrado{history.length !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Total: {formatUserCurrency(totalValue)}
            </Badge>
          </div>
        </div>
      
      <div className="overflow-x-auto -mx-2 px-2">
        <Table className="min-w-[40rem]">
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-foreground">Folio</TableHead>
              <TableHead className="text-foreground">Fecha</TableHead>
              {isVehicleSpecific && <TableHead className="text-foreground">Cliente</TableHead>}
              {!isVehicleSpecific && <TableHead className="text-foreground">Patente</TableHead>}
              <TableHead className="text-foreground">Tipo Servicio</TableHead>
              <TableHead className="text-foreground">Ruta</TableHead>
              <TableHead className="text-foreground">Valor</TableHead>
              <TableHead className="text-foreground">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((service: VehicleHistoryEntry | ClientHistoryEntry) => (
              <TableRow 
                key={service.id} 
                className={`border-border ${service.id === currentServiceId ? 'border-primary/30 bg-primary/5' : ''}`}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <Badge 
                      variant="tms"
                      title={`Folio del servicio: ${service.folio}`}
                    >
                      {service.folio}
                    </Badge>
                    {service.id === currentServiceId && (
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-xs text-primary">
                        Actual
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-foreground">
                  {formatForDisplay(service.serviceDate)}
                </TableCell>
                {isVehicleSpecific && (
                  <TableCell className="text-foreground">
                    {'client' in service ? toTitleCase(service.client.name) : 'N/A'}
                  </TableCell>
                )}
                {!isVehicleSpecific && (
                  <TableCell className="text-foreground">
                    {'licensePlate' in service ? service.licensePlate : 'N/A'}
                  </TableCell>
                )}
                <TableCell className="text-foreground">{service.serviceType.name}</TableCell>
                <TableCell className="text-foreground max-w-xs">
                  <div className="truncate" title={`${service.origin} → ${service.destination}`}>
                    {service.origin} → {service.destination}
                  </div>
                </TableCell>
                <TableCell className="text-foreground font-semibold">{formatUserCurrency(getRowValue(service))}</TableCell>
                <TableCell>{getStatusBadge(service.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      </div>
    </div>
  );
};

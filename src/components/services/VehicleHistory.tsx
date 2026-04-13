
import React from 'react';
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

const getStatusBadge = (status: ServiceStatus) => {
    const statusConfig = {
      pending: { label: 'Pendiente', className: 'bg-yellow-500 text-white' },
      in_progress: { label: 'En Progreso', className: 'bg-blue-500 text-white' },
      inspection_completed: { label: 'Inspección Completada', className: 'bg-orange-500 text-white' },
      completed: { label: 'Completado', className: 'bg-green-500 text-white' },
      cancelled: { label: 'Cancelado', className: 'bg-red-500 text-white' },
      invoiced: { label: 'Facturado', className: 'bg-purple-500 text-white' },
      quoted: { label: 'Cotizado', className: 'bg-cyan-500 text-white' },
      purchase_order_pending: { label: 'Esperando O.C.', className: 'bg-amber-500 text-white' },
      with_purchase_order: { label: 'Con Orden de Compra', className: 'bg-teal-500 text-white' },
      failed: { label: 'Fallido', className: 'bg-red-700 text-white' }
    };

    const config = statusConfig[status] || { label: 'Desconocido', className: 'bg-gray-500 text-white' };

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

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        <div className="flex items-center space-x-2 mb-4">
          {isVehicleSpecific ? (
            <Car className="w-5 h-5 text-tms-green" />
          ) : (
            <User className="w-5 h-5 text-tms-green" />
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
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold text-foreground">Error al cargar el historial</h3>
        <p className="text-destructive">No se pudo obtener el historial de servicios para este vehículo.</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="mt-4">
        <div className="flex items-center space-x-2 mb-4">
          {isVehicleSpecific ? (
            <Car className="w-5 h-5 text-tms-green" />
          ) : (
            <User className="w-5 h-5 text-tms-green" />
          )}
          <h3 className="text-lg font-semibold text-foreground">
            {isVehicleSpecific 
              ? `Historial de Servicios - Patente ${licensePlate}`
              : `Historial del Cliente${clientName ? ` - ${toTitleCase(clientName)}` : ''}`
            }
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/50 rounded-lg">
          <History className="w-12 h-12 text-muted-foreground mb-4" />
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
      <div className="rounded-lg border border-border border-l-4 border-l-cyan-500 bg-cyan-500/5 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10">
              {isVehicleSpecific ? (
                <Car className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              ) : (
                <User className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              )}
            </div>
            <h3 className="text-base font-semibold text-cyan-700 dark:text-cyan-300">
              {isVehicleSpecific 
                ? `Historial de Servicios - Patente ${licensePlate}`
                : `Historial del Cliente${clientName ? ` - ${toTitleCase(clientName)}` : ''}`
              }
            </h3>
          </div>
          <Badge variant="outline" className="text-tms-green border-tms-green">
            {history.length} servicio{history.length !== 1 ? 's' : ''} encontrado{history.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      
      <div className="overflow-x-auto">
        <Table>
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
                className={`border-border ${service.id === currentServiceId ? 'bg-tms-green/10 border-tms-green/30' : ''}`}
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
                      <Badge variant="outline" className="text-xs border-tms-green text-tms-green">
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
                <TableCell className="text-foreground font-semibold">{formatUserCurrency(service.value)}</TableCell>
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

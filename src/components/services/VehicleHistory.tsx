import React from 'react';
import { useVehicleHistory, VehicleHistoryEntry } from '@/hooks/useVehicleHistory';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ServiceStatus } from '@/types';
import { AlertCircle, History } from 'lucide-react';

interface VehicleHistoryProps {
  licensePlate: string;
  currentServiceId?: string;
}

const getStatusBadge = (status: ServiceStatus) => {
    const statusConfig = {
      pending: { label: 'Pendiente', className: 'bg-yellow-500 text-white' },
      in_progress: { label: 'En Progreso', className: 'bg-blue-500 text-white' },
      completed: { label: 'Completado', className: 'bg-green-500 text-white' },
      cancelled: { label: 'Cancelado', className: 'bg-red-500 text-white' }
    };

    const config = statusConfig[status] || { label: 'Desconocido', className: 'bg-gray-500 text-white' };

    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    );
};

export const VehicleHistory = ({ licensePlate, currentServiceId }: VehicleHistoryProps) => {
  const { history, isLoading, error } = useVehicleHistory(licensePlate, currentServiceId);

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-red-900/20 rounded-lg mt-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-white">Error al cargar el historial</h3>
        <p className="text-red-400">No se pudo obtener el historial de servicios para este vehículo.</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-800/50 rounded-lg mt-4">
        <History className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-white">Sin historial</h3>
        <p className="text-gray-400">No se encontraron servicios previos para la patente {licensePlate}.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto mt-4">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-700">
            <TableHead className="text-gray-300">Folio</TableHead>
            <TableHead className="text-gray-300">Fecha</TableHead>
            <TableHead className="text-gray-300">Tipo Servicio</TableHead>
            <TableHead className="text-gray-300">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((service: VehicleHistoryEntry) => (
            <TableRow key={service.id} className="border-gray-700">
              <TableCell className="font-medium text-tms-green">{service.folio}</TableCell>
              <TableCell className="text-gray-300">
                {format(new Date(service.serviceDate), 'dd/MM/yyyy', { locale: es })}
              </TableCell>
              <TableCell className="text-gray-300">{service.serviceType.name}</TableCell>
              <TableCell>{getStatusBadge(service.status)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
